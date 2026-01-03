import { useEffect, useRef, useState } from "react";
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
  const [lastEvent, setLastEvent] = useState("");

  const contractRef = useRef(null);

  async function refresh() {
    try {
      setError("");
      const c = await getLottery(true);
      contractRef.current = c;

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
      setTx("Awaiting wallet confirmation...");
      const c = await getLottery(false);

      const tp = await c.ticketPrice();

      // ✅ gas estimate + 20%
      const est = await c.buyTicket.estimateGas({ value: tp });
      const gasLimit = (est * 120n) / 100n;

      const txResp = await c.buyTicket({ value: tp, gasLimit });
      setTx(`Pending... ${txResp.hash}`);

      const receipt = await txResp.wait();
      setTx(`Confirmed ✅ gasUsed=${receipt.gasUsed.toString()}`);
      // refresh se va face și din event, dar îl lăsăm safe:
      await refresh();
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "buyTicket failed");
    }
  }

  async function withdrawPrize() {
    try {
      setError("");
      setTx("Awaiting wallet confirmation...");
      const c = await getLottery(false);

      // ✅ gas estimate + 20%
      const est = await c.withdrawPrize.estimateGas();
      const gasLimit = (est * 120n) / 100n;

      const txResp = await c.withdrawPrize({ gasLimit });
      setTx(`Pending... ${txResp.hash}`);

      const receipt = await txResp.wait();
      setTx(`Confirmed ✅ gasUsed=${receipt.gasUsed.toString()}`);
      await refresh();
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "withdrawPrize failed");
    }
  }

  useEffect(() => {
    let mounted = true;
    let c;

    (async () => {
      try {
        await refresh();

        // ✅ Important: listeners trebuie atașați pe provider (readOnly)
        c = await getLottery(true);
        contractRef.current = c;

        if (!mounted) return;

        const onTicketBought = (buyer, amount, totalPlayers, potWei) => {
          setLastEvent(`TicketBought: ${buyer} (+${amount.toString()})`);
          refresh();
        };

        const onDrawRequested = (requestId, playersCount, potWei) => {
          setLastEvent(`DrawRequested: requestId=${requestId.toString()}`);
          refresh();
        };

        const onWinnerSelected = (winner, prizeWei, randomWord) => {
          setLastEvent(`WinnerSelected: ${winner}, prize=${ethers.formatEther(prizeWei)} ETH`);
          refresh();
        };

        const onPrizeWithdrawn = (winner, amountWei) => {
          setLastEvent(`PrizeWithdrawn: ${winner}, amount=${ethers.formatEther(amountWei)} ETH`);
          refresh();
        };

        c.on("TicketBought", onTicketBought);
        c.on("DrawRequested", onDrawRequested);
        c.on("WinnerSelected", onWinnerSelected);
        c.on("PrizeWithdrawn", onPrizeWithdrawn);

        // cleanup
        return () => {
          c.off("TicketBought", onTicketBought);
          c.off("DrawRequested", onDrawRequested);
          c.off("WinnerSelected", onWinnerSelected);
          c.off("PrizeWithdrawn", onPrizeWithdrawn);
        };
      } catch (e) {
        setError(e?.shortMessage || e?.message || "Listener setup failed");
      }
    })();

    return () => {
      mounted = false;
      if (c?.removeAllListeners) c.removeAllListeners();
    };
    // refacem listeners când se schimbă contul (sau când te reconectezi)
  }, [account]);

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

      <hr />

      <div><b>Last event:</b> {lastEvent || "-"}</div>

      {tx && <p>{tx}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
