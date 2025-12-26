import { ethers } from "ethers";
import lotteryArtifact from "../abi/Lottery.json";
import addresses from "../contracts/addresses.json";

export function hasMetaMask() {
  return typeof window !== "undefined" && !!window.ethereum;
}

export function getBrowserProvider() {
  if (!hasMetaMask()) throw new Error("MetaMask not found");
  return new ethers.BrowserProvider(window.ethereum);
}

export async function connectWallet() {
  const provider = getBrowserProvider();
  const accounts = await provider.send("eth_requestAccounts", []);
  return accounts[0];
}

export async function getBalanceEth(address) {
  const provider = getBrowserProvider();
  const bal = await provider.getBalance(address);
  return ethers.formatEther(bal);
}

export async function getLottery(readOnly = false) {
  const provider = getBrowserProvider();
  if (readOnly) {
    return new ethers.Contract(addresses.Lottery, lotteryArtifact.abi, provider);
  }
  const signer = await provider.getSigner();
  return new ethers.Contract(addresses.Lottery, lotteryArtifact.abi, signer);
}
