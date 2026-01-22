import { useEffect, useMemo, useRef, useState } from "react";
import { getInjectedProvider, getReadContract, getWriteContract } from "./eth";
import { CHAIN_NAME, EXPECTED_CHAIN_ID } from "./config";
import "./App.css";

import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import RoundNotification from "./components/RoundNotification";

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

  // notification state
  const [showNotification, setShowNotification] = useState(null); // null | 'win' | 'lose'
  const [prevState, setPrevState] = useState(0);

  // reads
  const [ticketPrice, setTicketPrice] = useState(0n);
  const [intervalSec, setIntervalSec] = useState(0n);
  const [lastTimeStamp, setLastTimeStamp] = useState(0n);

  const [pot, setPot] = useState(0n);
  const [players, setPlayers] = useState(0n);

  const [state, setState] = useState(0);
  const [lastWinner, setLastWinner] = useState(null);
  const [lastPrize, setLastPrize] = useState(0n);
  const [previousPrize, setPreviousPrize] = useState(0n);
  const [lastRequestId, setLastRequestId] = useState(0n);

  // ✅ new: tickets split
  const [myTicketsAllTime, setMyTicketsAllTime] = useState(0n);
  const [myTicketsRound, setMyTicketsRound] = useState(0n);

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
    if (state !== 0) return 0n;
    if (lastTimeStamp === 0n) return 0n;
    if (nextDrawAt === 0n) return 0n;
    if (nowSec >= nextDrawAt) return 0n;
    return nextDrawAt - nowSec;
  }, [state, lastTimeStamp, nextDrawAt, nowSec]);

  const roundStarted = useMemo(() => players > 0n && lastTimeStamp > 0n, [players, lastTimeStamp]);

  const roundPhaseText = useMemo(() => {
    // state: 0 OPEN, 1 CALCULATING, 2 PAID
    if (state === 1) return "Drawing a random winner using Chainlink VRF. Please wait.";
    if (state === 2) {
      if (isWinner && lastPrize > 0n) return "You won. Claim your prize to withdraw your reward.";
      return "Winner selected. The winner can now claim the prize.";
    }
    if (!roundStarted) return "Round not started yet. Buy the first ticket to start the countdown.";
    if (timeLeft > 0n) return `Tickets are on sale. Sales end in ${timeLeft.toString()}s.`;
    return "Ticket sales are closed. The draw will start automatically shortly.";
  }, [state, roundStarted, timeLeft, isWinner, lastPrize]);

  // detect round end and show notification
  useEffect(() => {
    // rond s-a terminat (state a ajuns 2 = PAID)
    if (prevState !== 2 && state === 2 && roundStarted && myTicketsRound > 0n) {
      if (isWinner) {
        setShowNotification("win");
      } else {
        setShowNotification("lose");
      }
    }
    setPrevState(state);
  }, [state, prevState, roundStarted, myTicketsRound, isWinner]);

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

  // ✅ helper: compute round tickets from TicketBought logs since lastTimeStamp
  async function computeMyRoundTickets({ c, addr, lts }) {
    if (!addr) return 0n;
    if (!lts || lts === 0n) return 0n;

    // try to get a provider from the read contract runner/provider
    const provider =
      c?.runner?.provider ||
      c?.runner ||
      getInjectedProvider();

    if (!provider?.getBlockNumber) return 0n;

    const latest = await provider.getBlockNumber();

    // window: last 20k blocks (safe-ish for local/dev; adjust if you want)
    const fromBlock = Math.max(0, latest - 20000);

    let logs = [];
    try {
      // ethers v6: event filter by indexed buyer
      const boughtFilter = c.filters.TicketBought(addr);
      logs = await c.queryFilter(boughtFilter, fromBlock, latest);
    } catch (e) {
      console.warn("queryFilter TicketBought failed", e);
      return 0n;
    }

    // cache blocks to avoid repeated fetch
    const blockCache = new Map();
    let count = 0n;

    for (const ev of logs) {
      const bn = ev.blockNumber;
      if (!blockCache.has(bn)) {
        const blk = await provider.getBlock(bn);
        blockCache.set(bn, blk?.timestamp ?? 0);
      }
      const ts = BigInt(blockCache.get(bn) || 0);
      if (ts >= lts) count += 1n;
    }

    return count;
  }

  async function refresh({ force = false } = {}) {
    if (!force) {
      if (Date.now() - lastRefreshMs.current < 500) return; // aggressive throttle
    }
    if (Date.now() < backoffUntilMs.current) return;
    if (refreshInFlight.current) return;

    refreshInFlight.current = true;
    lastRefreshMs.current = Date.now();

    try {
      const c = getReadContract();
      if (!c) {
        setStatus("MetaMask is unavailable.");
        return;
      }

      const [tp, intv, lts, p, pc, st, lw, lp, pp, lr] = await Promise.all([
        c.ticketPrice(),
        c.interval(),
        c.lastTimeStamp(),
        c.getPot(),
        c.getPlayersCount(),
        c.state(),
        c.lastWinner(),
        c.lastPrize(),
        c.previousPrize(),
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
      setPreviousPrize(pp ?? 0n);
      setLastRequestId(lr ?? 0n);

      // ✅ tickets: all-time + this round
      if (account) {
        // skip round ticket query if we're in CALCULATING state (expensive operation)
        // we'll check again on next refresh after state changes
        const shouldCheckRound = state !== 1;
        
        const allTime = await c.ticketsByAddress(account);
        let roundCt = myTicketsRound; // keep previous value if in CALCULATING state

        if (shouldCheckRound) {
          roundCt = await computeMyRoundTickets({ c, addr: account, lts: lts ?? 0n });
        }

        setMyTicketsAllTime(allTime ?? 0n);

        // if round not started, show 0 for round tickets
        const roundStartedNow = (pc ?? 0n) > 0n && (lts ?? 0n) > 0n;
        setMyTicketsRound(roundStartedNow ? (roundCt ?? 0n) : 0n);
      } else {
        setMyTicketsAllTime(0n);
        setMyTicketsRound(0n);
      }
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) {
        setStatus("Rate limited (429). Pausing for 10–15 seconds.");
        backoffUntilMs.current = Date.now() + 12_000;
      } else {
        setStatus(e?.shortMessage || e?.reason || e?.message || "Refresh failed");
      }
    } finally {
      refreshInFlight.current = false;
    }
  }

  // polling: OPEN la 2.5s, CALCULATING la 700ms (aggressive for faster response)
  useEffect(() => {
    if (!account || wrongNetwork) return;

    const base = 2500; // check every 2.5s when waiting for round to end
    const fast = 700; // check every 700ms when VRF is calculating

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
      setStatus("Connected.");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      setStatus(e?.shortMessage || e?.message || "Connect failed");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setAccount(null);
    setStatus("Disconnected.");
    setMyTicketsAllTime(0n);
    setMyTicketsRound(0n);
  }

  async function buyTicket() {
    setStatus("");
    try {
      setLoading(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask is unavailable.");

      const tx = await c.buyTicket({ value: ticketPrice });
      pushEvent("TxSent", { type: "buyTicket", hash: tx.hash });
      setStatus("Transaction sent: buyTicket.");

      await tx.wait();
      pushEvent("TxMined", { type: "buyTicket", hash: tx.hash });
      setStatus("Ticket purchased.");
      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus("Rate limited (429). Please wait 10–20 seconds.");
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
      if (!c) throw new Error("MetaMask is unavailable.");

      const tx = await c.withdrawPrize();
      pushEvent("TxSent", { type: "withdrawPrize", hash: tx.hash });
      setStatus("Transaction sent: withdrawPrize.");

      await tx.wait();
      pushEvent("TxMined", { type: "withdrawPrize", hash: tx.hash });
      setStatus("Prize withdrawn. The round has been reset.");
      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus("Rate limited (429). Please wait 10–20 seconds.");
      else setStatus(e?.shortMessage || e?.reason || e?.message || "Withdraw failed");
    } finally {
      setLoading(false);
    }
  }

  // init + listeners
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
      setStatus(accs?.length ? "Account changed." : "Disconnected.");
      refresh({ force: true });
    };

    const onChain = (cid) => {
      setChainId(cid);
      setStatus("Network changed.");
      refresh({ force: true });
    };

    window.ethereum?.on?.("accountsChanged", onAccounts);
    window.ethereum?.on?.("chainChanged", onChain);

    return () => {
      mounted = false;
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canBuy = account && !wrongNetwork && !loading && state === 0 && (!roundStarted || timeLeft > 0n);
  const canWithdraw = account && !wrongNetwork && !loading && state === 2 && isWinner && lastPrize > 0n;

  if (!account) {
    return (
      <Landing
        hasMM={hasMM}
        wrongNetwork={wrongNetwork}
        chainName={CHAIN_NAME}
        expectedChainId={EXPECTED_CHAIN_ID}
        onConnect={connect}
        loading={loading}
        status={status}
      />
    );
  }

  return (
    <>
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
        myTicketsRound={myTicketsRound}
        myTicketsAllTime={myTicketsAllTime}
        intervalSec={intervalSec}
        timeLeft={timeLeft}
        roundStarted={roundStarted}
        lastRequestId={lastRequestId}
        lastWinner={lastWinner}
        lastPrize={lastPrize}
        previousPrize={previousPrize}
        isWinner={isWinner}
        loading={loading}
        canBuy={canBuy}
        canWithdraw={canWithdraw}
        onBuy={buyTicket}
        onWithdraw={withdraw}
        onLogout={logout}
        events={events}
      />
      {showNotification && (
        <RoundNotification
          isWinner={showNotification === "win"}
          onClose={() => setShowNotification(null)}
        />
      )}
    </>
  );
}
