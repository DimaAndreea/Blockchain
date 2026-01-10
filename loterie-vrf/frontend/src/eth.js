import { ethers } from "ethers";
import abi from "./abi/lotteryAbi.json";
import { CONTRACT_ADDRESS, RPC_HTTP, RPC_WS } from "./config";

// singletons (ca să nu faci 10 conexiuni)
let _injected = null;
let _http = null;
let _ws = null;

export function getInjectedProvider() {
  if (!window.ethereum) return null;
  if (!_injected) _injected = new ethers.BrowserProvider(window.ethereum);
  return _injected;
}

// Read provider:
// - dacă ai MetaMask disponibil => citești prin el (reduce spam către Infura)
// - altfel => fallback pe Infura HTTP (dar cu polling rar)
export function getReadProvider() {
  const inj = getInjectedProvider();
  if (inj) return inj;

  if (!RPC_HTTP) return null;
  if (!_http) {
    _http = new ethers.JsonRpcProvider(RPC_HTTP);
    _http.pollingInterval = 15_000; // IMPORTANT: mai rar, anti rate-limit
  }
  return _http;
}

// Events provider (WS) - doar pentru feed
export function getWsProvider() {
  if (!RPC_WS) return null;
  if (!_ws) _ws = new ethers.WebSocketProvider(RPC_WS);
  return _ws;
}

export function getReadContract() {
  const p = getReadProvider();
  if (!p) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, abi, p);
}

export async function getWriteContract() {
  const p = getInjectedProvider();
  if (!p) return null;
  const signer = await p.getSigner();
  return new ethers.Contract(CONTRACT_ADDRESS, abi, signer);
}

export function getEventsContract() {
  const p = getWsProvider();
  if (!p) return null;
  return new ethers.Contract(CONTRACT_ADDRESS, abi, p);
}
