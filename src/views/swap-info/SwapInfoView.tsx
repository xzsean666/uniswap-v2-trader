import React, { useState, useEffect, useCallback } from "react";
import { RefreshCw, ArrowLeftRight } from "lucide-react";
import { formatUnits, type Address } from "viem";
import { TokenReserveCard } from "./TokenReserveCard";
import { CyberCard } from "../../components/ui/CyberCard";
import {
  fetchPairOverview,
  type PairOverview,
} from "../../services/pair/pair-reader";
import { multicallRead } from "../../evm/multicall";
import { ERC20_ABI } from "../../abi/pancake";
import { syncEvents } from "../../services/sync/event-emitter";
import { formatAddress } from "../../wallet/ethereum";
import { useWallet } from "../../wallet/WalletContext";

export interface SwapInfoViewProps {
  pairAddress: Address;
  initialOverview?: PairOverview | null;
  userAddress?: string | null;
}

export const SwapInfoView: React.FC<SwapInfoViewProps> = ({
  pairAddress,
  initialOverview,
  userAddress,
}) => {
  const { address: walletAddress } = useWallet();
  const effectiveUserAddress = userAddress || walletAddress;

  const [overview, setOverview] = useState<PairOverview | null>(
    initialOverview ?? null
  );
  const [userToken0Balance, setUserToken0Balance] = useState<string | undefined>();
  const [userToken1Balance, setUserToken1Balance] = useState<string | undefined>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const latest = await fetchPairOverview(pairAddress);
      setOverview(latest);
      setLastUpdated(Date.now());

      // If user wallet is connected, query user balances
      if (effectiveUserAddress) {
        const balanceCalls = [
          {
            target: latest.token0.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [effectiveUserAddress as Address],
          },
          {
            target: latest.token1.address,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [effectiveUserAddress as Address],
          },
        ];

        const [b0Res, b1Res] = await multicallRead(balanceCalls);
        if (b0Res.success) {
          setUserToken0Balance(
            formatUnits(b0Res.result as bigint, latest.token0.decimals)
          );
        }
        if (b1Res.success) {
          setUserToken1Balance(
            formatUnits(b1Res.result as bigint, latest.token1.decimals)
          );
        }
      }
    } catch (err) {
      console.error("Error refreshing swap info data:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [pairAddress, effectiveUserAddress]);

  useEffect(() => {
    refreshData();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // Auto refresh on new swap event with 400ms debounce to prevent RPC flooding
    const unbind = syncEvents.on("new_swap", (event) => {
      if (event.pairAddress.toLowerCase() === pairAddress.toLowerCase()) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          refreshData();
        }, 400);
      }
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      unbind();
    };
  }, [refreshData, pairAddress]);

  if (!overview) {
    return (
      <CyberCard className="p-6 text-center text-xs text-cyber-textMuted space-y-2">
        <span>正在读取池子代币储备量与汇率...</span>
      </CyberCard>
    );
  }

  return (
    <div className="space-y-3">
      {/* Top Summary Bar */}
      <CyberCard className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center space-x-2">
            <ArrowLeftRight className="w-4 h-4 text-cyber-cyan" />
            <span className="font-bold text-sm text-slate-100">
              Swap 实时信息区
            </span>
            <span className="text-[10px] text-cyber-textMuted font-mono px-1.5 py-0.5 rounded bg-slate-800">
              {formatAddress(pairAddress)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-cyber-textMuted font-mono">
              {new Date(lastUpdated).toLocaleTimeString()}
            </span>
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              className="p-1 rounded-lg hover:bg-cyber-cyan/10 text-cyber-cyan transition-all"
              title="刷新储备与价格"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Exchange Rate Highlight */}
        <div className="bg-cyber-cardInner/60 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
          <div className="text-slate-300">
            1 <span className="text-cyber-cyan font-bold">{overview.token0.symbol}</span> ={" "}
            <span className="text-slate-100 font-bold">{overview.price1Per0Formatted}</span>{" "}
            <span className="text-rose-400 font-bold">{overview.token1.symbol}</span>
          </div>

          <div className="text-cyber-textMuted text-[11px]">
            1 <span className="text-rose-400 font-bold">{overview.token1.symbol}</span> ={" "}
            <span className="text-slate-100 font-bold">{overview.price0Per1Formatted}</span>{" "}
            <span className="text-cyber-cyan font-bold">{overview.token0.symbol}</span>
          </div>
        </div>
      </CyberCard>

      {/* Dual Token Reserve Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TokenReserveCard
          tokenSymbol={overview.token0.symbol}
          tokenName={overview.token0.name}
          tokenAddress={overview.token0.address}
          reserveFormatted={overview.token0.reserveFormatted}
          userBalanceFormatted={userToken0Balance}
          priceAgainstOther={overview.price1Per0Formatted}
          otherSymbol={overview.token1.symbol}
          isToken0={true}
        />

        <TokenReserveCard
          tokenSymbol={overview.token1.symbol}
          tokenName={overview.token1.name}
          tokenAddress={overview.token1.address}
          reserveFormatted={overview.token1.reserveFormatted}
          userBalanceFormatted={userToken1Balance}
          priceAgainstOther={overview.price0Per1Formatted}
          otherSymbol={overview.token0.symbol}
          isToken0={false}
        />
      </div>
    </div>
  );
};
