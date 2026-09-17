import React, { useCallback, useState } from "react";
import { Radio, Loader2, Play, Square, Flame, Bookmark, Plus, ExternalLink, Trash2 } from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberButton } from "../../components/ui/CyberButton";
import { CyberStepper } from "../../components/ui/CyberStepper";
import { CustomContractPanel } from "./CustomContractPanel";
import { RecentEventsTable } from "./RecentEventsTable";
import { SwapInfoView } from "../swap-info/SwapInfoView";
import { PriceTrendView } from "../price-trend/PriceTrendView";
import { useActivePair } from "../../context/ActivePairContext";
import { useWallet } from "../../wallet/WalletContext";
import { getPresetPairs } from "../../services/pair/pair-resolver";
import { AddPairModal } from "../../components/pair-selector/AddPairModal";
import { getBscScanAddressUrl } from "../../wallet/ethereum";

export const SwapMonitorView: React.FC = () => {
  const { chainId } = useWallet();
  const {
    pairAddressInput,
    setPairAddressInput,
    activePair,
    isListening,
    isSyncing,
    syncProgress,
    errorMessage,
    setErrorMessage,
    maxDisplayEvents,
    setMaxDisplayEvents,
    recentEvents,
    customContract,
    setCustomContract,
    subscriptions,
    removeSubscription,
    selectPair,
    startListening,
    stopListening,
  } = useActivePair();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const presetPairs = getPresetPairs(chainId ?? undefined);

  const handleStartListening = useCallback(async () => {
    try {
      await startListening();
    } catch {
      // Error handled inside context
    }
  }, [startListening]);

  const handleStopListening = useCallback(async () => {
    await stopListening();
  }, [stopListening]);

  return (
    <div className="space-y-4">
      {/* Primary Swap Input Card */}
      <CyberCard className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-cyber-cyan font-bold text-base">
            <Radio className={`w-5 h-5 ${isListening ? "animate-pulse" : ""}`} />
            <span>Swap 监控管理</span>
          </div>
          {isListening ? (
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/30 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>监听中</span>
            </span>
          ) : isSyncing ? (
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyber-cyan font-mono border border-cyan-500/30 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan animate-ping" />
              <span>同步中 ({syncProgress?.percent ?? 15}%)</span>
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
              未开启监听
            </span>
          )}
        </div>

        {/* Pair Presets & Watchlist Section */}
        <div className="space-y-3 pt-1">
          {/* Popular Curated Pairs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-amber-400 font-medium">
                <Flame className="w-3.5 h-3.5" />
                <span>Pancake 热门推荐</span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {chainId === 56 ? "BSC Mainnet" : "BSC Testnet"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {presetPairs.map((p) => {
                const isSelected =
                  pairAddressInput.toLowerCase() === p.pairAddress.toLowerCase();
                return (
                  <button
                    key={p.pairAddress}
                    type="button"
                    onClick={() => selectPair(p.pairAddress)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      isSelected
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Custom Watchlist */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-cyber-cyan font-medium">
                <Bookmark className="w-3.5 h-3.5" />
                <span>我的自选币对</span>
                <span className="text-[11px] text-slate-500">
                  ({subscriptions.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="flex items-center space-x-1 text-cyber-cyan hover:text-cyan-300 text-xs font-medium hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加币对</span>
              </button>
            </div>

            {subscriptions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {subscriptions.map((sub) => {
                  const isSelected =
                    pairAddressInput.toLowerCase() === sub.pairAddress.toLowerCase();
                  return (
                    <div
                      key={sub.pairAddress}
                      className={`group flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl text-xs border transition-all ${
                        isSelected
                          ? "bg-cyber-cyan/15 border-cyber-cyan text-white shadow-sm shadow-cyan-500/20"
                          : "bg-cyber-cardInner/90 border-slate-700/60 text-slate-300 hover:border-slate-500 hover:text-white"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => selectPair(sub.pairAddress)}
                        className="font-medium"
                      >
                        {sub.token0Symbol} / {sub.token1Symbol}
                      </button>
                      <button
                        type="button"
                        title="从自选中移除"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSubscription(sub.pairAddress);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-0.5 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-2 px-3 rounded-xl bg-cyber-cardInner/40 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>暂无自选币对，可点击右上角「添加币对」按代币查找或直接填 LP</span>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="text-cyber-cyan hover:underline ml-2 shrink-0 font-medium"
                >
                  立即添加
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Input Form */}
        <div className="space-y-3 text-xs pt-1 border-t border-slate-800/80">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-medium">
                当前监听 LP Pair 地址 <span className="text-rose-400">*</span>
              </label>
              <div className="flex items-center space-x-2 text-[11px]">
                {pairAddressInput && (
                  <a
                    href={getBscScanAddressUrl(pairAddressInput)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-cyber-cyan flex items-center space-x-0.5"
                  >
                    <span>区块浏览器</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() =>
                    setPairAddressInput("0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02")
                  }
                  className="text-cyber-cyan hover:underline"
                >
                  重置为官方测试池
                </button>
              </div>
            </div>
            <input
              type="text"
              placeholder="0x952a...728a2"
              value={pairAddressInput}
              onChange={(e) => setPairAddressInput(e.target.value)}
              className="w-full bg-cyber-cardInner border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-slate-200 outline-none focus:border-cyber-cyan/60 font-mono"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-slate-300">最新交易事件显示条数</span>
            <CyberStepper
              value={maxDisplayEvents}
              onChange={setMaxDisplayEvents}
              min={5}
              max={50}
              step={5}
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <CyberButton
              variant="cyan"
              loading={isSyncing}
              disabled={isListening || isSyncing}
              onClick={handleStartListening}
            >
              <Play className="w-4 h-4" />
              <span>加载 swap 并监听</span>
            </CyberButton>

            <CyberButton
              variant="outline"
              disabled={!isListening}
              onClick={handleStopListening}
            >
              <Square className="w-4 h-4" />
              <span>停止监听</span>
            </CyberButton>
          </div>
        </div>

        {/* Error Notification */}
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

        {/* Sync Progress Indicator */}
        {syncProgress && (isSyncing || syncProgress.percent < 100) && (
          <div className="p-3 bg-cyber-cardInner/70 border border-cyber-border rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-cyber-cyan font-semibold flex items-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{syncProgress.message}</span>
              </span>
              <span className="text-cyber-cyan font-mono font-bold">
                {syncProgress.percent}%
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-cyber-cyan h-1.5 rounded-full transition-all duration-300 shadow-glowCyan"
                style={{ width: `${syncProgress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Active Pair Quick Overview */}
        {activePair && (
          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <div className="font-mono text-slate-300">
              <span className="text-cyber-cyan font-bold">{activePair.token0.symbol}</span>
              <span> / </span>
              <span className="text-rose-400 font-bold">{activePair.token1.symbol}</span>
            </div>
            <div className="text-right text-[11px] text-cyber-textMuted">
              <span>汇率: </span>
              <span className="text-slate-200 font-mono font-semibold">
                1 {activePair.token0.symbol} = {activePair.price1Per0Formatted} {activePair.token1.symbol}
              </span>
            </div>
          </div>
        )}
      </CyberCard>

      {/* Swap Information Card & Dual Reserves */}
      {activePair && (
        <>
          <SwapInfoView
            pairAddress={activePair.pairAddress}
            initialOverview={activePair}
          />
          <PriceTrendView
            events={recentEvents}
            token0Symbol={activePair.token0.symbol}
            token1Symbol={activePair.token1.symbol}
            currentPrice={activePair.price1Per0}
          />
        </>
      )}


      {/* Custom Contract Execution Panel */}
      <CustomContractPanel
        config={customContract}
        onChange={setCustomContract}
      />


      {/* Real-time Events Streaming Feed */}
      <RecentEventsTable
        events={recentEvents}
        token0Symbol={activePair?.token0.symbol}
        token1Symbol={activePair?.token1.symbol}
        maxDisplay={maxDisplayEvents}
      />

      {/* Add Pair Modal */}
      <AddPairModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
    </div>
  );
};
