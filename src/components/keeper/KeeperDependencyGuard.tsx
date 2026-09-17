import React from "react";
import {
  Bot,
  AlertTriangle,
  ShieldCheck,
  Fuel,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useKeeper } from "../../context/KeeperContext";
import { CyberButton } from "../ui/CyberButton";

export interface KeeperDependencyGuardProps {
  onNavigateToKeeper: () => void;
  className?: string;
}

export const KeeperDependencyGuard: React.FC<KeeperDependencyGuardProps> = ({
  onNavigateToKeeper,
  className = "",
}) => {
  const { keeper, isBoundToCurrentProxy, keeperBalance } = useKeeper();

  // 1. Missing keeper entirely
  if (!keeper) {
    return (
      <div
        data-testid="keeper-missing-alert"
        className={`p-4 rounded-xl bg-amber-950/30 border border-amber-500/50 space-y-3 ${className}`}
      >
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs">
            <div className="font-bold text-sm text-amber-300">
              必须先配置专属打工小号 (Keeper 托管)
            </div>
            <p className="text-slate-300 leading-relaxed">
              本系统的所有反向交易 (反买/反卖) 与 AI 自动量化交易均由专属打工小号免密代发，资金 100% 强制回流主钱包 (Zero-Theft)。请先生成或导入打工小号。
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <CyberButton
            variant="cyan"
            size="sm"
            onClick={onNavigateToKeeper}
            className="text-xs"
          >
            <span>立即配置专属打工小号</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </CyberButton>
        </div>
      </div>
    );
  }

  // 2. Keeper exists, but not bound on-chain
  if (!isBoundToCurrentProxy) {
    return (
      <div
        data-testid="keeper-unbound-alert"
        className={`p-3 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center justify-between text-xs text-amber-300 flex-wrap gap-2 ${className}`}
      >
        <div className="flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>打工小号尚未在链上绑定至代理合约 (setKeeper)，无法代发交易。</span>
        </div>
        <button
          type="button"
          onClick={onNavigateToKeeper}
          className="text-cyber-cyan hover:underline font-bold flex items-center space-x-1"
        >
          <span>去小号 Tab 授权绑定</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // 3. Keeper exists, but zero/low gas
  if (keeperBalance?.balanceWei === 0n) {
    return (
      <div
        data-testid="keeper-nogas-alert"
        className={`p-3 rounded-xl bg-rose-950/20 border border-rose-500/40 flex items-center justify-between text-xs text-rose-300 flex-wrap gap-2 ${className}`}
      >
        <div className="flex items-center space-x-2">
          <Fuel className="w-4 h-4 text-rose-400 shrink-0" />
          <span>打工小号 Gas 余额为 0 BNB，无法执行链上交易。</span>
        </div>
        <button
          type="button"
          onClick={onNavigateToKeeper}
          className="text-amber-300 hover:underline font-bold flex items-center space-x-1"
        >
          <span>去小号 Tab 充值燃料</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // 4. Fully ready - compact high-tech badge
  return (
    <div
      data-testid="keeper-ready-badge"
      className={`p-2.5 rounded-xl bg-cyber-cardInner/70 border border-slate-800 flex items-center justify-between text-xs flex-wrap gap-2 ${className}`}
    >
      <div className="flex items-center space-x-2 font-mono text-[11px]">
        <div className="p-1 rounded bg-cyber-cyan/15 text-cyber-cyan">
          <Bot className="w-3.5 h-3.5" />
        </div>
        <span className="text-slate-400">小号:</span>
        <span className="text-slate-200 font-semibold truncate max-w-[90px] sm:max-w-[140px]">
          {keeper.address}
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-400">Gas:</span>
        <span className="text-amber-300 font-bold">
          {keeperBalance?.formatted ?? "0.0000"} BNB
        </span>
        <span className="text-slate-600 hidden sm:inline">|</span>
        <span className="text-emerald-400 items-center space-x-0.5 hidden sm:flex">
          <ShieldCheck className="w-3 h-3" />
          <span>已绑定</span>
        </span>
      </div>

      <button
        type="button"
        onClick={onNavigateToKeeper}
        className="text-[11px] text-cyber-cyan hover:underline flex items-center space-x-1"
      >
        <span>管理小号</span>
        <ExternalLink className="w-3 h-3" />
      </button>
    </div>
  );
};
