import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { getAddress, type Address } from "viem";
import { useWallet } from "../wallet/WalletContext";
import {
  getStoredKeeperWallet,
  generateKeeperWallet,
  importKeeperWallet,
  clearKeeperWallet,
  fetchKeeperGasBalance,
  fundKeeperGas,
  type StoredKeeperData,
  type KeeperBalanceInfo,
} from "../services/trading/keeper-manager";
import {
  getBoundKeeper,
  resolveProxyTraderAddress,
  sendSetKeeperTransaction,
  sendRemoveKeeperTransaction,
} from "../contracts/proxy-trader";
import { useActivePair } from "./ActivePairContext";

export interface KeeperContextState {
  keeper: StoredKeeperData | null;
  keeperBalance: KeeperBalanceInfo | null;
  isRefreshingBalance: boolean;
  boundKeeperOnChain: Address | null;
  isBoundToCurrentProxy: boolean;
  isCheckingBinding: boolean;
  isSilentEnabled: boolean;
  setIsSilentEnabled: (enabled: boolean) => void;
  proxyAddress: Address;
  generateNewKeeper: () => StoredKeeperData;
  importKeeper: (rawPrivateKey: string) => StoredKeeperData;
  removeKeeper: () => void;
  refreshBalance: () => Promise<void>;
  refreshBinding: () => Promise<void>;
  bindKeeperToProxy: () => Promise<`0x${string}`>;
  unbindKeeperFromProxy: () => Promise<`0x${string}`>;
  fundGas: (amountBnb?: string) => Promise<`0x${string}`>;
}

const KeeperContext = createContext<KeeperContextState | null>(null);

export interface KeeperProviderProps {
  children: ReactNode;
}

export const KeeperProvider: React.FC<KeeperProviderProps> = ({ children }) => {
  const { address: userAddress, provider, chainId } = useWallet();
  const { customContract } = useActivePair();

  // Local Keeper state
  const [keeper, setKeeper] = useState<StoredKeeperData | null>(() =>
    getStoredKeeperWallet()
  );
  const [keeperBalance, setKeeperBalance] = useState<KeeperBalanceInfo | null>(
    null
  );
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // On-chain binding state
  const [boundKeeperOnChain, setBoundKeeperOnChain] = useState<Address | null>(
    null
  );
  const [isCheckingBinding, setIsCheckingBinding] = useState(false);

  // Automation silent toggle
  const [isSilentEnabled, setIsSilentEnabled] = useState<boolean>(() => {
    return localStorage.getItem("uniswap_v2_trader_keeper_silent") === "true";
  });

  const handleSetIsSilentEnabled = (val: boolean) => {
    setIsSilentEnabled(val);
    localStorage.setItem("uniswap_v2_trader_keeper_silent", val ? "true" : "false");
  };

  // Resolve active proxy contract address
  const activeChainId = chainId ?? 97;
  const proxyAddress =
    (customContract.enabled && customContract.contractAddress
      ? resolveProxyTraderAddress(activeChainId, customContract.contractAddress)
      : resolveProxyTraderAddress(activeChainId)) ||
    resolveProxyTraderAddress(97)!;

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!keeper) {
      setKeeperBalance(null);
      return;
    }
    setIsRefreshingBalance(true);
    try {
      const info = await fetchKeeperGasBalance(keeper.address);
      setKeeperBalance(info);
    } catch {
      // transient balance fetch failure
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [keeper]);

  // Refresh on-chain binding
  const refreshBinding = useCallback(async () => {
    if (!userAddress || !proxyAddress) {
      setBoundKeeperOnChain(null);
      return;
    }
    setIsCheckingBinding(true);
    try {
      const bound = await getBoundKeeper(proxyAddress, userAddress as Address);
      setBoundKeeperOnChain(bound);
    } catch {
      setBoundKeeperOnChain(null);
    } finally {
      setIsCheckingBinding(false);
    }
  }, [userAddress, proxyAddress]);

  // Sync on keeper or proxy or wallet change
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    refreshBinding();
  }, [refreshBinding]);

  // Actions
  const generateNewKeeper = () => {
    const created = generateKeeperWallet();
    setKeeper(created);
    return created;
  };

  const importKeeper = (rawKey: string) => {
    const imported = importKeeperWallet(rawKey);
    setKeeper(imported);
    return imported;
  };

  const removeKeeper = () => {
    clearKeeperWallet();
    setKeeper(null);
    setKeeperBalance(null);
    setBoundKeeperOnChain(null);
  };

  const bindKeeperToProxy = async (): Promise<`0x${string}`> => {
    if (!provider || !userAddress) {
      throw new Error("请先连接主钱包");
    }
    if (!keeper) {
      throw new Error("尚未生成打工小号");
    }
    const txHash = await sendSetKeeperTransaction(
      provider,
      userAddress as Address,
      proxyAddress,
      keeper.address
    );
    return txHash;
  };

  const unbindKeeperFromProxy = async (): Promise<`0x${string}`> => {
    if (!provider || !userAddress) {
      throw new Error("请先连接主钱包");
    }
    const txHash = await sendRemoveKeeperTransaction(
      provider,
      userAddress as Address,
      proxyAddress
    );
    return txHash;
  };

  const fundGas = async (amountBnb: string = "0.01"): Promise<`0x${string}`> => {
    if (!provider || !userAddress) {
      throw new Error("请先连接主钱包");
    }
    if (!keeper) {
      throw new Error("尚未生成打工小号");
    }
    const txHash = await fundKeeperGas(
      provider,
      userAddress as Address,
      keeper.address,
      amountBnb
    );
    return txHash;
  };

  const isBoundToCurrentProxy =
    !!keeper &&
    !!boundKeeperOnChain &&
    getAddress(keeper.address) === getAddress(boundKeeperOnChain);

  return (
    <KeeperContext.Provider
      value={{
        keeper,
        keeperBalance,
        isRefreshingBalance,
        boundKeeperOnChain,
        isBoundToCurrentProxy,
        isCheckingBinding,
        isSilentEnabled,
        setIsSilentEnabled: handleSetIsSilentEnabled,
        proxyAddress,
        generateNewKeeper,
        importKeeper,
        removeKeeper,
        refreshBalance,
        refreshBinding,
        bindKeeperToProxy,
        unbindKeeperFromProxy,
        fundGas,
      }}
    >
      {children}
    </KeeperContext.Provider>
  );
};

export function useKeeper(): KeeperContextState {
  const context = useContext(KeeperContext);
  if (!context) {
    throw new Error("useKeeper must be used within a KeeperProvider");
  }
  return context;
}
