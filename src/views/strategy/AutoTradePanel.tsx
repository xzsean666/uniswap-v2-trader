import React, { useState, useEffect } from "react";
import {
  ArrowDown,
  ArrowUp,
  Shield,
  Bot,
  Percent,
  TrendingDown,
  TrendingUp,
  Settings,
  HelpCircle,
  Repeat,
  CheckCircle2,
} from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberSwitch } from "../../components/ui/CyberSwitch";
import { CyberStepper } from "../../components/ui/CyberStepper";
import { CyberButton } from "../../components/ui/CyberButton";
import {
  type AutoTradeConfig,
  type TradeSideConfig,
} from "../../strategies/auto-trade-types";
import { StrategyStore } from "../../strategies/strategy-store";
import { KeeperCard } from "../../components/keeper/KeeperCard";

export interface AutoTradePanelProps {
  pairAddress?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  currentPrice?: number;
}

export const AutoTradePanel: React.FC<AutoTradePanelProps> = ({
  pairAddress = "default",
  token0Symbol = "ACP",
  token1Symbol = "USDT",
  currentPrice = 0.99365,
}) => {
  const [config, setConfig] = useState<AutoTradeConfig>(() =>
    StrategyStore.loadAutoTrade(pairAddress)
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setConfig(StrategyStore.loadAutoTrade(pairAddress));
  }, [pairAddress]);

  const updateBuy = (updater: (prev: TradeSideConfig) => TradeSideConfig) => {
    setConfig((prev) => ({ ...prev, buy: updater(prev.buy) }));
  };

  const updateSell = (updater: (prev: TradeSideConfig) => TradeSideConfig) => {
    setConfig((prev) => ({ ...prev, sell: updater(prev.sell) }));
  };

  const handleApplySettings = () => {
    StrategyStore.saveAutoTrade(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Toast feedback */}
      {savedSuccess && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>AI 自动交易配置已成功保存并立即生效！</span>
        </div>
      )}

      {/* Dedicated Keeper Automated Custody Card */}
      <KeeperCard />

      {/* Buy Settings Card */}
      <CyberCard className="space-y-4 border-cyber-border">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-cyber-cyan font-bold text-base">
            <ArrowDown className="w-5 h-5" />
            <span>AI 买入设置</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-cyber-textMuted flex items-center space-x-1">
              <span>启动</span>
              <HelpCircle className="w-3.5 h-3.5 text-cyber-cyan/70 cursor-pointer" />
            </span>
            <CyberSwitch
              size="sm"
              checked={config.buy.active}
              onChange={(active) => updateBuy((b) => ({ ...b, active }))}
            />
          </div>
        </div>

        {/* Grid of Switches */}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Bot className="w-4 h-4 text-cyber-cyan" />
              <span>自动买入</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.buy.auto}
              onChange={(auto) => updateBuy((b) => ({ ...b, auto }))}
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Shield className="w-4 h-4 text-cyber-cyan" />
              <span>滑点保护</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.buy.slippage}
              onChange={(slippage) => updateBuy((b) => ({ ...b, slippage }))}
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Repeat className="w-4 h-4 text-cyber-cyan" />
              <span>防夹子</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.buy.antiSandwich}
              onChange={(antiSandwich) =>
                updateBuy((b) => ({ ...b, antiSandwich }))
              }
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Shield className="w-4 h-4 text-cyber-cyan" />
              <span>防貔貅</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.buy.antiHoneypot}
              onChange={(antiHoneypot) =>
                updateBuy((b) => ({ ...b, antiHoneypot }))
              }
            />
          </div>
        </div>

        {/* Price Display */}
        <div className="flex items-center justify-between text-xs py-1 border-y border-slate-800/60">
          <div className="flex items-center space-x-1 text-slate-300 font-medium">
            <span className="text-cyber-cyan">⇄</span>
            <span>
              {token1Symbol}兑换{token0Symbol}
            </span>
          </div>
          <div className="text-right">
            <span className="text-cyber-textMuted">实时价格: </span>
            <span className="text-cyber-cyan font-bold font-mono">
              {currentPrice} {token0Symbol}
            </span>
          </div>
        </div>

        {/* Numeric Controls */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <ArrowUp className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>单次交易随机上限值</span>
            </span>
            <CyberStepper
              value={config.buy.maxAmount}
              onChange={(maxAmount) => updateBuy((b) => ({ ...b, maxAmount }))}
              min={1}
              max={10000}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <ArrowDown className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>单次交易随机下限值</span>
            </span>
            <CyberStepper
              value={config.buy.minAmount}
              onChange={(minAmount) => updateBuy((b) => ({ ...b, minAmount }))}
              min={1}
              max={config.buy.maxAmount}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>{token1Symbol}价格跌幅至</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.buy.dropThreshold}
                onChange={(dropThreshold) =>
                  updateBuy((b) => ({ ...b, dropThreshold }))
                }
                suffix="%"
                min={0.1}
                max={100}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.buy.dropActive}
                onChange={(dropActive) =>
                  updateBuy((b) => ({ ...b, dropActive }))
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <Percent className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>设置扣税比例</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.buy.taxRate}
                onChange={(taxRate) => updateBuy((b) => ({ ...b, taxRate }))}
                suffix="%"
                min={0}
                max={25}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.buy.taxActive}
                onChange={(taxActive) =>
                  updateBuy((b) => ({ ...b, taxActive }))
                }
              />
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <CyberButton
          variant="gradient"
          fullWidth
          className="mt-4"
          onClick={handleApplySettings}
        >
          <Settings className="w-4 h-4" />
          <span>应用 AI 买入设置</span>
        </CyberButton>
      </CyberCard>

      {/* Sell Settings Card */}
      <CyberCard className="space-y-4 border-cyber-border">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-base">
            <ArrowUp className="w-5 h-5" />
            <span>AI 卖出设置</span>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-cyber-textMuted flex items-center space-x-1">
              <span>启动</span>
              <HelpCircle className="w-3.5 h-3.5 text-cyber-cyan/70 cursor-pointer" />
            </span>
            <CyberSwitch
              size="sm"
              checked={config.sell.active}
              onChange={(active) => updateSell((s) => ({ ...s, active }))}
            />
          </div>
        </div>

        {/* Grid of Switches */}
        <div className="grid grid-cols-2 gap-3 py-1">
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Bot className="w-4 h-4 text-rose-400" />
              <span>自动卖出</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.sell.auto}
              onChange={(auto) => updateSell((s) => ({ ...s, auto }))}
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Shield className="w-4 h-4 text-rose-400" />
              <span>滑点保护</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.sell.slippage}
              onChange={(slippage) => updateSell((s) => ({ ...s, slippage }))}
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Repeat className="w-4 h-4 text-rose-400" />
              <span>防夹子</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.sell.antiSandwich}
              onChange={(antiSandwich) =>
                updateSell((s) => ({ ...s, antiSandwich }))
              }
            />
          </div>
          <div className="flex items-center justify-between bg-cyber-cardInner/60 px-3 py-2 rounded-xl border border-slate-800">
            <div className="flex items-center space-x-2 text-xs text-slate-200">
              <Shield className="w-4 h-4 text-rose-400" />
              <span>防貔貅</span>
            </div>
            <CyberSwitch
              size="sm"
              checked={config.sell.antiHoneypot}
              onChange={(antiHoneypot) =>
                updateSell((s) => ({ ...s, antiHoneypot }))
              }
            />
          </div>
        </div>

        {/* Numeric Controls */}
        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <ArrowUp className="w-3.5 h-3.5 text-rose-400" />
              <span>单次交易随机上限值</span>
            </span>
            <CyberStepper
              value={config.sell.maxAmount}
              onChange={(maxAmount) =>
                updateSell((s) => ({ ...s, maxAmount }))
              }
              min={1}
              max={10000}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <ArrowDown className="w-3.5 h-3.5 text-rose-400" />
              <span>单次交易随机下限值</span>
            </span>
            <CyberStepper
              value={config.sell.minAmount}
              onChange={(minAmount) =>
                updateSell((s) => ({ ...s, minAmount }))
              }
              min={1}
              max={config.sell.maxAmount}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>{token0Symbol}价格涨幅至</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.sell.riseThreshold}
                onChange={(riseThreshold) =>
                  updateSell((s) => ({ ...s, riseThreshold }))
                }
                suffix="%"
                min={0.1}
                max={100}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.sell.riseActive}
                onChange={(riseActive) =>
                  updateSell((s) => ({ ...s, riseActive }))
                }
              />
            </div>
          </div>
        </div>

        {/* Apply Button */}
        <CyberButton
          variant="dark"
          fullWidth
          className="mt-4"
          onClick={handleApplySettings}
        >
          <Settings className="w-4 h-4" />
          <span>应用 AI 卖出设置</span>
        </CyberButton>
      </CyberCard>
    </div>
  );
};
