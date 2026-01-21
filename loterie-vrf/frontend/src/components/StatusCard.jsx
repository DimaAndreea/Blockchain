import { fmtEth, StateLabel } from "../utils/format";

export default function StatusCard({
  state,
  ticketPrice,
  pot,
  players,
  myTickets,
  intervalSec,
  timeLeft,
  lastRequestId,
  canBuy,
  canUpkeep,
  canWithdraw,
  loading,
  onBuy,
  onUpkeep,
  onWithdraw,
}) {
  const stateLabel = StateLabel[state] || `UNKNOWN(${state})`;

  return (
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
          <b>{state === 0 ? `${timeLeft.toString()} sec` : "—"}</b>
        </div>
      </div>

      <div className="actions">
        <button className="btn primary" onClick={onBuy} disabled={!canBuy || loading}>
          🎟️ Buy ticket
        </button>

        <button
          className="btn"
          onClick={onUpkeep}
          disabled={!canUpkeep || loading}
          title="Dev/Test: performUpkeep('0x')"
        >
          ⚙️ Run upkeep (dev)
        </button>

        <button className="btn" onClick={onWithdraw} disabled={!canWithdraw || loading}>
          💸 Withdraw (winner)
        </button>
      </div>

      <div className="small">
        lastRequestId: <b>{lastRequestId.toString()}</b>
      </div>
    </section>
  );
}
