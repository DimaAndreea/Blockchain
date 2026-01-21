import { ethers } from "ethers";

function fmtEth(wei) {
  try {
    return ethers.formatEther(wei ?? 0n);
  } catch {
    return "0";
  }
}

export default function Landing({
  hasMM,
  wrongNetwork,
  chainName,
  expectedChainId,
  onConnect,
  loading,
  status,
}) {
  return (
    <div className="landing">
      <div className="landingInner">
        <div className="brand">LemuMaster's Lottery</div>

        {!hasMM && (
          <div className="landingWarn">
            Install MetaMask to continue.
          </div>
        )}

        {wrongNetwork && (
          <div className="landingWarn">
            Wrong network. Switch to <b>{chainName}</b> ({expectedChainId})
          </div>
        )}

        {status && <div className="landingStatus">{status}</div>}

        <button
          className="cta"
          onClick={onConnect}
          disabled={loading || !hasMM}
        >
          {loading ? "Connecting..." : "Connect Wallet to Win!"}
        </button>

        <div className="landingFoot">
          Chainlink VRF • Chainlink Automation
        </div>
      </div>
    </div>
  );
}

