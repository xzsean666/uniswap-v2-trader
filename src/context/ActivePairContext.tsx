import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import type { Address } from "viem";
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
import { SubscriptionStore, type PairSubscription } from "../storage/subscription-store";
import { useWallet } from "../wallet/WalletContext";
import { fetchPairHistoricalSwaps } from "../services/sync/historical-events-loader";
import { saveCachedPairEvents } from "../storage/indexeddb-client";

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
  allRecentEvents: SwapLogPayload[];
  eventsByPair: Record<string, SwapLogPayload[]>;
  getPairEvents: (address: string) => SwapLogPayload[];
  setRecentEvents: React.Dispatch<React.SetStateAction<SwapLogPayload[]>>;
  subscriptions: PairSubscription[];
  addSubscription: (sub: PairSubscription) => Promise<void>;
  removeSubscription: (pairAddress: string) => Promise<void>;
  selectPair: (pairAddress: string, autoListen?: boolean) => Promise<void>;
  startListening: (address?: string) => Promise<void>;
  stopListening: (address?: string) => Promise<void>;
  startAllListening: () => Promise<void>;
  stopAllListening: () => Promise<void>;
  refreshPair: () => Promise<void>;
  pairListeningMap: Record<string, boolean>;
  pairSyncProgressMap: Record<string, SyncProgressUpdate | null>;
  pairOverviewMap: Record<string, PairOverview>;
  isLoadingHistoricalEvents: boolean;
  refreshHistoricalEvents: (address?: string) => Promise<void>;
}

const ActivePairContext = createContext<ActivePairContextState | null>(null);

