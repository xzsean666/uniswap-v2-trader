import React, { useState, useMemo } from "react";
import {
  ExternalLink,
  ArrowDownRight,
  ArrowUpRight,
  RotateCw,
  Loader2,
  Zap,
  Clock,
} from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import type { SwapLogPayload } from "../../services/sync/event-emitter";
import { formatAddress } from "../../wallet/ethereum";

export interface RecentEventsTableProps {
  events: SwapLogPayload[];
  title?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  maxDisplay?: number;
  pairLabelMap?: Record<string, string>;
  isLoadingHistory?: boolean;
  onRefreshHistory?: () => Promise<void> | void;
}

export type EventFilterType = "all" | "realtime" | "historical";

function formatEventTime(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return "--:--:--";
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 10) return "刚刚";
  if (diffSec < 60) return `${diffSec}秒前`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;

  const date = new Date(timestamp);
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${m}-${d} ${h}:${min}`;
}

export const RecentEventsTable: React.FC<RecentEventsTableProps> = ({
  events,
  title = "多币对聚合 Swap 交易事件流 (实时监控 + 历史归档)",
  token0Symbol = "Token0",
  token1Symbol = "Token1",
  maxDisplay = 15,
  pairLabelMap,
  isLoadingHistory = false,
  onRefreshHistory,
}) => {
  const [filter, setFilter] = useState<EventFilterType>("all");

  const realtimeCount = useMemo(
    () => events.filter((e) => e.source === "realtime").length,
    [events]
  );
  const historicalCount = useMemo(
    () => events.filter((e) => e.source !== "realtime").length,
    [events]
  );

  const filteredEvents = useMemo(() => {
    if (filter === "realtime") {
      return events.filter((e) => e.source === "realtime");
    }
    if (filter === "historical") {
      return events.filter((e) => e.source !== "realtime");
    }
    return events;
  }, [events, filter]);

  const displayEvents = filteredEvents.slice(0, maxDisplay);

  return (
    <CyberCard className="space-y-3">
      {/* Header with Title, Source Filter & Refresh History button */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyber-cyan animate-pulse" />
          <h3 className="font-bold text-sm text-slate-100">{title}</h3>
        </div>

        <div className="flex items-center space-x-2">
          {/* Filter Pills (All / Real-time / Historical) */}
          <div className="flex items-center bg-cyber-cardInner border border-slate-800 rounded-lg p-0.5 text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`px-2 py-0.5 rounded transition-colors ${
                filter === "all"
                  ? "bg-cyber-cyan/20 text-cyber-cyan font-bold border border-cyber-cyan/40"
                  : "text-cyber-textMuted hover:text-slate-200"
              }`}
            >
              全部 ({events.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("realtime")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center space-x-1 ${
                filter === "realtime"
                  ? "bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40"
                  : "text-cyber-textMuted hover:text-slate-200"
              }`}
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>实时 ({realtimeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setFilter("historical")}
              className={`px-2 py-0.5 rounded transition-colors flex items-center space-x-1 ${
                filter === "historical"
                  ? "bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40"
                  : "text-cyber-textMuted hover:text-slate-200"
              }`}
            >
              <Clock className="w-3 h-3 text-purple-400" />
              <span>历史 ({historicalCount})</span>
            </button>
          </div>

          {/* Refresh History Action Button */}
          {onRefreshHistory && (
            <button
              type="button"
              onClick={() => onRefreshHistory()}
              disabled={isLoadingHistory}
              title="重新从链上同步历史 Swap 交易"
              className="p-1 rounded-lg bg-cyber-cardInner border border-slate-800 hover:border-cyber-cyan/50 text-cyber-textMuted hover:text-cyber-cyan transition-colors disabled:opacity-50"
            >
              <RotateCw
                className={`w-3.5 h-3.5 ${isLoadingHistory ? "animate-spin text-cyber-cyan" : ""}`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoadingHistory && events.length === 0 ? (
        <div className="py-8 text-center text-xs text-cyber-cyan flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-5 h-5 animate-spin text-cyber-cyan" />
          <span>正在连接区块链节点同步历史 Swap 交易事件...</span>
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="py-8 text-center text-xs text-cyber-textMuted space-y-2">
          <div>
            {filter === "realtime"
              ? "暂无新捕获的实时交易，等待链上出块中..."
              : filter === "historical"
              ? "暂无归档历史交易事件。"
              : "暂无 Swap 交易事件。"}
          </div>
          {onRefreshHistory && (
            <button
              type="button"
              onClick={() => onRefreshHistory()}
              className="text-cyber-cyan hover:underline text-[11px] font-mono pt-1 inline-block"
            >
              点击刷新同步历史数据
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {displayEvents.map((ev, index) => {
            const isBuy = ev.direction === "buy";
            const isSell = ev.direction === "sell";
            const isRealtime = ev.source === "realtime";
            const timeStr = formatEventTime(ev.timestamp);

            return (
              <div
                key={`${ev.transactionHash}-${ev.logIndex}-${index}`}
                className="bg-cyber-cardInner/60 border border-slate-800/80 hover:border-cyber-border rounded-xl p-2.5 flex items-center justify-between text-xs transition-all animate-fadeIn"
              >
                {/* Left Direction, Badges & Amounts */}
                <div className="flex items-center space-x-2.5">
                  <div
                    className={`p-1.5 rounded-lg flex items-center justify-center ${
                      isBuy
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : isSell
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        : "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                    }`}
                  >
                    {isBuy ? (
                      <ArrowDownRight className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-1.5 font-medium flex-wrap gap-y-1">
                      <span
                        className={
                          isBuy
                            ? "text-emerald-400 font-bold"
                            : isSell
                            ? "text-rose-400 font-bold"
                            : "text-slate-200"
                        }
                      >
                        {isBuy ? "买入" : isSell ? "卖出" : "兑换"}
                      </span>

                      {/* LP Pair Symbol Label */}
                      {pairLabelMap && ev.pairAddress && pairLabelMap[ev.pairAddress.toLowerCase()] ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyber-cyan/15 text-cyber-cyan border border-cyber-cyan/30 font-mono font-bold">
                          {pairLabelMap[ev.pairAddress.toLowerCase()]}
                        </span>
                      ) : (
                        <span className="text-slate-200 font-mono text-[11px]">
                          {token0Symbol} ⇄ {token1Symbol}
                        </span>
                      )}

                      {/* Source Tag: Realtime vs Historical */}
                      {isRealtime ? (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono font-bold flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>实时</span>
                        </span>
                      ) : (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-mono font-bold">
                          历史
                        </span>
                      )}

                      {/* Volume detail if available */}
                      {(ev.amount0 !== "0" || ev.amount1 !== "0") && (
                        <span className="text-[10px] text-slate-400 font-mono pl-1 hidden sm:inline">
                          ({Number(ev.amount0).toFixed(2)} ⇄ {Number(ev.amount1).toFixed(2)})
                        </span>
                      )}
                    </div>

                    <div className="text-[10px] text-cyber-textMuted flex items-center space-x-2 pt-0.5 font-mono">
                      <span>区块 #{ev.blockNumber}</span>
                      <span>·</span>
                      <span title={new Date(ev.timestamp).toLocaleString()}>{timeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Right TxHash link & Price */}
                <div className="text-right">
                  {ev.effectivePrice !== undefined && (
                    <div className="font-mono text-slate-200 font-semibold text-[11px]">
                      {ev.effectivePrice.toFixed(4)}
                    </div>
                  )}
                  <a
                    href={`https://testnet.bscscan.com/tx/${ev.transactionHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-cyber-cyan/80 hover:text-cyber-cyan flex items-center justify-end space-x-0.5 font-mono"
                  >
                    <span>{formatAddress(ev.transactionHash)}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CyberCard>
  );
};
