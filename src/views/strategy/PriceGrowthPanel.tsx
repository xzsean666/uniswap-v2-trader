import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Clock,
  Target,
  Percent,
  RefreshCw,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberSwitch } from "../../components/ui/CyberSwitch";
import { CyberStepper } from "../../components/ui/CyberStepper";
import { CyberButton } from "../../components/ui/CyberButton";
import {
  type PriceGrowthConfig,
  calculateTargetPrice,
} from "../../strategies/auto-trade-types";
import { StrategyStore } from "../../strategies/strategy-store";
import { KeeperDependencyGuard } from "../../components/keeper/KeeperDependencyGuard";

export interface PriceGrowthPanelProps {
  pairAddress?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  currentPrice?: number;
  onNavigateToKeeper?: () => void;
}

export const PriceGrowthPanel: React.FC<PriceGrowthPanelProps> = ({
  pairAddress = "default",
  token0Symbol = "ACP",
  token1Symbol = "USDT",
  currentPrice = 0.99365,
  onNavigateToKeeper,
}) => {
  const [config, setConfig] = useState<PriceGrowthConfig>(() =>
    StrategyStore.loadPriceGrowth(pairAddress, currentPrice)
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setConfig(StrategyStore.loadPriceGrowth(pairAddress, currentPrice));
  }, [pairAddress, currentPrice]);

  const handleGrowthPercentChange = (growth: number) => {
    const target = calculateTargetPrice(config.basePrice, growth);
    setConfig((prev) => ({
      ...prev,
      dailyGrowthPercent: growth,
      targetPrice: target,
    }));
  };

  const handleResetBasePrice = () => {
    const target = calculateTargetPrice(currentPrice, config.dailyGrowthPercent);
    setConfig((prev) => ({
      ...prev,
      basePrice: currentPrice,
      targetPrice: target,
    }));
  };

  const handleApply = () => {
    StrategyStore.savePriceGrowth(config);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {savedSuccess && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>价格增长策略配置已保存并激活！</span>
        </div>
      )}

      {/* Keeper Dependency Status & Guard */}
      <KeeperDependencyGuard onNavigateToKeeper={onNavigateToKeeper || (() => {})} />

      {/* Main Strategy Card */}
      <CyberCard className="space-y-4 border-cyber-border">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-cyber-cyan font-bold text-base">
            <TrendingUp className="w-5 h-5" />
            <span>价格增长 / AI 套利模式</span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-cyber-textMuted">策略启用</span>
            <CyberSwitch
              size="sm"
              checked={config.active}
              onChange={(active) => setConfig((prev) => ({ ...prev, active }))}
            />
          </div>
        </div>

        {/* Target vs Base Price Display */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-cyber-cardInner/70 p-3 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-cyber-textMuted text-[11px]">
              <span>今日基准价格</span>
              <button
                type="button"
                onClick={handleResetBasePrice}
                className="text-cyber-cyan hover:underline flex items-center space-x-0.5"
                title="重置为当前最新价格"
              >
                <RefreshCw className="w-3 h-3" />
                <span>更新</span>
              </button>
            </div>
            <span className="font-mono text-slate-200 font-bold text-sm block">
              1 {token0Symbol} ≈ {config.basePrice.toFixed(5)} {token1Symbol}
            </span>
          </div>

          <div className="bg-cyber-cardInner/70 p-3 rounded-xl border border-cyber-border space-y-1">
            <div className="text-cyber-cyan font-medium text-[11px] flex items-center space-x-1">
              <Target className="w-3.5 h-3.5" />
              <span>今日拉升目标价</span>
            </div>
            <span className="font-mono text-cyber-cyan font-bold text-sm block">
              1 {token0Symbol} ≈ {config.targetPrice.toFixed(5)} {token1Symbol}
            </span>
          </div>
        </div>

        {/* Numeric Steppers */}
        <div className="space-y-3 text-xs pt-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <Percent className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>每日目标涨幅比例</span>
            </span>
            <CyberStepper
              value={config.dailyGrowthPercent}
              onChange={handleGrowthPercentChange}
              suffix="%"
              min={0.5}
              max={100}
              step={0.5}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>日内拉升持续时长</span>
            </span>
            <CyberStepper
              value={config.durationHours}
              onChange={(durationHours) =>
                setConfig((prev) => ({ ...prev, durationHours }))
              }
              suffix="小时"
              min={1}
              max={24}
              step={1}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <Sliders className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>分批定投拉升间隔</span>
            </span>
            <CyberStepper
              value={config.intervalMinutes}
              onChange={(intervalMinutes) =>
                setConfig((prev) => ({ ...prev, intervalMinutes }))
              }
              suffix="分钟"
              min={5}
              max={180}
              step={5}
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-slate-300">每日 00:00 自动重置基准价</span>
            <CyberSwitch
              size="sm"
              checked={config.autoResetDaily}
              onChange={(autoResetDaily) =>
                setConfig((prev) => ({ ...prev, autoResetDaily }))
              }
            />
          </div>
        </div>

        {/* Apply Button */}
        <CyberButton
          variant="gradient"
          fullWidth
          className="mt-4"
          onClick={handleApply}
        >
          <TrendingUp className="w-4 h-4" />
          <span>应用价格增长策略</span>
        </CyberButton>
      </CyberCard>
    </div>
  );
};
