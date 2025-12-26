import { useState } from "react";
import ConnectWallet from "./components/ConnectWallet";
import LotteryPanel from "./components/LotteryPanel";
import AdminPanel from "./components/AdminPanel";

export default function App() {
  const [account, setAccount] = useState(null);

  return (
    <div style={{ maxWidth: 900, margin: "20px auto", fontFamily: "Arial" }}>
      <h2>On-chain Lottery (VRF-style)</h2>

      <div style={{ display: "grid", gap: 12 }}>
        <ConnectWallet onConnected={setAccount} />
        <LotteryPanel account={account} />
        <AdminPanel account={account} />
      </div>
    </div>
  );
}
