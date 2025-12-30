import { useEffect, useRef, useState } from "react";
import { ethers } from "ethers";
import { getLottery } from "../utils/web3";
import { estimateAndSend, normalizeTxError } from "../utils/tx";

export default function LotteryPanel({ account }) {
  const [ticketPrice, setTicketPrice] = useState("...");
  const [pot, setPot] = useState("...");
  const [players, setPlayers] = useState("...");
  const [lastWinner, setLastWinner] = useState("...");
  const [lastPrize, setLastPrize] = useState("...");
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");

  // previne refresh suprapus (dacă RPC e lent / rate limited)
  const refreshingRef = useRef(false);

  async function refresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;

    try {
      setError("");
      const c = await getLottery(true);

      // rulează în paralel -> mai rapid (mai puține șanse să se suprapună intervalele)
      const [tp, potWei, cnt, w, lp] = await Promise.all([
        c.ticketPrice(),
        c.getPot(),
        c.getPlayersCount(),
        c.lastWinner(),
        c.lastPrize(),
      ]);

      setTicketPrice(ethers.formatEther(tp));
      setPot(ethers.formatEther(potWei));
      setPlayers(cnt.toString());
      setLastWinner(w);
      setLastPrize(ethers.formatEther(lp));
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Refresh failed");
    } finally {
      refreshingRef.current = false;
    }
  }

  async function buyTicket() {
    try {
      setError("");
      setTx("Sending transaction...");

      const c = await getLottery(false);
      const tp = await c.ticketPrice();

      const txResp = await c.buyTicket({ value: tp }); // ✅ fără helper
      setTx(`Pending... ${txResp.hash}`);

      await txResp.wait();
      setTx("Confirmed ✅");
      await refresh();
    } catch (e) {
      setTx("");
      setError(normalizeTxError(e));
    }
  }


  async function withdrawPrize() {
    try {
      setError("");
      setTx("Preparing (estimating gas)...");
      const c = await getLottery(false);

      const { txResp, gasEstimate, estCostEth } = await estimateAndSend({
        contract: c,
        method: "withdrawPrize",
      });

      setTx(
        `Gas ${gasEstimate.toString()} | Est fee ~ ${estCostEth} ETH | Pending... ${txResp.hash}`
      );
      await txResp.wait();

      setTx("Confirmed ✅");
      await refresh();
    } catch (e) {
      setTx("");
      setError(normalizeTxError(e));
    }
  }

  useEffect(() => {
    refresh();

    // 10s e mult mai safe pentru Infura free tier
    const id = setInterval(refresh, 10_000);

    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ border: "1px solid #333", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>Lottery</h3>

      <div><b>Ticket price:</b> {ticketPrice} ETH</div>
      <div><b>Pot:</b> {pot} ETH</div>
      <div><b>Players:</b> {players}</div>

      <hr />

      <div><b>Last winner:</b> {lastWinner}</div>
      <div><b>Last prize:</b> {lastPrize} ETH</div>

      <hr />

      <button onClick={buyTicket} disabled={!account}>Buy ticket</button>
      <button onClick={withdrawPrize} disabled={!account} style={{ marginLeft: 8 }}>
        Withdraw prize
      </button>

      {tx && <p>{tx}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
