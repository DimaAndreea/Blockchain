import { ethers } from "ethers";

export function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function fmtEth(wei) {
  try {
    return ethers.formatEther(wei ?? 0n);
  } catch {
    return "0";
  }
}

export const StateLabel = { 0: "OPEN", 1: "CALCULATING", 2: "PAID" };