export const ActivePairProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { chainId } = useWallet();
  const [pairAddressInput, setPairAddressInput] = useState(
    "0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02"
  );
  const [pairOverviewMap, setPairOverviewMap] = useState<Record<string, PairOverview>>({});
  const [pairListeningMap, setPairListeningMap] = useState<Record<string, boolean>>({});
  const [pairSyncProgressMap, setPairSyncProgressMap] = useState<Record<string, SyncProgressUpdate | null>>({});
  const [eventsByPair, setEventsByPair] = useState<Record<string, SwapLogPayload[]>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [maxDisplayEvents, setMaxDisplayEvents] = useState(15);
  const [subscriptions, setSubscriptions] = useState<PairSubscription[]>([]);
  const [isLoadingHistoricalEvents, setIsLoadingHistoricalEvents] = useState(false);

  const activeKey = pairAddressInput ? pairAddressInput.toLowerCase() : "";
  const activePair = pairOverviewMap[activeKey] ?? null;
  const isListening = Boolean(pairListeningMap[activeKey]);
  const syncProgress = pairSyncProgressMap[activeKey] ?? null;
  const isSyncing = Boolean(
    syncProgress &&
      (syncProgress.stage === "backfill_syncing" || syncProgress.stage === "data_preparing")
  );
  const recentEvents = eventsByPair[activeKey] ?? [];

  const getPairEvents = useCallback(
    (address: string) => {
      return eventsByPair[address.toLowerCase()] || [];
    },
    [eventsByPair]
  );

  const allRecentEvents = useMemo(() => {
    const all: SwapLogPayload[] = [];
    for (const list of Object.values(eventsByPair)) {
      all.push(...list);
    }
    all.sort((a, b) => {
      const bBlock = BigInt(b.blockNumber || "0");
      const aBlock = BigInt(a.blockNumber || "0");
      if (bBlock !== aBlock) {
        return bBlock > aBlock ? 1 : -1;
      }
      return b.logIndex - a.logIndex;
    });
    const seen = new Set<string>();
    const deduped: SwapLogPayload[] = [];
    for (const ev of all) {
      const id = `${ev.transactionHash}:${ev.logIndex}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(ev);
      }
    }
    return deduped.slice(0, 50);
  }, [eventsByPair]);

  const setRecentEvents: React.Dispatch<React.SetStateAction<SwapLogPayload[]>> = useCallback(
    (action) => {
      if (!activeKey) return;
      setEventsByPair((prev) => {
        const currentList = prev[activeKey] ?? [];
        const nextList = typeof action === "function" ? action(currentList) : action;
        return {
          ...prev,
          [activeKey]: nextList,
        };
      });
    },
    [activeKey]
  );

  const setActivePair = useCallback(
    (pair: PairOverview | null) => {
      if (!pair) return;
      const key = pair.pairAddress.toLowerCase();
      setPairOverviewMap((prev) => ({
        ...prev,
        [key]: pair,
      }));
    },
    []
  );

  const loadHistoricalForPairs = useCallback(
    async (pairsToLoad: string[], forceRefresh = false) => {
      if (pairsToLoad.length === 0) return;
      setIsLoadingHistoricalEvents(true);
      try {
        await Promise.all(
          pairsToLoad.map(async (addr) => {
            const key = addr.toLowerCase();
            if (!forceRefresh && eventsByPair[key] && eventsByPair[key].length >= 20) {
              return;
            }
            const ov = pairOverviewMap[key];
            const events = await fetchPairHistoricalSwaps({
              pairAddress: addr,
              chainId: chainId ?? undefined,
              token0Decimals: ov?.token0.decimals,
              token1Decimals: ov?.token1.decimals,
              currentPrice: ov?.price1Per0,
              limit: 30,
            });

            if (events && events.length > 0) {
              setEventsByPair((prev) => {
                const existing = prev[key] || [];
                const map = new Map<string, SwapLogPayload>();
                for (const ev of existing) {
                  map.set(`${ev.transactionHash}:${ev.logIndex}`, ev);
                }
                for (const ev of events) {
                  if (!map.has(`${ev.transactionHash}:${ev.logIndex}`)) {
                    map.set(`${ev.transactionHash}:${ev.logIndex}`, ev);
                  }
                }
                const combined = Array.from(map.values()).sort((a, b) => {
                  const bBlock = BigInt(b.blockNumber || "0");
                  const aBlock = BigInt(a.blockNumber || "0");
                  if (bBlock !== aBlock) return bBlock > aBlock ? 1 : -1;
                  return b.logIndex - a.logIndex;
                });
                const trimmed = combined.slice(0, 50);
                saveCachedPairEvents(key, trimmed).catch(() => {});
                return {
                  ...prev,
                  [key]: trimmed,
                };
              });
            }
          })
        );
      } catch (err) {
        console.warn("Failed loading historical swap events for pairs:", err);
      } finally {
        setIsLoadingHistoricalEvents(false);
      }
    },
    [chainId, pairOverviewMap, eventsByPair]
  );

  const refreshHistoricalEvents = useCallback(
    async (address?: string) => {
      const targets = address
        ? [address]
        : Array.from(
            new Set(
              [
                pairAddressInput,
                ...subscriptions.map((s) => s.pairAddress),
              ].filter(Boolean)
            )
          );
      await loadHistoricalForPairs(targets, true);
    },
    [pairAddressInput, subscriptions, loadHistoricalForPairs]
  );

  // Load subscriptions on mount
  useEffect(() => {
    let mounted = true;

    async function loadInitial() {
      try {
        const allSubs = await SubscriptionStore.getAll();
        if (!mounted) return;
        setSubscriptions(allSubs);

        const initialListeningMap: Record<string, boolean> = {};
        for (const sub of allSubs) {
          const key = sub.pairAddress.toLowerCase();
          if (sub.status === "active" || isPairPolling(sub.pairAddress)) {
            initialListeningMap[key] = true;
          }
          // Fetch overview in background
          fetchPairOverview(sub.pairAddress)
            .then((ov) => {
              if (mounted) {
                setPairOverviewMap((prev) => ({
                  ...prev,
                  [key]: ov,
                }));
              }
            })
            .catch(() => {});
        }
        if (mounted) {
          setPairListeningMap(initialListeningMap);
        }

        const initialPairs =
          allSubs.length > 0
            ? allSubs.map((s) => s.pairAddress)
            : ["0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02"];

        if (allSubs.length > 0 && mounted) {
          const first = allSubs[0];
          setPairAddressInput(first.pairAddress);
        } else {
          // Default initial pair overview fetch
          fetchPairOverview("0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02")
            .then((ov) => {
              if (mounted) {
                setPairOverviewMap((prev) => ({
                  ...prev,
                  ["0xf03ebe5cd689fedc9204af66cb3431750b89bc02"]: ov,
                }));
              }
            })
            .catch(() => {});
        }

        // Proactively load historical Swap events for initial pairs
        loadHistoricalForPairs(initialPairs);
      } catch {
        // Storage lookup fallback
      }
    }

    loadInitial();

    // Listen globally for incoming swaps and route to specific pair collections
    const unbindSwap = syncEvents.on("new_swap", (payload) => {
      const key = payload.pairAddress.toLowerCase();
      const realtimePayload: SwapLogPayload = {
        ...payload,
        source: "realtime",
      };

      // 1. Route swap log to corresponding pair
      setEventsByPair((prev) => {
        const list = prev[key] || [];
        const eventKey = `${realtimePayload.transactionHash}:${realtimePayload.logIndex}`;
        if (list.some((p) => `${p.transactionHash}:${p.logIndex}` === eventKey)) {
          return prev;
        }
        const updated = [realtimePayload, ...list.slice(0, 49)];
        saveCachedPairEvents(key, updated).catch(() => {});
        return {
          ...prev,
          [key]: updated,
        };
      });

      // 2. Update real-time price in pair overview
      if (payload.effectivePrice && payload.effectivePrice > 0) {
        setPairOverviewMap((prev) => {
          const existing = prev[key];
          if (!existing) return prev;
          return {
            ...prev,
            [key]: {
              ...existing,
              price1Per0: payload.effectivePrice!,
              price1Per0Formatted: payload.effectivePrice!.toFixed(4),
            },
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
  }, [activePair, setActivePair]);

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
      const key = pairAddr.toLowerCase();

      setPairSyncProgressMap((prev) => ({
        ...prev,
        [key]: {
          stage: "data_preparing",
          percent: 5,
          message: "正在连接归档节点并计算 24 小时历史区块...",
        },
      }));

      try {
        // 1. Fetch pair overview & token info
        let overview = pairOverviewMap[key];
        if (!overview) {
          overview = await fetchPairOverview(pairAddr);
          setPairOverviewMap((prev) => ({
            ...prev,
            [key]: overview,
          }));
        }

        // Save subscription to IndexedDB
        await SubscriptionStore.save({
          pairAddress: pairAddr,
          token0Address: overview.token0.address,
          token0Symbol: overview.token0.symbol,
          token1Address: overview.token1.address,
          token1Symbol: overview.token1.symbol,
          status: "syncing",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });

        // 2. Perform 24h historical backfill with strictly Archive RPC pool
        const backfillResult = await backfillPair24hHistory({
          pairAddress: pairAddr,
          chainId: chainId ?? undefined,
          token0Decimals: overview.token0.decimals,
          token1Decimals: overview.token1.decimals,
          onProgress: (progress) => {
            setPairSyncProgressMap((prev) => ({
              ...prev,
              [key]: progress,
            }));
          },
        });

        // 3. Immediately store backfilled initial events so the UI stream is populated right away
        if (backfillResult.initialEvents && backfillResult.initialEvents.length > 0) {
          setEventsByPair((prev) => {
            const existing = prev[key] || [];
            const map = new Map<string, SwapLogPayload>();
            for (const ev of backfillResult.initialEvents) {
              map.set(`${ev.transactionHash}:${ev.logIndex}`, {
                ...ev,
                source: "historical",
              });
            }
            for (const ev of existing) {
              if (!map.has(`${ev.transactionHash}:${ev.logIndex}`)) {
                map.set(`${ev.transactionHash}:${ev.logIndex}`, ev);
              }
            }
            const combined = Array.from(map.values());
            combined.sort((a, b) => {
              const bBlock = BigInt(b.blockNumber || "0");
              const aBlock = BigInt(a.blockNumber || "0");
              if (bBlock !== aBlock) {
                return bBlock > aBlock ? 1 : -1;
              }
              return b.logIndex - a.logIndex;
            });
            const trimmed = combined.slice(0, 50);
            saveCachedPairEvents(key, trimmed).catch(() => {});
            return {
              ...prev,
              [key]: trimmed,
            };
          });
        }

        // 4. Start real-time incremental log poller
        startRealtimePolling(pairAddr, backfillResult.lake, 3000);
        setPairListeningMap((prev) => ({ ...prev, [key]: true }));

        // Refresh subscriptions
        const updatedSubs = await SubscriptionStore.getAll();
        setSubscriptions(updatedSubs);

        // Auto-fade progress indicator after 1.5s
        setTimeout(() => {
          setPairSyncProgressMap((prev) => {
            if (prev[key]?.stage === "ready") {
              return { ...prev, [key]: null };
            }
            return prev;
          });
        }, 1500);
      } catch (err: any) {
        setErrorMessage(
          err?.message || "启动监听失败，请检查网络与合约地址。"
        );
        setPairSyncProgressMap((prev) => ({
          ...prev,
          [key]: {
            stage: "error",
            percent: 0,
            message: err?.message || "监听启动失败",
          },
        }));
        throw err;
      }
    },
    [pairAddressInput, pairOverviewMap, chainId]
  );

  const stopListening = useCallback(
    async (explicitAddress?: string) => {
      const target = explicitAddress || pairAddressInput;
      if (!target) return;
      const validRes = validatePairAddress(target);
      if (validRes.valid && validRes.checksummed) {
        const key = validRes.checksummed.toLowerCase();
        await stopRealtimePolling(validRes.checksummed);
        setPairListeningMap((prev) => ({ ...prev, [key]: false }));
        setPairSyncProgressMap((prev) => ({ ...prev, [key]: null }));
        await SubscriptionStore.updateStatus(validRes.checksummed, "inactive");
        const updatedSubs = await SubscriptionStore.getAll();
        setSubscriptions(updatedSubs);
      }
    },
    [pairAddressInput]
  );

  const startAllListening = useCallback(async () => {
    for (const sub of subscriptions) {
      const key = sub.pairAddress.toLowerCase();
      if (!pairListeningMap[key]) {
        try {
          await startListening(sub.pairAddress);
        } catch (e) {
          console.error(`Failed to start listening for ${sub.pairAddress}:`, e);
        }
      }
    }
  }, [subscriptions, pairListeningMap, startListening]);

  const stopAllListening = useCallback(async () => {
    for (const sub of subscriptions) {
      await stopListening(sub.pairAddress);
    }
  }, [subscriptions, stopListening]);

  const addSubscription = useCallback(
    async (sub: PairSubscription) => {
      await SubscriptionStore.save(sub);
      const all = await SubscriptionStore.getAll();
      setSubscriptions(all);
      const key = sub.pairAddress.toLowerCase();
      fetchPairOverview(sub.pairAddress)
        .then((ov) => {
          setPairOverviewMap((prev) => ({ ...prev, [key]: ov }));
        })
        .catch(() => {});
      loadHistoricalForPairs([sub.pairAddress]);
    },
    [loadHistoricalForPairs]
  );

  const removeSubscription = useCallback(async (pairAddress: string) => {
    await stopListening(pairAddress);
    await SubscriptionStore.delete(pairAddress);
    const all = await SubscriptionStore.getAll();
    setSubscriptions(all);
  }, [stopListening]);

  const selectPair = useCallback(
    async (pairAddress: string, autoListen = false) => {
      setPairAddressInput(pairAddress);
      setErrorMessage(null);
      const key = pairAddress.toLowerCase();
      try {
        if (!pairOverviewMap[key]) {
          const overview = await fetchPairOverview(pairAddress as Address);
          setPairOverviewMap((prev) => ({ ...prev, [key]: overview }));
        }
        if (!eventsByPair[key] || eventsByPair[key].length === 0) {
          loadHistoricalForPairs([pairAddress]);
        }
        if (autoListen) {
          await startListening(pairAddress);
        }
      } catch (err: any) {
        setErrorMessage(err?.message || "无法读取币对信息");
      }
    },
    [pairOverviewMap, eventsByPair, loadHistoricalForPairs, startListening]
  );

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
        allRecentEvents,
        eventsByPair,
        getPairEvents,
        setRecentEvents,
        subscriptions,
        addSubscription,
        removeSubscription,
        selectPair,
        startListening,
        stopListening,
        startAllListening,
        stopAllListening,
        refreshPair,
        pairListeningMap,
        pairSyncProgressMap,
        pairOverviewMap,
        isLoadingHistoricalEvents,
        refreshHistoricalEvents,
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
