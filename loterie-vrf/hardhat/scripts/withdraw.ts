import "dotenv/config";
import hre from "hardhat";

const LOTTERY_ADDRESS = "0x7d8f1ad8c0264fe6fd73bd567b42f9290b58d2b7";

async function main() {
  const { viem } = await hre.network.connect();
  const [user] = await viem.getWalletClients();
  const lottery = await viem.getContractAt("Lottery", LOTTERY_ADDRESS);

  console.log("Using:", user.account.address);

  const winner: string = await (lottery as any).read.lastWinner();
  console.log("Winner is:", winner);

  if (winner.toLowerCase() !== user.account.address.toLowerCase()) {
    throw new Error("You are NOT the winner. Switch account or import winner key in Metamask.");
  }

  console.log("Withdrawing...");
  await (lottery as any).write.withdrawPrize({ account: user.account });
  console.log("Done.");
}

main().catch(console.error);
