import "dotenv/config";
import hre from "hardhat";

const LOTTERY_ADDRESS = "0x8ef6e668b668e845ad8810ae0e2a5f259ea925b8";

async function main() {
  const { viem } = await hre.network.connect();
  const [user] = await viem.getWalletClients();

  console.log("Using account:", user.account.address);

  const lottery = await viem.getContractAt("Lottery", LOTTERY_ADDRESS);

  const ticketPrice: bigint = await (lottery as any).read.ticketPrice();
  console.log("Ticket price:", ticketPrice.toString());

  console.log("Buying ticket...");
  await (lottery as any).write.buyTicket({
    account: user.account,
    value: ticketPrice,
  });

  console.log("Waiting ~70 seconds...");
  await new Promise((r) => setTimeout(r, 70_000));

  console.log("Calling performUpkeep...");
  await (lottery as any).write.performUpkeep(["0x"], {
    account: user.account,
  });

  console.log("Waiting for VRF callback (check dashboard or read state)...");
}

main().catch(console.error);
