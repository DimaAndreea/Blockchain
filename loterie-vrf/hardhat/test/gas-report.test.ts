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
  throw new Error("Could not decode SubscriptionCreated event from logs");
}

async function deployFixture() {
  const ticketPrice = 10_000_000_000_000_000n; // 0.01 ETH
  const interval = 60n;

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

  return { ticketPrice, interval, deployer, user1, user2, lottery, vrfMock, publicClient };
}

function fmt(n: bigint) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "_");
}

describe("Gas analysis (Hardhat 3 + viem)", () => {
  it("reports gas used for main functions", async () => {
    const { ticketPrice, interval, user1, user2, lottery, vrfMock, publicClient } =
      await deployFixture();

    // 1) buyTicket gas
    const buyHash = await (lottery as any).write.buyTicket({
      account: user1.account,
      value: ticketPrice,
    });
    const buyRcpt = await publicClient.waitForTransactionReceipt({ hash: buyHash });
    assert.ok(buyRcpt.gasUsed > 0n);

    // second player
    await (lottery as any).write.buyTicket({ account: user2.account, value: ticketPrice });

    // 2) performUpkeep gas (after interval)
    await increaseTime(interval + 1n);
    const upkeepHash = await (lottery as any).write.performUpkeep(["0x"]);
    const upkeepRcpt = await publicClient.waitForTransactionReceipt({ hash: upkeepHash });

    // 3) fulfillRandomWords gas (VRF mock tx)
    const requestId: bigint = await (lottery as any).read.lastRequestId();
    const fulfillHash = await (vrfMock as any).write.fulfillRandomWords([requestId, lottery.address]);
    const fulfillRcpt = await publicClient.waitForTransactionReceipt({ hash: fulfillHash });

    // 4) withdrawPrize gas (winner only)
    const winner: string = await (lottery as any).read.lastWinner();
    const w = winner.toLowerCase();
    const a1 = user1.account.address.toLowerCase();
    const winnerClient = w === a1 ? user1 : user2;

    const withdrawHash = await (lottery as any).write.withdrawPrize({ account: winnerClient.account });
    const withdrawRcpt = await publicClient.waitForTransactionReceipt({ hash: withdrawHash });

    // Pretty report in console
    console.log("\n=== GAS COST REPORT (units) ===");
    console.log(`buyTicket():        ${fmt(buyRcpt.gasUsed)} gas`);
    console.log(`performUpkeep():    ${fmt(upkeepRcpt.gasUsed)} gas`);
    console.log(`fulfillRandomWords(): ${fmt(fulfillRcpt.gasUsed)} gas (VRF mock tx)`);
    console.log(`withdrawPrize():    ${fmt(withdrawRcpt.gasUsed)} gas`);
    console.log("==============================\n");
  });
});
