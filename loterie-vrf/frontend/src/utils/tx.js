import { ethers } from "ethers";
import { getProvider } from "./web3";

export async function estimateAndSend({
  contract,
  method,
  args = [],
  overrides = {},
  safetyBps = 2000,
}) {
  // ✅ folosește provider-ul contractului (MetaMask pentru write)
  const provider = contract?.runner?.provider;
  if (!provider) throw new Error("No provider on contract runner");

  const feeData = await provider.getFeeData();

  const gasEstimate = await contract[method].estimateGas(...args, overrides);
  const gasLimit = gasEstimate + (gasEstimate * BigInt(safetyBps)) / 10_000n;

  // pt EIP-1559 e mai relevant maxFeePerGas; fallback la gasPrice
  const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;

  const estCostWei = gasEstimate * gasPrice;
  const estCostEth = ethers.formatEther(estCostWei);

  const txResp = await contract[method](...args, { ...overrides, gasLimit });

  return { txResp, gasEstimate, gasLimit, estCostEth };
}


export function normalizeTxError(e) {
  // MetaMask reject
  if (e?.code === 4001) return "Transaction rejected in MetaMask";

  // ethers v6 sometimes puts revert reason in shortMessage
  return e?.shortMessage || e?.message || "Transaction failed";
}
