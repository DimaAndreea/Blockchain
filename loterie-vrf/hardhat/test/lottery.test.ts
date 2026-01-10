import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { decodeEventLog } from "viem";

const { viem } = await hre.network.connect();

/**
 * VRFCoordinatorV2_5Mock event signatures differ a bit between versions.
 * We try multiple ABI variants and decode whichever matches.
 */
const SUB_CREATED_ABI_CANDIDATES = [
  // Variant A: uint64 subId, owner not indexed
  [
    {
      type: "event",
      name: "SubscriptionCreated",
      inputs: [
        { indexed: true, name: "subId", type: "uint64" },
        { indexed: false, name: "owner", type: "address" },
      ],
      anonymous: false,
    },
  ],
  // Variant B: uint256 subId, owner not indexed
  [
    {
      type: "event",
      name: "SubscriptionCreated",
      inputs: [
        { indexed: true, name: "subId", type: "uint256" },
        { indexed: false, name: "owner", type: "address" },
      ],
      anonymous: false,
    },
  ],
  // Variant C: uint64 subId, owner indexed
  [
    {
      type: "event",
      name: "SubscriptionCreated",
      inputs: [
        { indexed: true, name: "subId", type: "uint64" },
        { indexed: true, name: "owner", type: "address" },
      ],
      anonymous: false,
    },
  ],
  // Variant D: uint256 subId, owner indexed
  [
    {
      type: "event",
      name: "SubscriptionCreated",
      inputs: [
        { indexed: true, name: "subId", type: "uint256" },
        { indexed: true, name: "owner", type: "address" },
      ],
      anonymous: false,
    },
  ],
] as const;

// ✅ Hardhat3+viem safe time travel
async function increaseTime(seconds: bigint) {
  const testClient = await viem.getTestClient();
  await testClient.increaseTime({ seconds: Number(seconds) });
  await testClient.mine({ blocks: 1 });
}

function extractSubIdFromReceiptLogs(receipt: any): bigint {
  for (const log of receipt.logs ?? []) {
    for (const abi of SUB_CREATED_ABI_CANDIDATES) {
      try {
        const decoded = decodeEventLog({
          abi: abi as any,
          data: log.data,
          topics: log.topics,
        });

        if (decoded.eventName === "SubscriptionCreated") {
          return decoded.args.subId as unknown as bigint;
        }
      } catch {
        // try next ABI candidate
      }
    }
  }

  const topic0s = (receipt.logs ?? []).map((l: any) => l.topics?.[0]).filter(Boolean);
  throw new Error(
    `Could not decode SubscriptionCreated event. topic0s seen: ${JSON.stringify(topic0s)}`
  );
}

async function deployFixture() {
  const ticketPrice = 10_000_000_000_000_000n; // 0.01 ETH
  const interval = 60n; // 60 sec

  const [deployer, user1, user2] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  // ----------------------------
  // Deploy VRF v2.5 Mock
  // ----------------------------
  const baseFee = 1_000_000_000_000_000_000n;
  const gasPriceLink = 1_000_000_000n;
  const weiPerUnitLink = 1_000_000_000_000_000_000n;

  const vrfMock = await viem.deployContract("VRFCoordinatorV2_5MockWrapper", [
    baseFee,
    gasPriceLink,
    weiPerUnitLink,
  ]);

  // Create subscription and extract subId from logs
  const txHash = await (vrfMock as any).write.createSubscription({
    account: deployer.account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const subId = extractSubIdFromReceiptLogs(receipt);

  // Fund subscription (mock LINK)
  await (vrfMock as any).write.fundSubscription(
    [subId, 100000000000000000000n], // 100 mock LINK
    { account: deployer.account }
  );

  // keyHash any bytes32 for local mock
  const keyHash =
    "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

  // Deploy Lottery
  const lottery = await viem.deployContract("Lottery", [
    ticketPrice,
    interval,
    vrfMock.address,
    subId,
    keyHash,
  ]);

  // Add consumer
  await (vrfMock as any).write.addConsumer([subId, lottery.address], {
    account: deployer.account,
  });

  return { ticketPrice, interval, deployer, user1, user2, lottery, vrfMock, subId };
}

describe("Lottery (Chainlink VRF v2.5 mock)", () => {
  it("buyTicket adds player and increases pot", async () => {
    const { ticketPrice, user1, lottery } = await deployFixture();

    await (lottery as any).write.buyTicket({
      account: user1.account,
      value: ticketPrice,
    });

    const count: bigint = await (lottery as any).read.getPlayersCount();
    const pot: bigint = await (lottery as any).read.getPot();

    assert.equal(count, 1n);
    assert.equal(pot, ticketPrice);
  });

  it("performUpkeep only works when conditions are met", async () => {
    const { ticketPrice, interval, user1, lottery } = await deployFixture();

    // no players -> revert
    await assert.rejects(async () => {
      await (lottery as any).write.performUpkeep(["0x"]);
    });

    await (lottery as any).write.buyTicket({
      account: user1.account,
      value: ticketPrice,
    });

    // time not passed -> revert
    await assert.rejects(async () => {
      await (lottery as any).write.performUpkeep(["0x"]);
    });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"]);

    const st: bigint = BigInt(await (lottery as any).read.state());
    assert.equal(st, 1n); // CALCULATING
  });

  it("VRF fulfill selects winner and moves to PAID", async () => {
    const { ticketPrice, interval, user1, user2, lottery, vrfMock } = await deployFixture();

    await (lottery as any).write.buyTicket({ account: user1.account, value: ticketPrice });
    await (lottery as any).write.buyTicket({ account: user2.account, value: ticketPrice });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"]);
    const requestId: bigint = await (lottery as any).read.lastRequestId();

    // VRF mock fulfills
    await (vrfMock as any).write.fulfillRandomWords([requestId, lottery.address]);

    const winner: string = await (lottery as any).read.lastWinner();
    const prize: bigint = await (lottery as any).read.lastPrize();
    const state: bigint = BigInt(await (lottery as any).read.state());

    const w = winner.toLowerCase();
    const a1 = user1.account.address.toLowerCase();
    const a2 = user2.account.address.toLowerCase();

    assert.ok(w === a1 || w === a2);
    assert.equal(prize, ticketPrice * 2n);
    assert.equal(state, 2n); // PAID
  });

  it("withdrawPrize: only winner can withdraw, then resets to OPEN", async () => {
    const { ticketPrice, interval, user1, user2, lottery, vrfMock } = await deployFixture();

    await (lottery as any).write.buyTicket({ account: user1.account, value: ticketPrice });
    await (lottery as any).write.buyTicket({ account: user2.account, value: ticketPrice });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"]);
    const requestId: bigint = await (lottery as any).read.lastRequestId();

    await (vrfMock as any).write.fulfillRandomWords([requestId, lottery.address]);

    const winner: string = await (lottery as any).read.lastWinner();
    const w = winner.toLowerCase();

    const a1 = user1.account.address.toLowerCase();
    const winnerClient = w === a1 ? user1 : user2;
    const loserClient = w === a1 ? user2 : user1;

    await assert.rejects(async () => {
      await (lottery as any).write.withdrawPrize({ account: loserClient.account });
    });

    await (lottery as any).write.withdrawPrize({ account: winnerClient.account });

    const count: bigint = await (lottery as any).read.getPlayersCount();
    const state: bigint = BigInt(await (lottery as any).read.state());

    assert.equal(count, 0n);
    assert.equal(state, 0n); // OPEN
  });
});
