import { fmtEth, shortAddr } from "../utils/format";

export default function LastRoundCard({ lastWinner, lastPrize, isWinner }) {
  return (
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
        Dacă state = <b>CALCULATING</b>, aștepți callback-ul VRF. Dacă state = <b>PAID</b>, doar winner poate da
        withdraw.
      </div>
    </section>
  );
}
