import { useEffect, useMemo, useRef, useState } from "react";
import { getInjectedProvider, getReadContract, getWriteContract } from "./eth";
import { CHAIN_NAME, EXPECTED_CHAIN_ID } from "./config";
import "./App.css";

import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";

function isRateLimitErr(e) {
  const msg = String(e?.shortMessage || e?.reason || e?.message || "").toLowerCase();
  const code = e?.code;
  const status = e?.info?.error?.code || e?.status || e?.info?.status;
  return (
    code === -32005 ||
    status === 429 ||
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("missing response for request") ||
    msg.includes("could not coalesce")
  );
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

  // countdown
  const [nowSec, setNowSec] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  useEffect(() => {
    const t = setInterval(() => setNowSec(BigInt(Math.floor(Date.now() / 1000))), 1000);
    return () => clearInterval(t);
  }, []);

  const nextDrawAt = useMemo(() => {
    try {
      return lastTimeStamp + intervalSec;
    } catch {
      return 0n;
    }
  }, [lastTimeStamp, intervalSec]);

  const timeLeft = useMemo(() => {
    // timerul contează doar când runda e OPEN și a pornit
    if (state !== 0) return 0n;
    if (lastTimeStamp === 0n) return 0n;
    if (nextDrawAt === 0n) return 0n;
    if (nowSec >= nextDrawAt) return 0n;
    return nextDrawAt - nowSec;
  }, [state, lastTimeStamp, nextDrawAt, nowSec]);

  const roundStarted = useMemo(() => players > 0n && lastTimeStamp > 0n, [players, lastTimeStamp]);

  const roundPhaseText = useMemo(() => {
    if (state === 1) return "⏳ Runda s-a încheiat. Se extrage câștigătorul (Automation + VRF)…";
    if (state === 2) return "🏆 Câștigător extras. Winner poate retrage premiul.";
    // OPEN
    if (!roundStarted) return "🟢 Runda nu a început încă. Cumpără primul bilet ca să pornești timer-ul.";
    if (timeLeft > 0n) return `🎟️ Rundă deschisă: mai poți cumpăra bilete încă ${timeLeft.toString()} sec.`;
    return "⛔ Runda s-a încheiat. Așteptăm extragerea automată (Automation + VRF)…";
  }, [state, roundStarted, timeLeft]);

  function pushEvent(label, payload) {
    setEvents((prev) => {
      const next = [{ t: Date.now(), label, payload }, ...prev];
      return next.slice(0, 10);
    });
  }

  // --- refresh anti-spam + backoff
  const refreshInFlight = useRef(false);
  const backoffUntilMs = useRef(0);
  const lastRefreshMs = useRef(0);

  async function refresh({ force = false } = {}) {
    if (!force) {
      if (Date.now() - lastRefreshMs.current < 800) return;
    }
    if (Date.now() < backoffUntilMs.current) return;
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    lastRefreshMs.current = Date.now();

    try {
      const c = getReadContract();
      if (!c) {
        setStatus("MetaMask indisponibil");
        return;
      }

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

      const stNum = Number(st ?? 0);
      setState(stNum);
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
      if (isRateLimitErr(e)) {
        setStatus("Rate limited (429). Pauză 10–15s…");
        backoffUntilMs.current = Date.now() + 12_000;
      } else {
        setStatus(e?.shortMessage || e?.reason || e?.message || "Refresh failed");
      }
    } finally {
      refreshInFlight.current = false;
    }
  }

  // polling: OPEN la 4s, CALCULATING la 1.5s
  useEffect(() => {
    if (!account || wrongNetwork) return;

    const base = 4000;
    const fast = 1500;

    const tick = async () => {
      await refresh();
    };

    tick();

    const id = setInterval(tick, state === 1 ? fast : base);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, wrongNetwork, state]);

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

      await refresh({ force: true });
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

      const tx = await c.buyTicket({ value: ticketPrice });
      pushEvent("TxSent", { type: "buyTicket", hash: tx.hash });
      setStatus("buyTicket trimis…");

      await tx.wait();
      pushEvent("TxMined", { type: "buyTicket", hash: tx.hash });
      setStatus("Bilet cumpărat 🎟️");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus("Rate limited (429). Așteaptă 10–20s.");
      else setStatus(e?.shortMessage || e?.reason || e?.message || "Buy failed");
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

      const tx = await c.withdrawPrize();
      pushEvent("TxSent", { type: "withdrawPrize", hash: tx.hash });
      setStatus("withdrawPrize trimis…");

      await tx.wait();
      pushEvent("TxMined", { type: "withdrawPrize", hash: tx.hash });
      setStatus("Premiu retras 💸. Runda s-a resetat.");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus("Rate limited (429). Așteaptă 10–20s.");
      else setStatus(e?.shortMessage || e?.reason || e?.message || "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  // init + listeners (NU setăm account automat; conectarea se face prin buton)
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) {
      setHasMM(false);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const net = await provider.getNetwork();
        if (!mounted) return;
        setChainId(`0x${net.chainId.toString(16)}`);
      } catch (e) {
        console.error(e);
      }
    })();

    const onAccounts = (accs) => {
      setAccount(accs?.[0] || null);
      setStatus(accs?.length ? "Cont schimbat" : "Deconectat");
      refresh({ force: true });
    };

    const onChain = (cid) => {
      setChainId(cid);
      setStatus("Network schimbat");
      refresh({ force: true });
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

  // ✅ Buy allowed:
  // - dacă runda NU a început: permitem primul bilet
  // - dacă runda a început: permitem bilete doar cât timp timeLeft > 0
  const canBuy =
    account && !wrongNetwork && !loading && state === 0 && (!roundStarted || timeLeft > 0n);

  const canWithdraw =
    account && !wrongNetwork && !loading && state === 2 && isWinner && lastPrize > 0n;

  // 🔥 Landing + Dashboard
  if (!account) {
    return (
      <Landing
        hasMM={hasMM}
        wrongNetwork={wrongNetwork}
        chainName={CHAIN_NAME}
        expectedChainId={EXPECTED_CHAIN_ID}
        pot={pot}
        onConnect={connect}
        loading={loading}
        status={status}
      />
    );
  }

  return (
    <Dashboard
      account={account}
      chainId={chainId}
      hasMM={hasMM}
      wrongNetwork={wrongNetwork}
      chainName={CHAIN_NAME}
      expectedChainId={EXPECTED_CHAIN_ID}
      status={status}
      roundPhaseText={roundPhaseText}
      state={state}
      ticketPrice={ticketPrice}
      pot={pot}
      players={players}
      myTickets={myTickets}
      intervalSec={intervalSec}
      timeLeft={timeLeft}
      roundStarted={roundStarted}
      lastRequestId={lastRequestId}
      lastWinner={lastWinner}
      lastPrize={lastPrize}
      isWinner={isWinner}
      loading={loading}
      canBuy={canBuy}
      canWithdraw={canWithdraw}
      onRefresh={() => refresh({ force: true })}
      onBuy={buyTicket}
      onWithdraw={withdraw}
      events={events}
    />
  );
}
