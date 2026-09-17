import React, { useState, useEffect, useMemo } from "react";
import {
  Radio,
  Loader2,
  Play,
  Square,
  Flame,
  Bookmark,
  Plus,
  ExternalLink,
  Trash2,
  Server,
  ChevronRight,
  Activity,
  FileText,
} from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberButton } from "../../components/ui/CyberButton";
import { CyberStepper } from "../../components/ui/CyberStepper";
import { RecentEventsTable } from "./RecentEventsTable";
import { PairDetailModal } from "./PairDetailModal";
import { useActivePair } from "../../context/ActivePairContext";
import { useWallet } from "../../wallet/WalletContext";
import { getPresetPairs } from "../../services/pair/pair-resolver";
import { AddPairModal } from "../../components/pair-selector/AddPairModal";
import { getBscScanAddressUrl } from "../../wallet/ethereum";
import { RpcPoolManager } from "../../services/rpc/rpc-pool-manager";
import { RpcManagerModal } from "../../components/rpc/RpcManagerModal";
import { validatePairAddress } from "../../services/pair/pair-reader";
import { getPairStrategySummary } from "../../strategies/strategy-store";

export interface SwapMonitorViewProps {
  onNavigateToStrategy?: (pairAddress?: string) => void;
}

export const SwapMonitorView: React.FC<SwapMonitorViewProps> = ({
  onNavigateToStrategy,
}) => {
  const { chainId } = useWallet();
  const {
    activePair,
    errorMessage,
    setErrorMessage,
    maxDisplayEvents,
    setMaxDisplayEvents,
    recentEvents,
    allRecentEvents,
    getPairEvents,
    subscriptions,
    addSubscription,
    removeSubscription,
    selectPair,
    startListening,
    stopListening,
    startAllListening,
    stopAllListening,
    pairListeningMap,
    pairSyncProgressMap,
    pairOverviewMap,
    isLoadingHistoricalEvents,
    refreshHistoricalEvents,
  } = useActivePair();

  // Modal dialog state for detailed LP report popup ("详细报告,就是弹出一个框框就好")
  const [detailModalAddress, setDetailModalAddress] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRpcModalOpen, setIsRpcModalOpen] = useState(false);
  const [activeRpcCount, setActiveRpcCount] = useState(() =>
    RpcPoolManager.getActiveRpcUrls(chainId ?? 97).length
  );
  const [quickLpInput, setQuickLpInput] = useState("");
  const [isStartingAll, setIsStartingAll] = useState(false);
  const [isStoppingAll, setIsStoppingAll] = useState(false);

  useEffect(() => {
    const unsub = RpcPoolManager.onPoolChange((changedChainId, urls) => {
      if (changedChainId === (chainId ?? 97)) {
        setActiveRpcCount(urls.length);
      }
    });
    return unsub;
  }, [chainId]);

  const presetPairs = getPresetPairs(chainId ?? undefined);

  // Map for fast pair symbol resolution in aggregated event feeds
  const pairLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const sub of subscriptions) {
      const key = sub.pairAddress.toLowerCase();
      map[key] = `${sub.token0Symbol} / ${sub.token1Symbol}`;
    }
    for (const [key, ov] of Object.entries(pairOverviewMap)) {
      if (!map[key]) {
        map[key] = `${ov.token0.symbol} / ${ov.token1.symbol}`;
      }
    }
    return map;
  }, [subscriptions, pairOverviewMap]);

  const handleStartAll = async () => {
    setIsStartingAll(true);
    try {
      await startAllListening();
    } finally {
      setIsStartingAll(false);
    }
  };

  const handleStopAll = async () => {
    setIsStoppingAll(true);
    try {
      await stopAllListening();
    } finally {
      setIsStoppingAll(false);
    }
  };

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickLpInput.trim()) return;

    const valid = validatePairAddress(quickLpInput.trim());
    if (!valid.valid || !valid.checksummed) {
      setErrorMessage(valid.error || "无效的 LP Pair 合约地址");
      return;
    }

    try {
      await selectPair(valid.checksummed, true);
      setQuickLpInput("");
    } catch {
      // Error handled inside context
    }
  };

  const activeMonitoringCount = Object.values(pairListeningMap).filter(Boolean).length;

  // Compute how many pairs have active strategies vs closed strategies
  const { activeStrategyCount, closedStrategyCount } = useMemo(() => {
    let activeCount = 0;
    let closedCount = 0;
    for (const sub of subscriptions) {
      const summary = getPairStrategySummary(sub.pairAddress);
      if (summary.hasActive) {
        activeCount++;
      } else {
        closedCount++;
      }
    }
    return { activeStrategyCount: activeCount, closedStrategyCount: closedCount };
  }, [subscriptions]);

  return (
    <div className="space-y-4">
      {/* Primary Multi-Pair Management Screen Header Card */}
      <CyberCard className="space-y-4">
        {/* Top Header & Status Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 flex-wrap gap-2">
          <div className="flex items-center space-x-2.5 text-cyber-cyan font-bold text-base">
            <Radio className={`w-5 h-5 ${activeMonitoringCount > 0 ? "animate-pulse" : ""}`} />
            <span>多币对实时监控大屏</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              监控中:{" "}
              <span className="text-emerald-400 font-bold">{activeMonitoringCount}</span> /{" "}
              <span>{subscriptions.length}</span> 币对
            </span>

            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700">
              策略:{" "}
              <span className="text-emerald-400 font-bold">{activeStrategyCount} 开启</span> /{" "}
              <span className="text-slate-400">{closedStrategyCount} 关闭</span>
            </span>
          </div>
        </div>

        {/* Popular Preset Pairs */}
        <div className="space-y-1.5 pt-0.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
              <Flame className="w-3.5 h-3.5" />
              <span>Pancake 热门推荐币对 (一键快速订阅)</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {chainId === 56 ? "BSC Mainnet" : "BSC Testnet"}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presetPairs.map((p) => {
              const isSubscribed = subscriptions.some(
                (s) => s.pairAddress.toLowerCase() === p.pairAddress.toLowerCase()
              );
              const isPairActive = Boolean(pairListeningMap[p.pairAddress.toLowerCase()]);

              return (
                <button
                  key={p.pairAddress}
                  type="button"
                  onClick={async () => {
                    if (!isSubscribed) {
                      await addSubscription({
                        pairAddress: p.pairAddress,
                        token0Address: "0x0000000000000000000000000000000000000000",
                        token0Symbol: p.token0Symbol,
                        token1Address: "0x0000000000000000000000000000000000000000",
                        token1Symbol: p.token1Symbol,
                        status: "inactive",
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                      });
                    }
                    await selectPair(p.pairAddress);
                  }}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    isSubscribed
                      ? "bg-cyber-cyan/15 border-cyber-cyan text-white shadow-sm shadow-cyan-500/20"
                      : "bg-cyber-cardInner/90 border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white"
                  }`}
                >
                  <span>{p.label}</span>
                  {p.tag && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {p.tag}
                    </span>
                  )}
                  {isPairActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* RPC Pool Status Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-cyber-cardInner/70 border border-slate-800/90 rounded-xl text-xs">
          <div className="flex items-center space-x-2">
            <Server className="w-3.5 h-3.5 text-cyber-cyan shrink-0" />
            <span className="text-slate-300">RPC 节点池:</span>
            <span className="text-emerald-400 font-mono font-medium flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{activeRpcCount} 个节点生效 (归档+常规解耦)</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsRpcModalOpen(true)}
            className="text-cyber-cyan hover:text-cyan-300 text-[11px] font-medium flex items-center space-x-1 hover:underline"
          >
            <span>测速 / 节点管理</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {/* Multi-Pair Watchlist & Global Controls */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-cyber-cyan font-bold">
              <Bookmark className="w-3.5 h-3.5" />
              <span>全部自选监控币对大屏 ({subscriptions.length})</span>
            </div>
            <div className="flex items-center space-x-2">
              {subscriptions.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleStartAll}
                    disabled={isStartingAll}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 text-xs font-medium transition-all"
                    title="全部启动监听"
                  >
                    <Play className="w-3 h-3" />
                    <span>全部启动</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleStopAll}
                    disabled={isStoppingAll}
                    className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-rose-400 border border-slate-700 text-xs font-medium transition-all"
                    title="全部停止监听"
                  >
                    <Square className="w-3 h-3" />
                    <span>全部停止</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-cyber-cyan/15 text-cyber-cyan hover:bg-cyber-cyan/25 border border-cyber-cyan/30 text-xs font-medium transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加币对</span>
              </button>
            </div>
          </div>

          {/* Subscribed Pairs Cards List: Exactly 1 LP Pair per row to prevent crowding ("一排一个LP就好了,你分为2个太拥挤了") */}
          {subscriptions.length > 0 ? (
            <div className="flex flex-col space-y-3" data-testid="pairs-grid-container">
              {subscriptions.map((sub) => {
                const key = sub.pairAddress.toLowerCase();
                const pairListen = Boolean(pairListeningMap[key]);
                const pairSync = pairSyncProgressMap[key] ?? null;
                const isPairSyncing = Boolean(
                  pairSync && (pairSync.stage === "backfill_syncing" || pairSync.stage === "data_preparing")
                );
                const overview = pairOverviewMap[key];
                const priceStr = overview?.price1Per0Formatted
                  ? `1 ${overview.token0.symbol} = ${overview.price1Per0Formatted} ${overview.token1.symbol}`
                  : null;
                const strategySummary = getPairStrategySummary(sub.pairAddress);
                const pairSwaps = getPairEvents(key);

                return (
                  <div
                    key={sub.pairAddress}
                    data-testid={`pair-card-${sub.pairAddress}`}
                    onClick={async () => {
                      await selectPair(sub.pairAddress);
                      setDetailModalAddress(sub.pairAddress);
                    }}
                    className="cursor-pointer p-4 rounded-xl border border-slate-800 bg-cyber-cardInner/80 hover:bg-cyber-cardInner/95 hover:border-cyber-cyan/70 transition-all space-y-2.5 shadow-sm hover:shadow-cyan-950/30 group"
                  >
                    {/* Top Row: Symbols, Exchange tag, BscScan link & Delete */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2.5">
                        <div className="font-bold text-base font-mono flex items-center space-x-1 group-hover:text-cyber-cyan transition-colors">
                          <span className="text-cyber-cyan">{sub.token0Symbol}</span>
                          <span className="text-slate-500">/</span>
                          <span className="text-rose-400">{sub.token1Symbol}</span>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                          PancakeSwap V2
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <a
                          href={getBscScanAddressUrl(sub.pairAddress)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-500 hover:text-cyber-cyan p-1 rounded transition-colors flex items-center space-x-1 text-xs font-mono"
                          title="在 BSCScan 查看合约"
                        >
                          <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[100px]">
                            {sub.pairAddress}
                          </span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSubscription(sub.pairAddress);
                          }}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                          title="移除此自选币对"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Middle Row: Status Badges, Market Price & Activity */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                      {/* Status Badges Group */}
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        {/* Listening State Badge */}
                        {pairListen ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/30 flex items-center space-x-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>监听中</span>
                          </span>
                        ) : isPairSyncing ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyber-cyan font-mono border border-cyan-500/30 flex items-center space-x-1">
                            <Loader2 className="w-3 h-3 animate-spin text-cyber-cyan" />
                            <span>同步中 ({pairSync?.percent}%)</span>
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                            未监听
                          </span>
                        )}

                        {/* Strategy State Badge */}
                        {strategySummary.hasActive ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 font-mono border border-emerald-500/30 flex items-center space-x-1" title={strategySummary.details}>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            <span>策略开启: {strategySummary.details}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 font-mono border border-slate-700">
                            策略已关闭
                          </span>
                        )}
                      </div>

                      {/* Right Metrics: Price & Event Activity */}
                      <div className="flex items-center space-x-3 text-xs">
                        <div className="font-mono text-slate-200 font-semibold">
                          {priceStr || <span className="text-slate-500 text-[11px]">点击加载行情</span>}
                        </div>

                        <div className="text-[11px] font-mono text-slate-400 flex items-center space-x-1">
                          <Activity className="w-3 h-3 text-cyber-cyan" />
                          <span>抓取 {pairSwaps.length} 条</span>
                        </div>
                      </div>
                    </div>

                    {/* Scoped Sync Progress Bar for this pair */}
                    {pairSync && (isPairSyncing || pairSync.percent < 100) && (
                      <div className="pt-1 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-cyber-cyan flex items-center space-x-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>{pairSync.message}</span>
                          </span>
                          <span className="text-cyber-cyan font-mono font-bold">
                            {pairSync.percent}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-cyber-cyan h-1 rounded-full transition-all duration-300 shadow-glowCyan"
                            style={{ width: `${pairSync.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80">
                      <div>
                        {pairListen ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              stopListening(sub.pairAddress);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs transition-colors flex items-center space-x-1"
                            title="停止当前币对监听"
                          >
                            <Square className="w-3 h-3" />
                            <span>停止监听</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isPairSyncing}
                            onClick={(e) => {
                              e.stopPropagation();
                              startListening(sub.pairAddress);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 text-cyber-cyan border border-cyber-cyan/40 text-xs transition-colors flex items-center space-x-1 disabled:opacity-50"
                            title="启动 24h 归档回溯并实时监听"
                          >
                            <Play className="w-3 h-3" />
                            <span>启动监听</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {onNavigateToStrategy && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectPair(sub.pairAddress);
                              onNavigateToStrategy(sub.pairAddress);
                            }}
                            className="text-xs text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                          >
                            配置策略
                          </button>
                        )}

                        {/* Open detailed report popup modal ("详细报告,就是弹出一个框框就好") */}
                        <button
                          type="button"
                          data-testid={`open-detail-btn-${sub.pairAddress}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectPair(sub.pairAddress);
                            setDetailModalAddress(sub.pairAddress);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-cyber-cyan/15 hover:bg-cyber-cyan/25 border border-cyber-cyan/30 text-cyber-cyan text-xs font-medium flex items-center space-x-1 transition-all"
                        >
                          <FileText className="w-3.5 h-3.5 mr-0.5" />
                          <span>详细报告</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 px-4 rounded-xl bg-cyber-cardInner/40 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
              <span>暂无监控币对，可从上方热门推荐中一键添加或点击「添加币对」</span>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="text-cyber-cyan hover:underline font-medium"
              >
                立即添加
              </button>
            </div>
          )}
        </div>

        {/* Quick LP Add Form & Display Settings */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          <form onSubmit={handleQuickAdd} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="输入 LP Pair 地址快速添加并监听 (0x...)"
              value={quickLpInput}
              onChange={(e) => setQuickLpInput(e.target.value)}
              className="flex-1 bg-cyber-cardInner border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-cyber-cyan font-mono"
            />
            <CyberButton type="submit" variant="cyan" size="sm" disabled={!quickLpInput.trim()}>
              <span>快速监听</span>
            </CyberButton>
          </form>

          <div className="flex items-center justify-between text-xs pt-1 text-slate-300">
            <span>最新交易事件流显示条数</span>
            <CyberStepper
              value={maxDisplayEvents}
              onChange={setMaxDisplayEvents}
              min={5}
              max={50}
              step={5}
            />
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}
      </CyberCard>

      {/* Multi-Pair Aggregated Swap Events Feed (Real-time + Historical) */}
      <RecentEventsTable
        events={allRecentEvents.length > 0 ? allRecentEvents : recentEvents}
        title="多币对聚合 Swap 交易事件流 (实时监控 + 历史归档)"
        token0Symbol={activePair?.token0.symbol}
        token1Symbol={activePair?.token1.symbol}
        pairLabelMap={pairLabelMap}
        maxDisplay={maxDisplayEvents}
        isLoadingHistory={isLoadingHistoricalEvents}
        onRefreshHistory={() => refreshHistoricalEvents()}
      />

      {/* Detailed Report Modal Popup ("详细报告,就是弹出一个框框就好,不要现在这种") */}
      <PairDetailModal
        isOpen={!!detailModalAddress}
        pairAddress={detailModalAddress}
        onClose={() => setDetailModalAddress(null)}
        onNavigateToStrategy={onNavigateToStrategy}
      />

      {/* Add Pair Modal */}
      <AddPairModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* RPC Node Pool Manager Modal */}
      <RpcManagerModal
        isOpen={isRpcModalOpen}
        onClose={() => setIsRpcModalOpen(false)}
      />
    </div>
  );
};
