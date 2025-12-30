import { useState } from "react";
import { getLottery } from "../utils/web3";
import { estimateAndSend, normalizeTxError } from "../utils/tx";

export default function AdminPanel({ account }) {
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");

  async function requestDraw() {
    try {
      setError("");
      setTx("Preparing (estimating gas)...");
      const c = await getLottery(false);

      const { txResp, gasEstimate, estCostEth } = await estimateAndSend({
        contract: c,
        method: "requestDraw",
      });

      setTx(
        `Gas ${gasEstimate.toString()} | Est fee ~ ${estCostEth} ETH | Pending... ${txResp.hash}`
      );
      await txResp.wait();

      setTx("Confirmed ✅");
    } catch (e) {
      setTx("");
      // include a hint for owner-only without hiding real error
      const msg = normalizeTxError(e);
      setError(msg.includes("owner") ? msg : `${msg} (only owner?)`);
    }
  }

  return (
    <div style={{ border: "1px solid #333", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>Admin</h3>
      <p style={{ marginTop: 0 }}>Only owner can request draw.</p>

      <button onClick={requestDraw} disabled={!account}>
        Request draw
      </button>

      {tx && <p>{tx}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
