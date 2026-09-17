import React from "react";
import { Coins, Wallet } from "lucide-react";
import { CyberCard } from "../../components/ui/CyberCard";

export interface TokenReserveCardProps {
  tokenSymbol: string;
  tokenName: string;
  tokenAddress: string;
  reserveFormatted: string;
  userBalanceFormatted?: string;
  priceAgainstOther: string;
  otherSymbol: string;
  isToken0?: boolean;
}

export const TokenReserveCard: React.FC<TokenReserveCardProps> = ({
  tokenSymbol,
  tokenName,
  reserveFormatted,
  userBalanceFormatted,
  priceAgainstOther,
  otherSymbol,
  isToken0 = true,
}) => {
  const accentColor = isToken0 ? "text-cyber-cyan" : "text-rose-400";
  const borderAccent = isToken0 ? "border-cyber-border" : "border-rose-500/30";
  const bgAccent = isToken0 ? "bg-cyber-cyan/10" : "bg-rose-500/10";

  return (
    <CyberCard className={`space-y-3 ${borderAccent} transition-all`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center space-x-2">
          <div className={`p-1.5 rounded-lg ${bgAccent} ${accentColor}`}>
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-100 font-mono">
              {tokenSymbol}
            </h4>
            <span className="text-[10px] text-cyber-textMuted block">
              {tokenName}
            </span>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-cyber-textMuted block">当前参考价</span>
          <span className={`text-xs font-mono font-bold ${accentColor}`}>
            1 {tokenSymbol} ≈ {priceAgainstOther} {otherSymbol}
          </span>
        </div>
      </div>

      {/* Reserves & Balance Details */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-cyber-cardInner/70 p-2.5 rounded-xl border border-slate-800">
          <span className="text-[11px] text-cyber-textMuted block mb-1">
            LP 池内储备量
          </span>
          <span className="font-mono text-slate-200 font-semibold truncate block">
            {Number(reserveFormatted).toLocaleString(undefined, {
              maximumFractionDigits: 4,
            })}{" "}
            <span className="text-[10px] text-slate-400">{tokenSymbol}</span>
          </span>
        </div>

        <div className="bg-cyber-cardInner/70 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-cyber-textMuted flex items-center space-x-1">
              <Wallet className="w-3 h-3 text-slate-400" />
              <span>我的钱包余额</span>
            </span>
          </div>
          <span className="font-mono text-cyber-cyan font-semibold truncate block">
            {userBalanceFormatted !== undefined
              ? Number(userBalanceFormatted).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })
              : "--"}{" "}
            <span className="text-[10px] text-slate-400">{tokenSymbol}</span>
          </span>
        </div>
      </div>
    </CyberCard>
  );
};
