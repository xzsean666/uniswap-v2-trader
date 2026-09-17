import React, { useState, useEffect } from "react";
import {
  Menu,
  Globe,
  Wallet,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Server,
} from "lucide-react";
import { useWallet } from "./hooks/useWallet";
import { SegmentedTabs } from "./components/ui/SegmentedTabs";
import { SubTabs } from "./components/ui/SubTabs";
import { CyberButton } from "./components/ui/CyberButton";
import { SwapMonitorView } from "./views/swap-monitor/SwapMonitorView";
import { AutoTradePanel } from "./views/strategy/AutoTradePanel";
import { PriceGrowthPanel } from "./views/strategy/PriceGrowthPanel";
import { ReverseTradePanel } from "./views/strategy/ReverseTradePanel";
import { TestnetFaucetView } from "./views/faucet/TestnetFaucetView";
import { RpcPoolManager } from "./services/rpc/rpc-pool-manager";
import { RpcManagerModal } from "./components/rpc/RpcManagerModal";
import { KeeperCard } from "./components/keeper/KeeperCard";
import { PairDropdownSelector } from "./components/pair-selector/PairDropdownSelector";

import { useActivePair } from "./context/ActivePairContext";

export type PrimaryTab = "monitor" | "strategy" | "faucet";
export type StrategySubTab = "keeper" | "reverse" | "auto" | "arbitrage";

