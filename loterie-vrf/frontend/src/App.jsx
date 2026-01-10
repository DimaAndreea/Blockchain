import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { getInjectedProvider, getReadContract, getWriteContract, getEventsContract } from "./eth";
import { CHAIN_NAME, EXPECTED_CHAIN_ID } from "./config";
import "./App.css";

const StateLabel = { 0: "OPEN", 1: "CALCULATING", 2: "PAID" };

function shortAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtEth(wei) {
  try {
    return ethers.formatEther(wei ?? 0n);
  } catch {
    return "0";
  }
}

export default function App() {
  const [hasMM, setHasMM] = useState(true);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  // reads
  const [ticketPrice, setTicketPrice] = useState(0n);
  const [intervalSec, setIntervalSec] = useState(0n);
  const [lastTimeStamp, setLastTimeStamp] = useState(0n);

  const [pot, setPot] = useState(0n);
  const [players, setPlayers] = useState(0n);

  const [state, setState] = useState(0);
  const [lastWinner, setLastWinner] = useState(null);
  const [lastPrize, setLastPrize] = useState(0n);
  const [lastRequestId, setLastRequestId] = useState(0n);

  const [myTickets, setMyTickets] = useState(0n);
  const [events, setEvents] = useState([]);

  const wrongNetwork = useMemo(() => {
    if (!chainId) return false;
    return chainId.toLowerCase() !== EXPECTED_CHAIN_ID.toLowerCase();
  }, [chainId]);

  const isWinner = useMemo(() => {
    if (!account || !lastWinner) return false;
    return account.toLowerCase() === lastWinner.toLowerCase();
  }, [account, lastWinner]);

  // countdown local
  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const t = setInterval(() => setNowSec(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(t);
  }, []);

  const nextDrawAt = useMemo(() => {
    try {
      return (lastTimeStamp ?? 0n) + (intervalSec ?? 0n);
    } catch {
      return 0n;
    }
  }, [lastTimeStamp, intervalSec]);

  const timeLeft = useMemo(() => {
    if (state !== 0) return 0n;
    if (!nextDrawAt) return 0n;
    if (nowSec >= nextDrawAt) return 0n;
    return nextDrawAt - nowSec;
  }, [state, nextDrawAt, nowSec]);

  function pushEvent(label, payload) {
    setEvents((prev) => [{ t: Date.now(), label, payload }, ...prev].slice(0, 10));
  }

  // --- refresh debounce + lock (ANTI SPAM)
  const refreshTimer = useRef(null);
  const refreshing = useRef(false);

  function scheduleRefresh(ms = 600) {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => refresh(), ms);
  }

  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true;

    try {
      const c = getReadContract();
      if (!c) return;

      const [tp, intv, lts, p, pc, st, lw, lp, lr] = await Promise.all([
        c.ticketPrice(),
        c.interval(),
        c.lastTimeStamp(),
        c.getPot(),
        c.getPlayersCount(),
        c.state(),
        c.lastWinner(),
        c.lastPrize(),
        c.lastRequestId(),
      ]);

      setTicketPrice(tp ?? 0n);
      setIntervalSec(intv ?? 0n);
      setLastTimeStamp(lts ?? 0n);

      setPot(p ?? 0n);
      setPlayers(pc ?? 0n);

      setState(Number(st ?? 0));
      setLastWinner(lw ?? null);
      setLastPrize(lp ?? 0n);
      setLastRequestId(lr ?? 0n);

      if (account) {
        const mt = await c.ticketsByAddress(account);
        setMyTickets(mt ?? 0n);
      } else {
        setMyTickets(0n);
      }
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || "Refresh failed";

      // Mesaj mai “uman” pentru rate limit
      if (String(msg).toLowerCase().includes("too many") || String(msg).includes("429")) {
        setStatus("Rate limit (Infura). Așteaptă 10-20s și încearcă din nou.");
      } else if (String(msg).toLowerCase().includes("rate limited")) {
        setStatus("Rate limit (MetaMask RPC). Așteaptă puțin și încearcă din nou.");
      } else {
        setStatus(msg);
      }
    } finally {
      refreshing.current = false;
    }
  }

  async function connect() {
    setStatus("");
    const provider = getInjectedProvider();
    if (!provider) {
      setHasMM(false);
      return;
    }

    try {
      setLoading(true);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const net = await provider.getNetwork();

      setAccount(addr);
      setChainId(`0x${net.chainId.toString(16)}`);

      setStatus("Conectat ✅");
      scheduleRefresh(200);
    } catch (e) {
      console.error(e);
      setStatus(e?.shortMessage || e?.message || "Connect a eșuat");
    } finally {
      setLoading(false);
    }
  }

  async function buyTicket() {
    setStatus("");
    try {
      setLoading(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");
      if (wrongNetwork) throw new Error(`Schimbă pe ${CHAIN_NAME} (${EXPECTED_CHAIN_ID})`);

      const tx = await c.buyTicket({ value: ticketPrice });
      setStatus("buyTicket trimis…");
      await tx.wait();

      setStatus("Bilet cumpărat 🎟️");
      scheduleRefresh(300);
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || "Buy failed";
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  async function runUpkeep() {
    setStatus("");
    try {
      setLoading(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");
      if (wrongNetwork) throw new Error(`Schimbă pe ${CHAIN_NAME} (${EXPECTED_CHAIN_ID})`);

      const tx = await c.performUpkeep("0x");
      setStatus("performUpkeep trimis… (așteptăm VRF)");
      await tx.wait();

      setStatus("performUpkeep confirmat ✅");
      scheduleRefresh(500);
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || "Upkeep failed";
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  async function withdraw() {
    setStatus("");
    try {
      setLoading(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");
      if (wrongNetwork) throw new Error(`Schimbă pe ${CHAIN_NAME} (${EXPECTED_CHAIN_ID})`);

      const tx = await c.withdrawPrize();
      setStatus("withdrawPrize trimis…");
      await tx.wait();

      setStatus("Premiu retras 💸");
      scheduleRefresh(500);
    } catch (e) {
      console.error(e);
      const msg = e?.shortMessage || e?.reason || e?.message || "Withdraw failed";
      setStatus(msg);
    } finally {
      setLoading(false);
    }
  }

  // init + MM listeners
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) {
      setHasMM(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const accounts = await provider.send("eth_accounts", []);
        const net = await provider.getNetwork();

        if (!mounted) return;
        setChainId(`0x${net.chainId.toString(16)}`);
        if (accounts?.length) setAccount(accounts[0]);

        scheduleRefresh(200);
      } catch (e) {
        console.error(e);
      }
    })();

    const onAccounts = (accs) => {
      setAccount(accs?.[0] || null);
      setStatus(accs?.length ? "Cont schimbat" : "Deconectat");
      scheduleRefresh(300);
    };

    const onChain = (cid) => {
      setChainId(cid);
      setStatus("Network schimbat");
      scheduleRefresh(300);
    };

    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);

    return () => {
      mounted = false;
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WS events (nu face refresh agresiv)
  useEffect(() => {
    const c = getEventsContract();
    if (!c) {
      setStatus((s) => s || "WS indisponibil (verifică RPC_WS)");
      return;
    }

    setStatus((s) => (s ? s : "WS conectat ✅"));

    const onTicketBought = (buyer, amount, totalPlayers, potNow) => {
      pushEvent("TicketBought", {
        buyer,
        amount: amount?.toString?.(),
        totalPlayers: totalPlayers?.toString?.(),
        pot: potNow?.toString?.(),
      });
      // refresh “light”, nu imediat de fiecare dată
      scheduleRefresh(1200);
    };

    const onRandomnessRequested = (requestId) => {
      pushEvent("RandomnessRequested", { requestId: requestId?.toString?.() });
      scheduleRefresh(1200);
    };

    const onWinnerSelected = (winner, prize, randomWord) => {
      pushEvent("WinnerSelected", {
        winner,
        prize: prize?.toString?.(),
        randomWord: randomWord?.toString?.(),
      });
      scheduleRefresh(1500);
    };

    const onPrizeWithdrawn = (winner, amount) => {
      pushEvent("PrizeWithdrawn", { winner, amount: amount?.toString?.() });
      scheduleRefresh(1500);
    };

    c.on("TicketBought", onTicketBought);
    c.on("RandomnessRequested", onRandomnessRequested);
    c.on("WinnerSelected", onWinnerSelected);
    c.on("PrizeWithdrawn", onPrizeWithdrawn);

    return () => {
      c.off("TicketBought", onTicketBought);
      c.off("RandomnessRequested", onRandomnessRequested);
      c.off("WinnerSelected", onWinnerSelected);
      c.off("PrizeWithdrawn", onPrizeWithdrawn);
    };
  }, []);

  const stateLabel = StateLabel[state] || `UNKNOWN(${state})`;

  const canBuy = account && !wrongNetwork && !loading && state === 0;
  const canUpkeep =
    account &&
    !wrongNetwork &&
    !loading &&
    state === 0 &&
    timeLeft === 0n &&
    players > 0n &&
    pot > 0n;

  const canWithdraw = account && !wrongNetwork && !loading && state === 2 && isWinner && lastPrize > 0n;

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="title">🎲 Lottery (VRF + Automation)</div>
          <div className="subtitle">
            {account ? `Wallet: ${shortAddr(account)}` : "Wallet: —"} •{" "}
            {chainId ? `Chain: ${chainId}` : "Chain: —"}
          </div>
        </div>

        <div className="walletBox">
          {!hasMM && <div className="pill danger">Instalează MetaMask</div>}

          {account ? (
            <button className="btn" onClick={() => scheduleRefresh(0)} disabled={loading}>
              🔄 Refresh
            </button>
          ) : (
            <button className="btn primary" onClick={connect} disabled={loading}>
              {loading ? "Connecting…" : "Connect"}
            </button>
          )}
        </div>
      </header>

      {wrongNetwork && (
        <div className="banner danger">
          Ești pe rețeaua greșită. Comută pe <b>{CHAIN_NAME}</b> ({EXPECTED_CHAIN_ID}).
        </div>
      )}

      {status && <div className="banner">{status}</div>}

      <main className="grid">
        <section className="card">
          <div className="cardTitle">Status</div>

          <div className="rows">
            <div className="row">
              <span>State</span>
              <b className={`badge s${state}`}>{stateLabel}</b>
            </div>
            <div className="row">
              <span>Ticket price</span>
              <b>{fmtEth(ticketPrice)} ETH</b>
            </div>
            <div className="row">
              <span>Pot</span>
              <b>{fmtEth(pot)} ETH</b>
            </div>
            <div className="row">
              <span>Players</span>
              <b>{players.toString()}</b>
            </div>
            <div className="row">
              <span>My tickets</span>
              <b>{myTickets.toString()}</b>
            </div>
            <div className="row">
              <span>Interval</span>
              <b>{(intervalSec ?? 0n).toString()} sec</b>
            </div>
            <div className="row">
              <span>Time left</span>
              <b>{state === 0 ? `${timeLeft.toString()} sec` : "—"}</b>
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" onClick={buyTicket} disabled={!canBuy}>
              🎟️ Buy ticket
            </button>

            <button className="btn" onClick={runUpkeep} disabled={!canUpkeep} title="Dev/Test: performUpkeep('0x')">
              ⚙️ Run upkeep (dev)
            </button>

            <button className="btn" onClick={withdraw} disabled={!canWithdraw}>
              💸 Withdraw (winner)
            </button>
          </div>

          <div className="small">
            lastRequestId: <b>{lastRequestId.toString()}</b>
          </div>
        </section>

        <section className="card">
          <div className="cardTitle">Last round</div>

          <div className="rows">
            <div className="row">
              <span>Last winner</span>
              <b>{shortAddr(lastWinner)}</b>
            </div>
            <div className="row">
              <span>Last prize</span>
              <b>{fmtEth(lastPrize)} ETH</b>
            </div>
            <div className="row">
              <span>Winner = you?</span>
              <b>{isWinner ? "YES ✅" : "NO"}</b>
            </div>
          </div>

          <div className="hint">
            Dacă state = <b>CALCULATING</b>, aștepți callback-ul VRF. Dacă state = <b>PAID</b>, doar winner poate da withdraw.
          </div>
        </section>

        <section className="card">
          <div className="cardTitle">Event feed</div>

          {events.length === 0 ? (
            <div className="empty">Încă nu avem evenimente.</div>
          ) : (
            <div className="feed">
              {events.map((e) => (
                <div className="event" key={e.t}>
                  <div className="eventTop">
                    <b>{e.label}</b>
                    <span className="muted">{new Date(e.t).toLocaleTimeString()}</span>
                  </div>
                  <pre className="pre">{JSON.stringify(e.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
