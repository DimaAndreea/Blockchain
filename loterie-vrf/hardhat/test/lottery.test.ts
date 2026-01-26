import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";
import { decodeEventLog } from "viem";

const { viem } = await hre.network.connect();

const SUB_CREATED_ABI_CANDIDATES = [
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
      } catch {}
    }
  }
  const topic0s = (receipt.logs ?? []).map((l: any) => l.topics?.[0]).filter(Boolean);
  throw new Error(`Could not decode SubscriptionCreated event. topic0s: ${JSON.stringify(topic0s)}`);
}

async function deployFixture() {
  const ticketPrice = 10_000_000_000_000_000n; // 0.01 ETH
  const interval = 60n; // 60 sec

  const [deployer, user1, user2] = await viem.getWalletClients();
  const publicClient = await viem.getPublicClient();

  const baseFee = 1_000_000_000_000_000_000n;
  const gasPriceLink = 1_000_000_000n;
  const weiPerUnitLink = 1_000_000_000_000_000_000n;

  const vrfMock = await viem.deployContract("VRFCoordinatorV2_5MockWrapper", [
    baseFee,
    gasPriceLink,
    weiPerUnitLink,
  ]);

  const txHash = await (vrfMock as any).write.createSubscription({
    account: deployer.account,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  const subId = extractSubIdFromReceiptLogs(receipt);

  await (vrfMock as any).write.fundSubscription(
    [subId, 100000000000000000000n],
    { account: deployer.account }
  );

  const keyHash =
    "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae";

  const lottery = await viem.deployContract("Lottery", [
    ticketPrice,
    interval,
    vrfMock.address,
    subId,
    keyHash,
  ]);

  await (vrfMock as any).write.addConsumer([subId, lottery.address], {
    account: deployer.account,
  });

  return { ticketPrice, interval, deployer, user1, user2, lottery, vrfMock, subId };
}

describe("Lottery (VRF v2.5 mock)", () => {
  it("checkUpkeep is false before round starts (lastTimeStamp=0)", async () => {
    const { lottery } = await deployFixture();
    const [needed] = await (lottery as any).read.checkUpkeep(["0x"]);
    assert.equal(needed, false);
  });

  it("buyTicket: adds player, starts timer on first ticket, increases pot", async () => {
    const { ticketPrice, user1, lottery } = await deployFixture();

    await (lottery as any).write.buyTicket({
      account: user1.account,
      value: ticketPrice,
    });

    const count: bigint = await (lottery as any).read.getPlayersCount();
    const pot: bigint = await (lottery as any).read.getPot();
    const ts: bigint = await (lottery as any).read.lastTimeStamp();

    assert.equal(count, 1n);
    assert.equal(pot, ticketPrice);
    assert.ok(ts > 0n);
  });

  it("buyTicket reverts if wrong ETH", async () => {
    const { user1, lottery } = await deployFixture();

    await assert.rejects(async () => {
      await (lottery as any).write.buyTicket({
        account: user1.account,
        value: 1n,
      });
    });
  });

  it("performUpkeep only works when conditions are met", async () => {
    const { ticketPrice, interval, deployer, user1, lottery } = await deployFixture();

    // no players -> revert
    await assert.rejects(async () => {
      await (lottery as any).write.performUpkeep(["0x"], { account: deployer.account });
    });

    await (lottery as any).write.buyTicket({
      account: user1.account,
      value: ticketPrice,
    });

    // time not passed -> revert
    await assert.rejects(async () => {
      await (lottery as any).write.performUpkeep(["0x"], { account: deployer.account });
    });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"], { account: deployer.account });

    const st: bigint = BigInt(await (lottery as any).read.state());
    assert.equal(st, 1n); // CALCULATING
  });

  it("VRF fulfill selects winner and moves to PAID", async () => {
    const { ticketPrice, interval, deployer, user1, user2, lottery, vrfMock } = await deployFixture();

    await (lottery as any).write.buyTicket({ account: user1.account, value: ticketPrice });
    await (lottery as any).write.buyTicket({ account: user2.account, value: ticketPrice });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"], { account: deployer.account });
    const requestId: bigint = await (lottery as any).read.lastRequestId();

    await (vrfMock as any).write.fulfillRandomWords([requestId, lottery.address], {
      account: deployer.account,
    });

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

  it("withdrawPrize: only winner can withdraw, then resets to OPEN and clears players", async () => {
    const { ticketPrice, interval, deployer, user1, user2, lottery, vrfMock } = await deployFixture();

    await (lottery as any).write.buyTicket({ account: user1.account, value: ticketPrice });
    await (lottery as any).write.buyTicket({ account: user2.account, value: ticketPrice });

    await increaseTime(interval + 1n);

    await (lottery as any).write.performUpkeep(["0x"], { account: deployer.account });
    const requestId: bigint = await (lottery as any).read.lastRequestId();

    await (vrfMock as any).write.fulfillRandomWords([requestId, lottery.address], {
      account: deployer.account,
    });

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
    const ts: bigint = await (lottery as any).read.lastTimeStamp();

    assert.equal(count, 0n);
    assert.equal(state, 0n); // OPEN
    assert.equal(ts, 0n); // round not started
  });
});
