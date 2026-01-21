import { CHAIN_NAME, EXPECTED_CHAIN_ID } from "../config";
import { shortAddr } from "../utils/format";

export default function WalletBar({
  hasMM,
  account,
  chainId,
  wrongNetwork,
  loading,
  onConnect,
  onDisconnect,
  onRefresh,
}) {
  return (
    <header className="header">
      <div>
        <div className="title">🎲 Lottery (VRF + Automation)</div>
        <div className="subtitle">
          {account ? `Wallet: ${shortAddr(account)}` : "Wallet: —"} • {chainId ? `Chain: ${chainId}` : "Chain: —"}
        </div>
      </div>

      <div className="walletBox">
        {!hasMM && <div className="pill danger">Instalează MetaMask</div>}

        {account ? (
          <>
            <button className="btn" onClick={onRefresh} disabled={loading}>
              🔄 Refresh
            </button>
            <button className="btn" onClick={onDisconnect} disabled={loading}>
              ⛔ Disconnect
            </button>
          </>
        ) : (
          <button className="btn primary" onClick={onConnect} disabled={loading}>
            {loading ? "Connecting…" : "Connect"}
          </button>
        )}
      </div>

      {wrongNetwork && (
        <div className="banner danger" style={{ marginTop: 12 }}>
          Ești pe rețeaua greșită. Comută pe <b>{CHAIN_NAME}</b> ({EXPECTED_CHAIN_ID}).
        </div>
      )}
    </header>
  );
}
