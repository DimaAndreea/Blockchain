import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getLottery } from "../utils/web3";

export default function LotteryPanel({ account }) {
  const [ticketPrice, setTicketPrice] = useState("...");
  const [pot, setPot] = useState("...");
  const [players, setPlayers] = useState("...");
  const [lastWinner, setLastWinner] = useState("...");
  const [lastPrize, setLastPrize] = useState("...");
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setError("");
      const c = await getLottery(true);

      const tp = await c.ticketPrice();
      const potWei = await c.getPot();
      const cnt = await c.getPlayersCount();
      const w = await c.lastWinner();
      const lp = await c.lastPrize();

      setTicketPrice(ethers.formatEther(tp));
      setPot(ethers.formatEther(potWei));
      setPlayers(cnt.toString());
      setLastWinner(w);
      setLastPrize(ethers.formatEther(lp));
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Refresh failed");
    }
  }

  async function buyTicket() {
    try {
      setError("");
      setTx("Sending buyTicket...");
      const c = await getLottery(false);
      const tp = await c.ticketPrice();

      const txResp = await c.buyTicket({ value: tp });
      setTx("Pending...");
      await txResp.wait();
      setTx("Confirmed ✅");
      await refresh();
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "buyTicket failed");
    }
  }

  async function withdrawPrize() {
    try {
      setError("");
      setTx("Sending withdrawPrize...");
      const c = await getLottery(false);

      const txResp = await c.withdrawPrize();
      setTx("Pending...");
      await txResp.wait();
      setTx("Confirmed ✅");
      await refresh();
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "withdrawPrize failed");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
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
