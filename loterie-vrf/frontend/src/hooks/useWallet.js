import { useEffect, useMemo, useState } from "react";
import { getInjectedProvider } from "../eth";
import { EXPECTED_CHAIN_ID } from "../config";
import { errMsg } from "../utils/errors";

export function useWallet() {
  const [hasMM, setHasMM] = useState(true);
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const wrongNetwork = useMemo(() => {
    if (!chainId) return false;
    return chainId.toLowerCase() !== EXPECTED_CHAIN_ID.toLowerCase();
  }, [chainId]);

  // Init: doar detectăm chainId, NU setăm account automat
  useEffect(() => {
    const provider = getInjectedProvider();
    if (!provider) {
      setHasMM(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        const net = await provider.getNetwork();
        if (!alive) return;
        setChainId(`0x${net.chainId.toString(16)}`);
      } catch {
        // ignore
      }
    })();

    const onAccounts = (accs) => {
      // dacă user schimbă contul după ce e conectat, actualizăm
      setAccount(accs?.[0] || null);
      setStatus(accs?.length ? "Cont schimbat" : "Deconectat");
    };

    const onChain = (cid) => {
      setChainId(cid);
      setStatus("Network schimbat");
    };

    window.ethereum?.on?.("accountsChanged", onAccounts);
    window.ethereum?.on?.("chainChanged", onChain);

    return () => {
      alive = false;
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, []);

  async function connect() {
    setStatus("");
    const provider = getInjectedProvider();
    if (!provider) {
      setHasMM(false);
      return;
    }

    try {
      setLoading(true);
      const accs = await provider.send("eth_requestAccounts", []);
      const net = await provider.getNetwork();
      setAccount(accs?.[0] || null);
      setChainId(`0x${net.chainId.toString(16)}`);
      setStatus("Conectat ✅");
    } catch (e) {
      setStatus(errMsg(e, "Conectare anulată"));
    } finally {
      setLoading(false);
    }
  }

  // “Disconnect” local (reset UI). Nu poate forța MetaMask să uite permisiunea.
  function disconnect() {
    setAccount(null);
    setStatus("Deconectat (local)");
  }

  return {
    hasMM,
    account,
    chainId,
    wrongNetwork,
    status,
    setStatus,
    loading,
    connect,
    disconnect,
  };
}
