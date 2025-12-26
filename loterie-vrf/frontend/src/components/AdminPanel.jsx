import { useState } from "react";
import { getLottery } from "../utils/web3";

export default function AdminPanel({ account }) {
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");

  async function requestDraw() {
    try {
      setError("");
      setTx("Sending requestDraw...");
      const c = await getLottery(false);

      const txResp = await c.requestDraw();
      setTx("Pending...");
      await txResp.wait();
      setTx("Confirmed ✅");
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "requestDraw failed (only owner!)");
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
