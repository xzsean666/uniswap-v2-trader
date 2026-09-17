import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import {
  validatePairAddress,
  fetchPairOverview,
  type PairOverview,
} from "../services/pair/pair-reader";
import {
  backfillPair24hHistory,
  type SyncProgressUpdate,
} from "../services/sync/historical-sync";
import {
  startRealtimePolling,
  stopRealtimePolling,
  isPairPolling,
} from "../services/sync/realtime-poller";
import { syncEvents, type SwapLogPayload } from "../services/sync/event-emitter";
import { SubscriptionStore } from "../storage/subscription-store";
import type { CustomContractConfig } from "../views/swap-monitor/CustomContractPanel";

export interface ActivePairContextState {
  pairAddressInput: string;
  setPairAddressInput: (val: string) => void;
  activePair: PairOverview | null;
  setActivePair: (pair: PairOverview | null) => void;
  isListening: boolean;
  isSyncing: boolean;
  syncProgress: SyncProgressUpdate | null;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  maxDisplayEvents: number;
  setMaxDisplayEvents: (val: number) => void;
  recentEvents: SwapLogPayload[];
  setRecentEvents: React.Dispatch<React.SetStateAction<SwapLogPayload[]>>;
  customContract: CustomContractConfig;
  setCustomContract: React.Dispatch<React.SetStateAction<CustomContractConfig>>;
  startListening: (address?: string) => Promise<void>;
  stopListening: () => Promise<void>;
  refreshPair: () => Promise<void>;
}

const ActivePairContext = createContext<ActivePairContextState | null>(null);

export const ActivePairProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [pairAddressInput, setPairAddressInput] = useState("");
  const [activePair, setActivePair] = useState<PairOverview | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgressUpdate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [maxDisplayEvents, setMaxDisplayEvents] = useState(15);
  const [recentEvents, setRecentEvents] = useState<SwapLogPayload[]>([]);

  const [customContract, setCustomContract] = useState<CustomContractConfig>({
    enabled: false,
    contractAddress: "",
    methodName: "swapExactTokensForTokens",
  });

  // Load existing subscription from store on mount
  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const allSubs = await SubscriptionStore.getAll();
        if (allSubs.length > 0 && mounted) {
          const first = allSubs[0];
          setPairAddressInput(first.pairAddress);

          // Fetch overview
          try {
            const overview = await fetchPairOverview(first.pairAddress);
            if (mounted) {
              setActivePair(overview);
            }
          } catch {
            // Pair overview fetch warning
          }

          if (first.proxyContract) {
            setCustomContract({
              enabled: true,
              contractAddress: first.proxyContract,
              methodName: "swapExactTokensForTokens",
            });
          }

          if (first.status === "active" || isPairPolling(first.pairAddress)) {
            setIsListening(true);
          }
        }
      } catch {
        // Storage lookup fallback
      }
    }

    loadInitial();

    // Listen globally for incoming swaps to keep recentEvents and price updated
    const unbindSwap = syncEvents.on("new_swap", (payload) => {
      setRecentEvents((prev) => [payload, ...prev.slice(0, 49)]);

      if (payload.effectivePrice && payload.effectivePrice > 0) {
        setActivePair((prev) => {
          if (!prev) return null;
          if (prev.pairAddress.toLowerCase() !== payload.pairAddress.toLowerCase()) {
            return prev;
          }
          return {
            ...prev,
            price1Per0: payload.effectivePrice!,
            price1Per0Formatted: payload.effectivePrice!.toFixed(4),
          };
        });
      }
    });

    return () => {
      mounted = false;
      unbindSwap();
    };
  }, []);

  const refreshPair = useCallback(async () => {
    if (!activePair) return;
    try {
      const updated = await fetchPairOverview(activePair.pairAddress);
      setActivePair(updated);
    } catch (err) {
      console.error("Error refreshing active pair overview:", err);
    }
  }, [activePair]);

  const startListening = useCallback(
    async (explicitAddress?: string) => {
      const target = explicitAddress || pairAddressInput;
      setErrorMessage(null);

      const validRes = validatePairAddress(target);
      if (!validRes.valid || !validRes.checksummed) {
        setErrorMessage(validRes.error || "无效的币对合约地址");
        return;
      }

      const pairAddr = validRes.checksummed;
      setIsSyncing(true);

      try {
        // 1. Fetch pair overview & token info
        const overview = await fetchPairOverview(pairAddr);
        setActivePair(overview);

        // Save initial subscription to IndexedDB
        await SubscriptionStore.save({
          pairAddress: pairAddr,
          token0Address: overview.token0.address,
          token0Symbol: overview.token0.symbol,
          token1Address: overview.token1.address,
          token1Symbol: overview.token1.symbol,
          status: "syncing",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          proxyContract:
            customContract.enabled && customContract.contractAddress
              ? (customContract.contractAddress as any)
              : undefined,
        });

        // 2. Perform 24h historical backfill with progress tracking
        const backfillResult = await backfillPair24hHistory({
          pairAddress: pairAddr,
          token0Decimals: overview.token0.decimals,
          token1Decimals: overview.token1.decimals,
          onProgress: (progress) => {
            setSyncProgress(progress);
          },
        });

        // 3. Start real-time incremental log poller
        startRealtimePolling(pairAddr, backfillResult.lake, 3000);
        setIsListening(true);
      } catch (err: any) {
        setErrorMessage(
          err?.message || "启动监听失败，请检查网络与合约地址。"
        );
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [pairAddressInput, customContract]
  );

  const stopListening = useCallback(async () => {
    if (!pairAddressInput) return;
    const validRes = validatePairAddress(pairAddressInput);
    if (validRes.valid && validRes.checksummed) {
      await stopRealtimePolling(validRes.checksummed);
    }
    setIsListening(false);
  }, [pairAddressInput]);

  return (
    <ActivePairContext.Provider
      value={{
        pairAddressInput,
        setPairAddressInput,
        activePair,
        setActivePair,
        isListening,
        isSyncing,
        syncProgress,
        errorMessage,
        setErrorMessage,
        maxDisplayEvents,
        setMaxDisplayEvents,
        recentEvents,
        setRecentEvents,
        customContract,
        setCustomContract,
        startListening,
        stopListening,
        refreshPair,
      }}
    >
      {children}
    </ActivePairContext.Provider>
  );
};

export const useActivePair = (): ActivePairContextState => {
  const context = useContext(ActivePairContext);
  if (!context) {
    throw new Error("useActivePair must be used within an ActivePairProvider");
  }
  return context;
};
