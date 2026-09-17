import React, { useEffect } from "react";
import {
  X,
  ExternalLink,
  Sliders,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Loader2,
  FileText,
} from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberButton } from "../../components/ui/CyberButton";
import { SwapInfoView } from "../swap-info/SwapInfoView";
import { PriceTrendView } from "../price-trend/PriceTrendView";
import { RecentEventsTable } from "./RecentEventsTable";
import { useActivePair } from "../../context/ActivePairContext";
import { getBscScanAddressUrl } from "../../wallet/ethereum";
import { getPairStrategySummary } from "../../strategies/strategy-store";

export interface PairDetailModalProps {
  isOpen: boolean;
  pairAddress: string | null;
  onClose: () => void;
  onNavigateToStrategy?: (pairAddress: string) => void;
}

export const PairDetailModal: React.FC<PairDetailModalProps> = ({
  isOpen,
  pairAddress,
  onClose,
  onNavigateToStrategy,
}) => {
  const {
    pairOverviewMap,
    pairListeningMap,
    pairSyncProgressMap,
    getPairEvents,
    maxDisplayEvents,
    startListening,
    stopListening,
    activePair,
    isLoadingHistoricalEvents,
    refreshHistoricalEvents,
  } = useActivePair();

  // Close on ESC key and auto-fetch historical events if empty on modal open
  useEffect(() => {
    if (!isOpen || !pairAddress) return;

    if (getPairEvents(pairAddress).length === 0) {
      refreshHistoricalEvents(pairAddress);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, pairAddress, onClose, getPairEvents, refreshHistoricalEvents]);

  if (!isOpen || !pairAddress) return null;

  const key = pairAddress.toLowerCase();
  const detailPair =
    pairOverviewMap[key] ||
    (activePair?.pairAddress.toLowerCase() === key ? activePair : null);
  const detailListening = Boolean(pairListeningMap[key]);
  const detailSync = pairSyncProgressMap[key] ?? null;
  const isDetailSyncing = Boolean(
    detailSync &&
      (detailSync.stage === "backfill_syncing" ||
        detailSync.stage === "data_preparing")
  );
  const detailEvents = getPairEvents(key);
  const detailStrategy = getPairStrategySummary(pairAddress);

  const token0Symbol = detailPair?.token0.symbol || "Token0";
  const token1Symbol = detailPair?.token1.symbol || "Token1";

  return (
    <div
      data-testid="pair-detail-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] bg-cyber-card border border-cyber-cyan/50 rounded-2xl shadow-2xl shadow-cyan-950/80 overflow-y-auto flex flex-col p-4 sm:p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-cyber-cyan/15 text-cyber-cyan">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base font-mono text-white">
                  <span className="text-cyber-cyan">{token0Symbol}</span>
                  <span className="text-slate-500 mx-1">/</span>
                  <span className="text-rose-400">{token1Symbol}</span>
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                  PancakeSwap V2
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyber-cyan border border-cyan-500/30">
                  详细报告
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono pt-0.5">
                <span className="truncate max-w-[180px] sm:max-w-xs">{pairAddress}</span>
                <a
                  href={getBscScanAddressUrl(pairAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyber-cyan hover:underline flex items-center space-x-0.5"
                >
                  <span>BscScan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <button
            type="button"
            data-testid="close-detail-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="关闭报告"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Actions & Rate Bar */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-cyber-cardInner/90 border border-slate-800 flex-wrap gap-2 text-xs">
          <div className="flex items-center space-x-2">
            {detailListening ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/30 flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>监听中</span>
              </span>
            ) : isDetailSyncing ? (
              <span className="text-xs px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyber-cyan font-mono border border-cyan-500/30 flex items-center space-x-1.5">
                <Loader2 className="w-3 h-3 animate-spin text-cyber-cyan" />
                <span>同步中 ({detailSync?.percent}%)</span>
              </span>
            ) : (
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">
                未监听
              </span>
            )}

            {detailListening ? (
              <CyberButton
                variant="danger"
                size="sm"
                onClick={() => stopListening(pairAddress)}
              >
                <Square className="w-3 h-3 mr-1" />
                <span>停止监听</span>
              </CyberButton>
            ) : (
              <CyberButton
                variant="cyan"
                size="sm"
                disabled={isDetailSyncing}
                onClick={() => startListening(pairAddress)}
              >
                <Play className="w-3 h-3 mr-1" />
                <span>启动监听</span>
              </CyberButton>
            )}
          </div>

          {detailPair?.price1Per0Formatted && (
            <div className="font-mono text-slate-200 font-bold text-xs">
              1 {token0Symbol} = {detailPair.price1Per0Formatted} {token1Symbol}
            </div>
          )}
        </div>

        {/* Pair-Specific Strategy Status Card */}
        <CyberCard className="space-y-3 bg-cyber-cardInner/70 border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-200">
              <Sliders className="w-4 h-4 text-cyber-cyan" />
              <span>当前币对量化策略绑定状态</span>
            </div>

            {onNavigateToStrategy && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToStrategy(pairAddress);
                }}
                className="text-cyber-cyan hover:text-cyan-300 text-xs font-medium flex items-center space-x-1"
              >
                <span>前往策略面板配置此币对</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/90 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-slate-400">策略状态:</span>
                {detailStrategy.hasActive ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>策略已开启 ({detailStrategy.details})</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 font-medium flex items-center space-x-1">
                    <XCircle className="w-3.5 h-3.5" />
                    <span>策略已关闭 / 未激活</span>
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-400">
              <span>反向买入: {detailStrategy.reverseBuy ? "🟢 开启" : "⚪ 关闭"}</span>
              <span>反向卖出: {detailStrategy.reverseSell ? "🟢 开启" : "⚪ 关闭"}</span>
              <span>AI自动交易: {detailStrategy.autoActive ? "🟢 开启" : "⚪ 关闭"}</span>
            </div>
          </div>
        </CyberCard>

        {/* Dual Reserves & Liquidity Overview */}
        {detailPair && (
          <SwapInfoView
            pairAddress={detailPair.pairAddress}
            initialOverview={detailPair}
          />
        )}

        {/* 24h Price Trend Chart */}
        {detailPair && (
          <PriceTrendView
            events={detailEvents}
            token0Symbol={detailPair.token0.symbol}
            token1Symbol={detailPair.token1.symbol}
            currentPrice={detailPair.price1Per0}
          />
        )}

        {/* Pair Dedicated Recent Swap Events Feed */}
        <RecentEventsTable
          events={detailEvents}
          title={`${token0Symbol}/${token1Symbol} 专属 Swap 交易事件流 (实时监控 + 历史归档)`}
          token0Symbol={token0Symbol}
          token1Symbol={token1Symbol}
          maxDisplay={maxDisplayEvents}
          isLoadingHistory={isLoadingHistoricalEvents}
          onRefreshHistory={() => refreshHistoricalEvents(pairAddress)}
        />

        {/* Footer Close Button */}
        <div className="pt-2 flex justify-end">
          <CyberButton variant="outline" size="sm" onClick={onClose}>
            <span>关闭报告</span>
          </CyberButton>
        </div>
      </div>
    </div>
  );
};
