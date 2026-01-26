import { useEffect, useMemo, useRef, useState } from "react";
import { getReadContract, getWriteContract } from "../eth";
import { isRateLimitErr, errMsg } from "../utils/errors";

export function useLottery({ account, wrongNetwork, setStatus, setLoading }) {
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

  const [myTickets, setMyTickets] = useState(0n);
  const [events, setEvents] = useState([]);

  function pushEvent(label, payload) {
    setEvents((prev) => [{ t: Date.now(), label, payload }, ...prev].slice(0, 10));
  }

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
    if (nextDrawAt === 0n) return 0n;
    if (nowSec >= nextDrawAt) return 0n;
    return nextDrawAt - nowSec;
  }, [state, nextDrawAt, nowSec]);

  // --- refresh anti-spam + backoff
  const refreshInFlight = useRef(false);
  const backoffUntilMs = useRef(0);
  const lastRefreshMs = useRef(0);

  async function refresh({ force = false } = {}) {
    if (!account || wrongNetwork) return;

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
        setStatus?.("MetaMask indisponibil");
        return;
      }

      const [tp, intv, lts, p, pc, st, lw, lp, lr, pp] = await Promise.all([
        c.ticketPrice(),
        c.interval(),
        c.lastTimeStamp(),
        c.getPot(),
        c.getPlayersCount(),
        c.state(),
        c.lastWinner(),
        c.lastPrize(),
        c.lastRequestId(),
        c.previousPrize(),
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

      const mt = await c.ticketsByAddress(account);
      setMyTickets(mt ?? 0n);
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) {
        setStatus?.("Rate limited (429). Pauză 10–15s…");
        backoffUntilMs.current = Date.now() + 12_000;
      } else {
        setStatus?.(errMsg(e, "Refresh failed"));
      }
    } finally {
      refreshInFlight.current = false;
    }
  }

  // polling
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

  // listen to on-chain events and update ui (observer pattern)
  useEffect(() => {
    if (!account || wrongNetwork) return;
    const c = getReadContract();
    if (!c || !c.on) return;

    const onTicket = (buyer, amount, totalPlayers, pot) => {
      try {
        pushEvent("TicketBought", { buyer, amount: amount?.toString?.() ?? amount, totalPlayers: totalPlayers?.toString?.() ?? totalPlayers, pot: pot?.toString?.() ?? pot });
      } catch {}
      void refresh({ force: true });
    };

    const onRandomnessRequested = (requestId) => {
      pushEvent("RandomnessRequested", { requestId: requestId?.toString?.() ?? requestId });
    };

    const onWinner = (winner, prize, randomWord) => {
      try {
        pushEvent("WinnerSelected", { winner, prize: prize?.toString?.() ?? prize, randomWord: randomWord?.toString?.() ?? randomWord });
      } catch {}
      void refresh({ force: true });
    };

    const onPrizeWithdrawn = (winner, amount) => {
      try {
        pushEvent("PrizeWithdrawn", { winner, amount: amount?.toString?.() ?? amount });
      } catch {}
      void refresh({ force: true });
    };

    c.on("TicketBought", onTicket);
    c.on("RandomnessRequested", onRandomnessRequested);
    c.on("WinnerSelected", onWinner);
    c.on("PrizeWithdrawn", onPrizeWithdrawn);

    return () => {
      try {
        c.removeListener("TicketBought", onTicket);
        c.removeListener("RandomnessRequested", onRandomnessRequested);
        c.removeListener("WinnerSelected", onWinner);
        c.removeListener("PrizeWithdrawn", onPrizeWithdrawn);
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, wrongNetwork]);

  async function buyTicket() {
    setStatus?.("");
    try {
      setLoading?.(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");

      // estimate gas and add margin
      let tx;
      try {
        const est = await c.estimateGas.buyTicket({ value: ticketPrice });
        const gasLimit = est * 120n / 100n; // +20%
        tx = await c.buyTicket({ value: ticketPrice, gasLimit });
      } catch (e) {
        // fallback without gasLimit if estimate fails
        tx = await c.buyTicket({ value: ticketPrice });
      }
      pushEvent("TxSent", { type: "buyTicket", hash: tx.hash });
      setStatus?.("buyTicket trimis…");

      await tx.wait();
      pushEvent("TxMined", { type: "buyTicket", hash: tx.hash });
      setStatus?.("Bilet cumpărat");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus?.("Rate limited (429). Așteaptă 10–20s.");
      else setStatus?.(errMsg(e, "Buy failed"));
    } finally {
      setLoading?.(false);
    }
  }

  async function runUpkeep() {
    setStatus?.("");
    try {
      setLoading?.(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");

      let tx;
      try {
        const est = await c.estimateGas.performUpkeep("0x");
        const gasLimit = est * 120n / 100n;
        tx = await c.performUpkeep("0x", { gasLimit });
      } catch (e) {
        tx = await c.performUpkeep("0x");
      }
      pushEvent("TxSent", { type: "performUpkeep", hash: tx.hash });
      setStatus?.("performUpkeep trimis…");

      await tx.wait();
      pushEvent("TxMined", { type: "performUpkeep", hash: tx.hash });
      setStatus?.("Upkeep confirmat (așteptăm VRF)");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus?.("Rate limited (429). Așteaptă 10–20s.");
      else setStatus?.(errMsg(e, "Upkeep failed"));
    } finally {
      setLoading?.(false);
    }
  }

  async function withdraw() {
    setStatus?.("");
    try {
      setLoading?.(true);
      const c = await getWriteContract();
      if (!c) throw new Error("MetaMask indisponibil");

      let tx;
      try {
        const est = await c.estimateGas.withdrawPrize();
        const gasLimit = est * 120n / 100n;
        tx = await c.withdrawPrize({ gasLimit });
      } catch (e) {
        tx = await c.withdrawPrize();
      }
      pushEvent("TxSent", { type: "withdrawPrize", hash: tx.hash });
      setStatus?.("withdrawPrize trimis…");

      await tx.wait();
      pushEvent("TxMined", { type: "withdrawPrize", hash: tx.hash });
      setStatus?.("Premiu retras");

      await refresh({ force: true });
    } catch (e) {
      console.error(e);
      if (isRateLimitErr(e)) setStatus?.("Rate limited (429). Așteaptă 10–20s.");
      else setStatus?.(errMsg(e, "Withdraw failed"));
    } finally {
      setLoading?.(false);
    }
  }

  return {
    // reads
    ticketPrice,
    intervalSec,
    lastTimeStamp,
    pot,
    players,
    state,
    lastWinner,
    lastPrize,
    previousPrize,
    lastRequestId,
    myTickets,
    events,

    // derived
    timeLeft,

    // actions
    refresh,
    buyTicket,
    runUpkeep,
    withdraw,
  };
}