export const App: React.FC = () => {
  const {
    address,
    formattedAddress,
    isConnected,
    isConnecting,
    isBscTestnet,
    isAuthenticated,
    error,
    connect,
    disconnect,
    switchToBsc,
    signIn,
    clearError,
  } = useWallet();

  const { activePair, subscriptions, selectPair } = useActivePair();

  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const [showRpcModal, setShowRpcModal] = useState(false);
  const [activeRpcCount, setActiveRpcCount] = useState(() =>
    RpcPoolManager.getActiveRpcUrls(97).length
  );

  useEffect(() => {
    const unsub = RpcPoolManager.onPoolChange((_cId, urls) => {
      setActiveRpcCount(urls.length);
    });
    return unsub;
  }, []);

  const [primaryTab, setPrimaryTab] = useState<PrimaryTab>("strategy");
  const [strategySubTab, setStrategySubTab] =
    useState<StrategySubTab>("reverse");

  return (
    <div className="min-h-screen bg-cyber-bg text-cyber-textPrimary flex flex-col items-center selection:bg-cyber-cyan/30">
      {/* Mobile/Tablet Centered Frame Container */}
      <div className="w-full max-w-md md:max-w-xl min-h-screen flex flex-col bg-cyber-bg px-4 py-3 sm:px-6">
        {/* Top Cyber Navigation Bar */}
        <header className="relative flex items-center justify-between py-2 mb-3 border-b border-slate-800/80">
          <button
            type="button"
            className="p-1.5 text-cyber-cyan hover:bg-cyber-cyan/10 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Center Wallet & Network Status */}
          {isConnected ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowWalletMenu((prev) => !prev)}
                className="flex items-center space-x-2 bg-cyber-cardInner/80 hover:bg-cyber-cardInner px-3 py-1 rounded-full border border-cyber-border transition-all"
              >
                <span className="text-cyber-cyan font-mono font-semibold text-xs sm:text-sm">
                  {formattedAddress}
                </span>
                {isBscTestnet ? (
                  <span className="text-[11px] text-emerald-400 font-medium px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/30">
                    BSC测试网
                  </span>
                ) : (
                  <span className="text-[11px] text-amber-400 font-medium px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30">
                    网络错误
                  </span>
                )}
                <div className="flex items-center space-x-1 pl-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAuthenticated ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                    }`}
                  />
                </div>
              </button>

              {/* Wallet Dropdown Menu */}
              {showWalletMenu && (
                <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 w-64 bg-cyber-card border border-cyber-border rounded-xl p-3 shadow-2xl shadow-cyan-950/50 backdrop-blur-md">
                  <div className="text-xs text-cyber-textMuted mb-2 pb-2 border-b border-slate-800">
                    当前账户: <span className="font-mono text-slate-200 block truncate">{address}</span>
                  </div>

                  {!isBscTestnet && (
                    <button
                      type="button"
                      onClick={async () => {
                        await switchToBsc();
                        setShowWalletMenu(false);
                      }}
                      className="w-full mb-2 flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>切换至 BSC 测试网</span>
                    </button>
                  )}

                  {!isAuthenticated ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await signIn();
                        setShowWalletMenu(false);
                      }}
                      className="w-full mb-2 flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/40 hover:bg-cyber-cyan/30 font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>EIP-191 签名登录</span>
                    </button>
                  ) : (
                    <div className="text-[11px] text-emerald-400 flex items-center justify-center space-x-1 py-1 mb-2 bg-emerald-500/10 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>签名登录已认证</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      disconnect();
                      setShowWalletMenu(false);
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 px-3 py-1.5 text-xs rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>断开连接</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <CyberButton
              variant="outline"
              size="sm"
              loading={isConnecting}
              onClick={connect}
              className="text-xs font-mono"
            >
              <Wallet className="w-3.5 h-3.5 mr-1" />
              <span>连接钱包</span>
            </CyberButton>
          )}

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setShowRpcModal(true)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-cyber-cardInner/90 hover:bg-cyber-cardInner border border-slate-700/80 hover:border-cyber-cyan/60 text-xs font-mono text-slate-200 transition-all shadow-sm"
              title="管理 RPC 节点池与测速"
            >
              <Server className="w-3.5 h-3.5 text-cyber-cyan" />
              <span className="text-[11px] text-emerald-400 font-semibold">{activeRpcCount}</span>
            </button>

            <button
              type="button"
              onClick={switchToBsc}
              className="p-1.5 text-cyber-cyan hover:bg-cyber-cyan/10 rounded-lg transition-colors"
              title="BSC 测试网"
              aria-label="Network"
            >
              <Globe className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-rose-950/40 border border-rose-500/40 rounded-xl flex items-center justify-between text-xs text-rose-300">
            <span className="truncate mr-2">{error}</span>
            <button
              type="button"
              onClick={clearError}
              className="text-rose-400 hover:text-rose-200 font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Primary Segmented Tabs */}
        <SegmentedTabs
          className="mb-3"
          activeId={primaryTab}
          onChange={(id) => setPrimaryTab(id as PrimaryTab)}
          options={[
            { id: "monitor", label: "监听Swap" },
            { id: "strategy", label: "设置策略" },
            { id: "faucet", label: "测试网水龙头" },
          ]}
        />

        {/* Sub-tabs when in Strategy mode */}
        {primaryTab === "strategy" && (
          <>
            <SubTabs
              className="mb-3"
              activeId={strategySubTab}
              onChange={(id) => setStrategySubTab(id as StrategySubTab)}
              options={[
                { id: "keeper", label: "专属打工小号" },
                { id: "reverse", label: "反买反卖" },
                { id: "auto", label: "AI自动交易" },
                { id: "arbitrage", label: "AI套利机器人" },
              ]}
            />

            {/* Target LP Pair Dropdown Selector with Search */}
            <PairDropdownSelector
              subscriptions={subscriptions}
              activePairAddress={activePair?.pairAddress}
              onSelectPair={selectPair}
              onAddNewPair={async (addr) => {
                await selectPair(addr, true);
              }}
              chainId={97}
              className="mb-3.5"
            />
          </>
        )}

        {/* Viewport Content */}
        <main className="flex-1 space-y-4 pb-12">
          {primaryTab === "strategy" && strategySubTab === "keeper" && (
            <KeeperCard />
          )}

          {primaryTab === "strategy" && strategySubTab === "reverse" && (
            <ReverseTradePanel
              pairAddress={activePair?.pairAddress}
              token0Symbol={activePair?.token0.symbol}
              token1Symbol={activePair?.token1.symbol}
              token0Address={activePair?.token0.address}
              token1Address={activePair?.token1.address}
              token0Decimals={activePair?.token0.decimals}
              token1Decimals={activePair?.token1.decimals}
              currentPrice={activePair?.price1Per0}
              onNavigateToKeeper={() => setStrategySubTab("keeper")}
            />
          )}

          {primaryTab === "strategy" && strategySubTab === "auto" && (
            <AutoTradePanel
              pairAddress={activePair?.pairAddress}
              token0Symbol={activePair?.token0.symbol}
              token1Symbol={activePair?.token1.symbol}
              currentPrice={activePair?.price1Per0}
              onNavigateToKeeper={() => setStrategySubTab("keeper")}
            />
          )}

          {primaryTab === "strategy" && strategySubTab === "arbitrage" && (
            <PriceGrowthPanel
              pairAddress={activePair?.pairAddress}
              token0Symbol={activePair?.token0.symbol}
              token1Symbol={activePair?.token1.symbol}
              currentPrice={activePair?.price1Per0}
              onNavigateToKeeper={() => setStrategySubTab("keeper")}
            />
          )}

          {primaryTab === "monitor" && (
            <SwapMonitorView
              onNavigateToStrategy={(addr) => {
                if (addr) selectPair(addr);
                setPrimaryTab("strategy");
                setStrategySubTab("reverse");
              }}
            />
          )}

          {primaryTab === "faucet" && (
            <TestnetFaucetView
              onNavigate={(tab, subTab) => {
                setPrimaryTab(tab as PrimaryTab);
                if (subTab) {
                  setStrategySubTab(subTab as StrategySubTab);
                }
              }}
            />
          )}

        </main>

        {/* Global RPC Node Pool Manager Modal */}
        <RpcManagerModal
          isOpen={showRpcModal}
          onClose={() => setShowRpcModal(false)}
        />
      </div>
    </div>
  );
};
