import { ethers } from "ethers";
import lotteryArtifact from "../abi/LotteryVRF.json";
import addresses from "../contracts/addresses.json";

/**
 * READ-ONLY RPC (fără MetaMask)
 * Pune un endpoint public (sau unul de la Alchemy/Ankr cu key)
 */
const READ_RPC = import.meta.env.VITE_SEPOLIA_RPC_URL;
export const readProvider = new ethers.JsonRpcProvider(READ_RPC);

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
  // citire din readProvider (fără MetaMask)
  const bal = await readProvider.getBalance(address);
  return ethers.formatEther(bal);
}

export async function getLottery(readOnly = false) {
  if (readOnly) {
    return new ethers.Contract(addresses.Lottery, lotteryArtifact.abi, readProvider);
  }
  const provider = getBrowserProvider();
  await provider.send("eth_requestAccounts", []); // ✅ important
  const signer = await provider.getSigner();
  return new ethers.Contract(addresses.Lottery, lotteryArtifact.abi, signer);
}

export function getProvider() {
  // read-only provider (RPC direct)
  return readProvider;
}

if (typeof window !== "undefined") {
  window.__lottery = { getLottery };
}

export async function getOwner() {
  const c = await getLottery(true);
  return await c.owner();
}
