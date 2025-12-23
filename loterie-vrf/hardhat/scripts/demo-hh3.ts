import { readFileSync } from "fs";
import path from "path";
import { ethers } from "ethers";

function loadArtifact(relPath: string) {
  const p = path.join(process.cwd(), relPath);
  const json = JSON.parse(readFileSync(p, "utf-8"));
  return { abi: json.abi, bytecode: json.bytecode as string };
}

async function main() {
  const rpcUrl = "http://127.0.0.1:8545";
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const owner = await provider.getSigner(0);
  const user1 = await provider.getSigner(1);
  const user2 = await provider.getSigner(2);

  const ownerAddr = await owner.getAddress();
  const user1Addr = await user1.getAddress();
  const user2Addr = await user2.getAddress();

  console.log("Owner:", ownerAddr);
  console.log("User1:", user1Addr);
  console.log("User2:", user2Addr);

  // Load artifacts
  const lotteryArt = loadArtifact("artifacts/contracts/Lottery.sol/Lottery.json");
  const rpArt = loadArtifact("artifacts/contracts/RandomnessProvider.sol/RandomnessProvider.json");

  // IMPORTANT: put here the addresses printed by deploy
  const LOTTERY_ADDR = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const RP_ADDR = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

  const lotteryOwner = new ethers.Contract(LOTTERY_ADDR, lotteryArt.abi, owner);
  const lotteryUser1 = new ethers.Contract(LOTTERY_ADDR, lotteryArt.abi, user1);
  const lotteryUser2 = new ethers.Contract(LOTTERY_ADDR, lotteryArt.abi, user2);

  const rpOwner = new ethers.Contract(RP_ADDR, rpArt.abi, owner);

  const ticketPrice: bigint = await lotteryOwner.ticketPrice();
  console.log("Ticket price:", ticketPrice.toString());

  console.log("\n--- BUY TICKETS ---");
  let tx = await lotteryUser1.buyTicket({ value: ticketPrice });
  await tx.wait();
  console.log("User1 bought ticket");

  tx = await lotteryUser2.buyTicket({ value: ticketPrice });
  await tx.wait();
  console.log("User2 bought ticket");

  const playersCount = await lotteryOwner.getPlayersCount();
  const pot = await lotteryOwner.getPot();
  console.log("Players:", playersCount.toString(), "| Pot:", pot.toString());

  console.log("\n--- REQUEST DRAW (OWNER) ---");
  tx = await lotteryOwner.requestDraw();
  await tx.wait();
  const reqId = await lotteryOwner.requestId();
  console.log("Draw requested. requestId:", reqId.toString());

  console.log("\n--- DELIVER RANDOM (SIMULATED VRF CALLBACK) ---");
  // Choose any randomWord you want for demo
  const randomWord = 777n;
  tx = await rpOwner.deliverRandom(reqId, randomWord);
  await tx.wait();
  console.log("Random delivered:", randomWord.toString());

  const winner = await lotteryOwner.lastWinner();
  const prize = await lotteryOwner.lastPrize();
  console.log("Winner:", winner);
  console.log("Prize:", prize.toString());

  console.log("\n--- WITHDRAW (WINNER) ---");
  // Winner withdraws
  const winnerLower = (winner as string).toLowerCase();
  if (winnerLower === user1Addr.toLowerCase()) {
    tx = await lotteryUser1.withdrawPrize();
    await tx.wait();
    console.log("User1 withdrew prize ✅");
  } else if (winnerLower === user2Addr.toLowerCase()) {
    tx = await lotteryUser2.withdrawPrize();
    await tx.wait();
    console.log("User2 withdrew prize ✅");
  } else {
    console.log("Winner is not user1/user2 (unexpected in this demo).");
  }

  const potAfter = await lotteryOwner.getPot();
  const playersAfter = await lotteryOwner.getPlayersCount();
  console.log("After withdraw | Players:", playersAfter.toString(), "| Pot:", potAfter.toString());
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
