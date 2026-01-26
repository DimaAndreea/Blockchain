import { useMemo } from "react";
import { ethers } from "ethers";

function Icon({ name, className = "icon", size = 18 }) {
  const common = {
    className,
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "aria-hidden": true,
  };

  switch (name) {
    case "wallet":
      return (
        <svg {...common}>
          <path
            d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M19 13h2v4h-2a2 2 0 0 1 0-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <path
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 7v5l3 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "trophy":
      return (
        <svg {...common}>
          <path
            d="M8 4h8v3a4 4 0 0 1-8 0V4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M6 7H4a2 2 0 0 0 2 2h1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M18 7h2a2 2 0 0 1-2 2h-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 11v4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 15h4v4h-4v-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8 19h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case "cart":
      return (
        <svg {...common}>
          <path
            d="M6 6h15l-1.5 8.5H7.2L6 6Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M6 6 5.3 3.8H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M18 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path
            d="M10 7V6a2 2 0 0 1 2-2h7v16h-7a2 2 0 0 1-2-2v-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M3 12h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 9l-3 3 3 3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case "cash":
      return (
        <svg {...common}>
          <path
            d="M3 7h18v10H3V7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M7 11a2 2 0 0 0 0 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17 11a2 2 0 0 1 0 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      return null;
  }
}

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

function fmtEthPrecise(wei, decimals = 4) {
  try {
    const value = parseFloat(ethers.formatEther(wei ?? 0n));
    return value.toFixed(decimals);
  } catch {
    return "0";
  }
}

function splitHMS(totalSec) {
  const s = totalSec < 0n ? 0n : totalSec;
  const h = s / 3600n;
  const m = (s % 3600n) / 60n;
  const sec = s % 60n;
  return { h, m, sec };
}

function pad2(x) {
  const n = Number(x ?? 0n);
  return String(n).padStart(2, "0");
}

export default function Dashboard({
  account,
  chainId,
  hasMM,
  wrongNetwork,
  chainName,
  expectedChainId,

  status,
  roundPhaseText,

  state,
  ticketPrice,
  pot,
  players,
  myTicketsRound,
  myTicketsAllTime,
  intervalSec,
  timeLeft,
  roundStarted,

  lastRequestId,
  lastWinner,
  lastPrize,
  previousPrize,
  isWinner,

  loading,
  canBuy,
  canWithdraw,

  onBuy,
  onWithdraw,
  onLogout,

  events,
}) {
  const { h, m, sec } = useMemo(() => splitHMS(timeLeft), [timeLeft]);

  const headerRight = useMemo(() => {
    if (!chainId) return "—";
    return chainId;
  }, [chainId]);

  const phaseLine = useMemo(() => {
    if (wrongNetwork) return `Wrong network. Switch to ${chainName} (${expectedChainId}).`;
    if (!hasMM) return "MetaMask not detected. Please install MetaMask.";
    if (status?.trim()) return status;
    return roundPhaseText || "";
  }, [wrongNetwork, chainName, expectedChainId, hasMM, status, roundPhaseText]);

  const myRound = useMemo(() => (roundStarted ? (myTicketsRound ?? 0n) : 0n), [roundStarted, myTicketsRound]);
  
  const lastRoundPrizeWei = useMemo(() => {
    return state === 2 ? (lastPrize ?? 0n) : (previousPrize ?? 0n);
  }, [state, lastPrize, previousPrize]);

  const lastRoundLabel = useMemo(() => {
    return state === 2 ? "Prize (selected)" : "Prize (paid)";
  }, [state]);


  return (
    <div className="page">
      {/* HEADER */}
      <header className="appHeader">
        <div className="hdrLeft">
          <div className="walletBadge">
            <Icon name="wallet" />
            <div className="walletBadgeText">
              <div className="walletBadgeTop">{shortAddr(account)}</div>
              <div className="walletBadgeSub">Chain: {headerRight}</div>
            </div>
          </div>
        </div>

        <div className="hdrCenter">
          <div className="appTitle">LemuMaster&apos;s Lottery</div>
        </div>

        <div className="hdrRight">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn ghost" onClick={onLogout} disabled={loading}>
              <Icon name="logout" /> Logout
            </button>
          </div>
        </div>
      </header>
      <hr className="hrNeon" />


      {/* small status line 
      {phaseLine?.trim() ? (
        <div className={`statusLine ${wrongNetwork ? "danger" : ""}`}>{phaseLine}</div>
      ) : null}
       */}

      {/* MAIN */}
      <main className="layout">
        {/* HERO */}
        <section className="heroWrap">
            <div className="card hero">
            <div className="heroHeader heroHeaderCentered">
                <div className="heroPot">
                <div className="kicker">Prize pool</div>
                <div className="heroValue">{fmtEth(pot)} ETH</div>
                </div>
            </div>

            <div className="heroCountdown">
                <div className="countCell">
                <div className="countNum">{pad2(h)}</div>
                <div className="countCap">HOURS</div>
                </div>
                <div className="countCell">
                <div className="countNum">{pad2(m)}</div>
                <div className="countCap">MINUTES</div>
                </div>
                <div className="countCell">
                <div className="countNum">{pad2(sec)}</div>
                <div className="countCap">SECONDS</div>
                </div>
            </div>

            <div className="heroHint">
                {canWithdraw ? (
                <span className="accentHint">You won! Withdraw your prize now!</span>
                ) : isWinner && state === 2 ? (
                <span className="accentHint">You're the winner! Waiting for the prize to become available...</span>
                ) : state === 2 ? (
                <span className="accentHint">Round finished. Waiting for winner to withdraw the prize.</span>
                ) : !roundStarted ? (
                <span className="accentHint">Start the round by buying the first ticket.</span>
                ) : state === 1 ? (
                <span className="accentHint">VRF is generating a verifiable random winner.</span>
                ) : timeLeft > 0n ? (
                <span className="accentHint">Tickets are open while the timer runs.</span>
                ) : (
                <span className="accentHint">Time is up. Waiting for automation + VRF.</span>
                )}
            </div>

            {/* <div className="heroMeta">
                <span>
                Interval: <b>{intervalSec.toString()}s</b>
                </span>
                <span className="dot">•</span>
                <span>
                Last request id: <b className="mono">{lastRequestId.toString()}</b>
                </span>
            </div> */}
            </div>
        </section>

        {/* ACTIONS */}
        <aside className="card actions">
          <div className="actionsTop">
            <div className="actionsTitle">Tickets</div>
            <div className="actionsPrice">
              Cost: <b>{fmtEth(ticketPrice)} ETH</b>
            </div>
          </div>

          <div className="actionsBox">
            <div className="row">
              <span className="muted">Players</span>
              <b>{players.toString()}</b>
            </div>

            {/* this round */}
            <div className="row">
              <span className="muted">My tickets</span>
              <b>{myRound.toString()}</b>
            </div>

            {/* all time */}
            <div className="row tiny">
              <span className="muted">All-time tickets</span>
              <b>{(myTicketsAllTime ?? 0n).toString()}</b>
            </div>

            <div className="btnStack">
                <button
                    className={`btn buy ${canBuy ? "primary" : "disabledLook"}`}
                    onClick={onBuy}
                    disabled={!canBuy}
                >
                    <Icon name="cart" /> Buy ticket ({fmtEth(ticketPrice)} ETH)
                </button>

                <button
                    className={`btn withdraw ${canWithdraw ? "primary" : "disabledLook"}`}
                    onClick={onWithdraw}
                    disabled={!canWithdraw}
                >
                    <Icon name="cash" /> Withdraw prize
                </button>
                </div>


            {/* <div className="actionsFoot">
              {canWithdraw ? (
                <span className="good">You are the winner! Withdraw your prize!</span>
              ) : isWinner && lastPrize > 0n ? (
                <span className="muted">You are the winner, but withdrawal isn’t available yet.</span>
              ) : (
                <span className="muted">The winner can withdraw once the draw is completed.</span>
              )}
            </div> */}
          </div>

          <div className="miniCard">
            <div className="miniTitle">
              <Icon name="trophy" /> Last round
            </div>
            <div className="miniRow">
              <span className="muted">Winner</span>
              <b>{shortAddr(lastWinner)}</b>
            </div>
            <div className="miniRow">
              <span className="muted">Prize</span>
              <b>{fmtEthPrecise(lastRoundPrizeWei, 2)} ETH</b>
            </div>
          </div>
        </aside>

        {/* STATS
        <section className="stats">
          <div className="stat">
            <div className="statLabel">Ticket price</div>
            <div className="statValue">{fmtEth(ticketPrice)} ETH</div>
          </div>
          <div className="stat">
            <div className="statLabel">Players</div>
            <div className="statValue">{players.toString()}</div>
          </div>
          <div className="stat">
            <div className="statLabel">My tickets (round)</div>
            <div className="statValue">{myRound.toString()}</div>
          </div>
          <div className="stat">
            <div className="statLabel">All-time tickets</div>
            <div className="statValue">{(myTicketsAllTime ?? 0n).toString()}</div>
          </div>
        </section> */}

        {/* EVENT FEED
        <section className="card feed">
          <div className="feedHead">
            <div className="panelTitle">Event feed</div>
            <div className="muted small">Last 10 tx updates</div>
          </div>

          {events?.length ? (
            <div className="feedList">
              {events.map((e) => (
                <div className="event" key={e.t}>
                  <div className="eventTop">
                    <b>{e.label}</b>
                    <span className="muted small">{new Date(e.t).toLocaleTimeString()}</span>
                  </div>
                  <pre className="pre">{JSON.stringify(e.payload, null, 2)}</pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No events yet.</div>
          )}
        </section> */}
      </main>
    </div>
  );
}
