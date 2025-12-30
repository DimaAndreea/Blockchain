import hre from "hardhat";
import fs from "fs";
import path from "path";
import { parseEther } from "viem";

async function main() {
  const ticketPriceWei = parseEther("0.01");

  const vrfCoordinator = process.env.VRF_COORDINATOR as `0x${string}`;
  const subId = BigInt(process.env.VRF_SUBSCRIPTION_ID || "0");
  const keyHash = process.env.VRF_KEY_HASH as `0x${string}`;
  const callbackGasLimit = Number(process.env.VRF_CALLBACK_GAS_LIMIT || "500000");
  const confirmations = Number(process.env.VRF_CONFIRMATIONS || "3");

  if (!vrfCoordinator || !keyHash || subId === 0n) {
    throw new Error("Missing env vars: VRF_COORDINATOR / VRF_KEY_HASH / VRF_SUBSCRIPTION_ID");
  }

  // Hardhat 3 + viem
  const { viem } = await hre.network.connect();

  const [deployer] = await viem.getWalletClients();
  console.log("Deployer:", deployer.account.address);

  const lottery = await viem.deployContract("LotteryVRF", [
    ticketPriceWei,
    vrfCoordinator,
    subId,
    keyHash,
    callbackGasLimit,
    confirmations,
  ]);

  console.log("LotteryVRF deployed to:", lottery.address);

  // write addresses into frontend
  const outPath = path.join(process.cwd(), "..", "frontend", "src", "contracts", "addresses.json");
  const payload = { Lottery: lottery.address };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf-8");

  console.log("addresses.json updated:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
