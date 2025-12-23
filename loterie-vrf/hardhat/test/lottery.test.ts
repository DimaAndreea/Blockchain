import { describe, it } from "node:test";
import assert from "node:assert/strict";
import hre from "hardhat";

const { viem } = await hre.network.connect();

async function deployFixture() {
  const ticketPrice = 10_000_000_000_000_000n; // 0.01 ETH

  const [owner, user1, user2] = await viem.getWalletClients();

  const lottery = await viem.deployContract("Lottery", [ticketPrice]);
  const provider = await viem.deployContract("RandomnessProvider", [lottery.address]);

  await lottery.write.setProvider([provider.address]); // has args => keep array

  return { ticketPrice, owner, user1, user2, lottery, provider };
}

describe("Lottery (VRF-style via RandomnessProvider)", () => {

  it("buyTicket: should add player and increase pot", async () => {
    const { ticketPrice, user1, lottery } = await deployFixture();

    await lottery.write.buyTicket({ account: user1.account, value: ticketPrice });

    const count = await lottery.read.getPlayersCount();
    const pot = await lottery.read.getPot();

    assert.equal(count, 1n);
    assert.equal(pot, ticketPrice);
  });

  it("requestDraw: only owner can call", async () => {
    const { ticketPrice, owner, user1, lottery } = await deployFixture();

    await lottery.write.buyTicket({ account: user1.account, value: ticketPrice });

    await assert.rejects(async () => {
      await lottery.write.requestDraw({ account: user1.account });
    });

    await lottery.write.requestDraw({ account: owner.account });

    const state = await lottery.read.state();
    assert.equal(BigInt(state), 1n); // DRAWING
  });

  it("fulfillRandom: only provider can call", async () => {
    const { ticketPrice, owner, user1, lottery } = await deployFixture();

    await lottery.write.buyTicket({ account: user1.account, value: ticketPrice });
    await lottery.write.requestDraw({ account: owner.account });

    await assert.rejects(async () => {
      await lottery.write.fulfillRandom([777n], { account: owner.account });
    });

    await assert.rejects(async () => {
      await lottery.write.fulfillRandom([777n], { account: user1.account });
    });
  });

  it("deliverRandom: sets winner and PAID state", async () => {
    const { ticketPrice, owner, user1, user2, lottery, provider } = await deployFixture();

    await lottery.write.buyTicket({ account: user1.account, value: ticketPrice });
    await lottery.write.buyTicket({ account: user2.account, value: ticketPrice });

    await lottery.write.requestDraw({ account: owner.account });

    const reqId = await lottery.read.requestId();
    await provider.write.deliverRandom([reqId, 777n], { account: owner.account });

    const winner = (await lottery.read.lastWinner()) as string;
    const prize = await lottery.read.lastPrize();
    const state = await lottery.read.state();

    const w = winner.toLowerCase();
    const a1 = user1.account.address.toLowerCase();
    const a2 = user2.account.address.toLowerCase();

    assert.ok(w === a1 || w === a2);
    assert.equal(prize, ticketPrice * 2n);
    assert.equal(BigInt(state), 2n); // PAID
  });

  it("withdrawPrize: only winner can withdraw and only once", async () => {
    const { ticketPrice, owner, user1, user2, lottery, provider } = await deployFixture();

    await lottery.write.buyTicket({ account: user1.account, value: ticketPrice });
    await lottery.write.buyTicket({ account: user2.account, value: ticketPrice });

    await lottery.write.requestDraw({ account: owner.account });

    const reqId = await lottery.read.requestId();
    await provider.write.deliverRandom([reqId, 777n], { account: owner.account });

    const winner = (await lottery.read.lastWinner()) as string;
    const w = winner.toLowerCase();
    const a1 = user1.account.address.toLowerCase();

    const winnerClient = w === a1 ? user1 : user2;
    const loserClient = w === a1 ? user2 : user1;

    await assert.rejects(async () => {
      await lottery.write.withdrawPrize({ account: loserClient.account });
    });

    await lottery.write.withdrawPrize({ account: winnerClient.account });

    await assert.rejects(async () => {
      await lottery.write.withdrawPrize({ account: winnerClient.account });
    });
  });

});
