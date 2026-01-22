import { ethers } from "ethers";
import lotteryArtifact from "./abi/Lottery.json";
import { CONTRACT_ADDRESS } from "./config";
console.log("ETH.JS USING CONTRACT_ADDRESS =", CONTRACT_ADDRESS);


let _injected = null;

export function getInjectedProvider() {
  if (!window.ethereum) return null;
  if (!_injected) _injected = new ethers.BrowserProvider(window.ethereum);
  return _injected;
}

export function getReadContract() {
  const p = getInjectedProvider();
  if (!p) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, lotteryArtifact.abi, p);
}

export async function getWriteContract() {
  const p = getInjectedProvider();
  if (!p) return null;
  const signer = await p.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, lotteryArtifact.abi, signer);
}
