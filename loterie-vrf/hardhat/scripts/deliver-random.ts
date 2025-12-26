import { ethers } from "ethers";
import { readFileSync } from "fs";
import path from "path";

function loadArtifact(relPath: string) {
  const p = path.join(process.cwd(), relPath);
  const json = JSON.parse(readFileSync(p, "utf-8"));
  return { abi: json.abi };
}

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const owner = await provider.getSigner(0);

  // pune aici adresele tale curente (acelea din deploy-hh3.ts)
  const LOTTERY_ADDR = "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853";
  const RP_ADDR = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";

  const lotteryArt = loadArtifact("artifacts/contracts/Lottery.sol/Lottery.json");
  const rpArt = loadArtifact("artifacts/contracts/RandomnessProvider.sol/RandomnessProvider.json");

  const lottery = new ethers.Contract(LOTTERY_ADDR, lotteryArt.abi, owner);
  const rp = new ethers.Contract(RP_ADDR, rpArt.abi, owner);

  const reqId = await lottery.requestId();
  console.log("requestId =", reqId.toString());

  const randomWord = BigInt(Math.floor(Math.random() * 1_000_000));
  const tx = await rp.deliverRandom(reqId, randomWord);
  await tx.wait();

  console.log("Delivered randomWord =", randomWord.toString());
  console.log("Winner =", await lottery.lastWinner());
  console.log("Prize =", (await lottery.lastPrize()).toString());
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
