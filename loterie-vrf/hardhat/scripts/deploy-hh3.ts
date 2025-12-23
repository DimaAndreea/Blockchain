import { readFileSync } from "fs";
import path from "path";
import { ethers } from "ethers";

/**
 * Helper: load artifact JSON (abi + bytecode) produced by Hardhat compile
 */
function loadArtifact(artifactPathFromHardhatRoot: string) {
  const p = path.join(process.cwd(), artifactPathFromHardhatRoot);
  const raw = readFileSync(p, "utf-8");
  const json = JSON.parse(raw);
  if (!json.abi || !json.bytecode) {
    throw new Error(`Artifact missing abi/bytecode: ${p}`);
  }
  return { abi: json.abi, bytecode: json.bytecode as string };
}

async function main() {
  // 1) connect to local hardhat node
  const rpcUrl = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 2) use first hardhat account as deployer
  const deployer = await provider.getSigner(0);
  const deployerAddr = await deployer.getAddress();
  console.log("Deployer:", deployerAddr);

  // 3) load artifacts
  const lotteryArt = loadArtifact(
    "artifacts/contracts/Lottery.sol/Lottery.json"
  );
  const providerArt = loadArtifact(
    "artifacts/contracts/RandomnessProvider.sol/RandomnessProvider.json"
  );

  // 4) deploy Lottery
  const ticketPriceWei = ethers.parseEther("0.01");
  const LotteryFactory = new ethers.ContractFactory(
    lotteryArt.abi,
    lotteryArt.bytecode,
    deployer
  );

  const lottery = await LotteryFactory.deploy(ticketPriceWei);
  await lottery.waitForDeployment();
  const lotteryAddr = await lottery.getAddress();
  console.log("Lottery deployed to:", lotteryAddr);

  // 5) deploy RandomnessProvider
  const RPFactory = new ethers.ContractFactory(
    providerArt.abi,
    providerArt.bytecode,
    deployer
  );

  const randomnessProvider = await RPFactory.deploy(lotteryAddr);
  await randomnessProvider.waitForDeployment();
  const rpAddr = await randomnessProvider.getAddress();
  console.log("RandomnessProvider deployed to:", rpAddr);

  // 6) set provider in Lottery
  const tx = await (lottery as any).setProvider(rpAddr);
  await tx.wait();
  console.log("Provider set in Lottery ✅");

  console.log("Ticket price:", ticketPriceWei.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
