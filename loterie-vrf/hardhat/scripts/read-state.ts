import "dotenv/config";
import hre from "hardhat";

const LOTTERY_ADDRESS = "0x7d8f1ad8c0264fe6fd73bd567b42f9290b58d2b7";

async function main() {
  const { viem } = await hre.network.connect();
  const lottery = await viem.getContractAt("Lottery", LOTTERY_ADDRESS);

  const state = await (lottery as any).read.state();
  const lastRequestId = await (lottery as any).read.lastRequestId();
  const lastWinner = await (lottery as any).read.lastWinner();
  const lastPrize = await (lottery as any).read.lastPrize();
  const players = await (lottery as any).read.getPlayersCount();
  const pot = await (lottery as any).read.getPot();

  console.log("state:", state.toString(), "(0 OPEN, 1 CALCULATING, 2 PAID)");
  console.log("lastRequestId:", lastRequestId.toString());
  console.log("lastWinner:", lastWinner);
  console.log("lastPrize:", lastPrize.toString());
  console.log("players:", players.toString());
  console.log("pot:", pot.toString());
}

main().catch(console.error);
