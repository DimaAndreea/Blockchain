import { useEffect, useState } from "react";
import { connectWallet, getBalanceEth, hasMetaMask } from "../utils/web3";

export default function ConnectWallet({ onConnected }) {
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");

  async function refresh(acc) {
    const bal = await getBalanceEth(acc);
    setBalance(bal);
  }

  async function handleConnect() {
    try {
      setError("");
      const acc = await connectWallet();
      setAccount(acc);
      await refresh(acc);
      onConnected?.(acc);
    } catch (e) {
      setError(e?.message || "Failed to connect");
    }
  }

  useEffect(() => {
    if (!hasMetaMask()) return;

    const onAccountsChanged = async (accounts) => {
      if (!accounts || accounts.length === 0) {
        setAccount(null);
        setBalance(null);
        onConnected?.(null);
        return;
      }
      setAccount(accounts[0]);
      await refresh(accounts[0]);
      onConnected?.(accounts[0]);
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    return () => window.ethereum.removeListener("accountsChanged", onAccountsChanged);
  }, [onConnected]);

  return (
    <div style={{ border: "1px solid #333", padding: 12, borderRadius: 10 }}>
      <h3 style={{ marginTop: 0 }}>Wallet</h3>

      {!hasMetaMask() && (
        <p style={{ color: "crimson" }}>MetaMask not found. Install it first.</p>
      )}

      {account ? (
        <>
          <div><b>Address:</b> {account}</div>
          <div><b>Balance:</b> {balance} ETH</div>
        </>
      ) : (
        <button onClick={handleConnect} disabled={!hasMetaMask()}>
          Connect MetaMask
        </button>
      )}

      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
