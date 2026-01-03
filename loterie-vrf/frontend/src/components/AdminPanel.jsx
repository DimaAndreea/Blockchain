import { useEffect, useState } from "react";
import { getLottery, getRandomnessProvider, makeDemoRandomWord } from "../utils/web3";

export default function AdminPanel({ account }) {
  const [tx, setTx] = useState("");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("0");
  const [randomWord, setRandomWord] = useState("");

  async function refreshAdmin() {
    try {
      setError("");
      const c = await getLottery(true);
      const rid = await c.requestId();
      setRequestId(rid.toString());
    } catch (e) {
      setError(e?.shortMessage || e?.message || "Admin refresh failed");
    }
  }

  async function requestDraw() {
    try {
      setError("");
      setTx("Awaiting wallet confirmation...");
      const c = await getLottery(false);

      const est = await c.requestDraw.estimateGas();
      const gasLimit = (est * 120n) / 100n;

      const txResp = await c.requestDraw({ gasLimit });
      setTx(`Pending... ${txResp.hash}`);

      const receipt = await txResp.wait();
      setTx(`Confirmed ✅ gasUsed=${receipt.gasUsed.toString()}`);
      await refreshAdmin();
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "requestDraw failed (only owner!)");
    }
  }

  async function deliverRandom() {
    try {
      setError("");
      setTx("Awaiting wallet confirmation...");

      const rid = BigInt(requestId || "0");
      if (rid === 0n) {
        setTx("");
        setError("No requestId yet. Click Request draw first.");
        return;
      }

      const p = await getRandomnessProvider(false);

      // if user didn't provide one, generate
      const rw = randomWord?.trim()
        ? BigInt(randomWord.trim())
        : makeDemoRandomWord();

      // gas estimate + 20%
      const est = await p.deliverRandom.estimateGas(rid, rw);
      const gasLimit = (est * 120n) / 100n;

      const txResp = await p.deliverRandom(rid, rw, { gasLimit });
      setTx(`Pending... ${txResp.hash}`);

      const receipt = await txResp.wait();
      setTx(`Confirmed ✅ gasUsed=${receipt.gasUsed.toString()}`);
    } catch (e) {
      setTx("");
      setError(e?.shortMessage || e?.message || "deliverRandom failed (only provider owner!)");
    }
  }

  useEffect(() => {
    refreshAdmin();
    const id = setInterval(refreshAdmin, 2000);
    return () => clearInterval(id);
  }, [account]);

  return (
    <div style={{ border: "1px solid #333", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>Admin</h3>
      <p style={{ marginTop: 0 }}>
        Flow: Request draw → Deliver random → WinnerSelected → Withdraw.
      </p>

      <div><b>Current requestId:</b> {requestId}</div>

      <hr />

      <button onClick={requestDraw} disabled={!account}>
        Request draw
      </button>

      <hr />

      <div style={{ marginBottom: 6 }}>
        <b>Random word (optional):</b>
      </div>
      <input
        style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #444", background: "transparent", color: "inherit" }}
        placeholder="Leave empty to auto-generate"
        value={randomWord}
        onChange={(e) => setRandomWord(e.target.value)}
        disabled={!account}
      />

      <button onClick={deliverRandom} disabled={!account} style={{ marginTop: 8 }}>
        Deliver random
      </button>

      {tx && <p>{tx}</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
