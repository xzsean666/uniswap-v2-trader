import React from "react";
import { ExternalLink, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";
import type { SwapLogPayload } from "../../services/sync/event-emitter";
import { formatAddress } from "../../wallet/ethereum";

export interface RecentEventsTableProps {
  events: SwapLogPayload[];
  token0Symbol?: string;
  token1Symbol?: string;
  maxDisplay?: number;
}

export const RecentEventsTable: React.FC<RecentEventsTableProps> = ({
  events,
  token0Symbol = "Token0",
  token1Symbol = "Token1",
  maxDisplay = 15,
}) => {
  const displayEvents = events.slice(0, maxDisplay);

  return (
    <CyberCard className="space-y-3">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse" />
          <h3 className="font-bold text-sm text-slate-100">
            最新 Swap 交易事件流
          </h3>
        </div>
        <span className="text-[11px] text-cyber-textMuted font-mono">
          实时抓取 ({displayEvents.length} 条)
        </span>
      </div>

      {displayEvents.length === 0 ? (
        <div className="py-8 text-center text-xs text-cyber-textMuted">
          暂无最新交易事件。请开启监听后等待链上出块或历史数据抓取。
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
          {displayEvents.map((ev, index) => {
            const isBuy = ev.direction === "buy";
            const isSell = ev.direction === "sell";
            const timeStr = new Date(ev.timestamp).toLocaleTimeString();

            return (
              <div
                key={`${ev.transactionHash}-${ev.logIndex}-${index}`}
                className="bg-cyber-cardInner/60 border border-slate-800/80 hover:border-cyber-border rounded-xl p-2.5 flex items-center justify-between text-xs transition-all animate-fadeIn"
              >
                {/* Left Direction & Amounts */}
                <div className="flex items-center space-x-2">
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
                    <div className="flex items-center space-x-1.5 font-medium">
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
                      <span className="text-slate-200 font-mono text-[11px]">
                        {token0Symbol} ⇄ {token1Symbol}
                      </span>
                    </div>

                    <div className="text-[10px] text-cyber-textMuted flex items-center space-x-2 pt-0.5 font-mono">
                      <span>区块 #{ev.blockNumber}</span>
                      <span>{timeStr}</span>
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
