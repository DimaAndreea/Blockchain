import { ethers } from "ethers";

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

export default function Dashboard({
  // header
  account,
  chainId,
  hasMM,

  // banners
  wrongNetwork,
  chainName,
  expectedChainId,
  status,
  roundPhaseText,

  // state
  state,
  ticketPrice,
  pot,
  players,
  myTickets,
  intervalSec,
  timeLeft,
  roundStarted,
  lastRequestId,
  lastWinner,
  lastPrize,
  isWinner,

  // actions
  loading,
  canBuy,
  canWithdraw,
  onRefresh,
  onBuy,
  onWithdraw,

  // events
  events,
}) {
  const stateLabel = StateLabel[state] || `UNKNOWN(${state})`;

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

          <button className="btn" onClick={onRefresh} disabled={loading}>
            🔄 Refresh
          </button>
        </div>
      </header>

      {wrongNetwork && (
        <div className="banner danger">
          Ești pe rețeaua greșită. Comută pe <b>{chainName}</b> ({expectedChainId}).
        </div>
      )}

      {(status || roundPhaseText) && <div className="banner">{status || roundPhaseText}</div>}
      {status && roundPhaseText && <div className="banner">{roundPhaseText}</div>}

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
              <b>{intervalSec.toString()} sec</b>
            </div>

            <div className="row">
              <span>Time left</span>
              <b>
                {state !== 0
                  ? "—"
                  : !roundStarted
                  ? "— (runda începe la primul bilet)"
                  : `${timeLeft.toString()} sec`}
              </b>
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" onClick={onBuy} disabled={!canBuy}>
              🎟️ Buy ticket
            </button>

            <button className="btn" onClick={onWithdraw} disabled={!canWithdraw}>
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
            Extragerea se face automat (Automation + VRF). Dacă state = <b>CALCULATING</b>, aștepți callback-ul VRF.
            Dacă state = <b>PAID</b>, doar winner poate da withdraw.
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
