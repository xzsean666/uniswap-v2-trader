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
  Play,
} from "lucide-react";
import { parseUnits, type Address } from "viem";
import { CyberCard } from "../../components/ui/CyberCard";
import { CyberSwitch } from "../../components/ui/CyberSwitch";
import { CyberStepper } from "../../components/ui/CyberStepper";
import { CyberButton } from "../../components/ui/CyberButton";
import {
  type AutoTradeConfig,
  type TradeSideConfig,
} from "../../strategies/auto-trade-types";
import { StrategyStore } from "../../strategies/strategy-store";
import { useWallet } from "../../hooks/useWallet";
import { useNotification } from "../../components/notification/NotificationContext";
import { simulateTradeDryRun } from "../../strategies/reverse-trade-engine";
import { checkAndApprove } from "../../services/trading/token-approval";
import {
  dispatchSwapTransaction,
  waitForTransactionReceipt,
} from "../../services/trading/trade-dispatcher";
import { executeKeeperSwap } from "../../services/trading/keeper-executor";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { useKeeper } from "../../context/KeeperContext";
import { KeeperCard } from "../../components/keeper/KeeperCard";

export interface ReverseTradePanelProps {
  pairAddress?: string;
  token0Symbol?: string;
  token1Symbol?: string;
  token0Address?: Address;
  token1Address?: Address;
  token0Decimals?: number;
  token1Decimals?: number;
  currentPrice?: number;
  customProxy?: {
    enabled: boolean;
    contractAddress?: Address;
    methodName?: string;
  };
}

export const ReverseTradePanel: React.FC<ReverseTradePanelProps> = ({
  pairAddress = "default",
  token0Symbol = "ACP",
  token1Symbol = "USDT",
  token0Address = CONTRACT_ADDRESSES.WBNB,
  token1Address = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as Address,
  token0Decimals = 18,
  token1Decimals = 18,
  currentPrice = 0.99365,
  customProxy,
}) => {
  const { address, provider, isConnected, isBscTestnet, chainId } = useWallet();
  const { showNotification } = useNotification();
  const {
    keeper,
    isBoundToCurrentProxy,
    isSilentEnabled,
    proxyAddress,
    refreshBalance,
  } = useKeeper();
  const [isExecuting, setIsExecuting] = useState<"buy" | "sell" | null>(null);

  const [config, setConfig] = useState<AutoTradeConfig>(() =>
    StrategyStore.loadAutoTrade(pairAddress)
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setConfig(StrategyStore.loadAutoTrade(pairAddress));
  }, [pairAddress]);

  const updateBuy = (updater: (prev: TradeSideConfig) => TradeSideConfig) => {
    setConfig((prev) => ({ ...prev, buy: updater(prev.buy) }));
  };

  const updateSell = (updater: (prev: TradeSideConfig) => TradeSideConfig) => {
    setConfig((prev) => ({ ...prev, sell: updater(prev.sell) }));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleApplyBuy = () => {
    StrategyStore.saveAutoTrade(config);
    showToast("反向买入策略设置已保存并应用！");
  };

  const handleApplySell = () => {
    StrategyStore.saveAutoTrade(config);
    showToast("反向卖出策略设置已保存并应用！");
  };

  const handleSimulateAndExecute = async (side: "buy" | "sell") => {
    if (!isConnected || !address || !provider) {
      showNotification({
        status: "failed",
        title: "未连接钱包",
        message: "请先点击顶部栏连接 Web3 钱包。",
      });
      return;
    }

    if (!isBscTestnet) {
      showNotification({
        status: "failed",
        title: "网络错误",
        message: "当前未处于 BSC 测试网，请先切换网络后再试。",
      });
      return;
    }

    const sideConfig = side === "buy" ? config.buy : config.sell;
    const tokenIn = side === "buy" ? token1Address : token0Address;
    const tokenOut = side === "buy" ? token0Address : token1Address;
    const symbolIn = side === "buy" ? token1Symbol : token0Symbol;
    const symbolOut = side === "buy" ? token0Symbol : token1Symbol;
    const decimalsIn = side === "buy" ? token1Decimals : token0Decimals;
    const decimalsOut = side === "buy" ? token0Decimals : token1Decimals;

    // Determine if Keeper silent mode is fully active
    const isKeeperMode = isSilentEnabled && !!keeper && isBoundToCurrentProxy;

    // Spender determination: if custom proxy is active, approve custom proxy contract;
    // otherwise if keeper silent mode is enabled, approve proxyAddress; otherwise PancakeSwap Router
    const spender =
      customProxy?.enabled && customProxy.contractAddress
        ? (customProxy.contractAddress as Address)
        : isKeeperMode
        ? proxyAddress
        : CONTRACT_ADDRESSES.PANCAKE_ROUTER;

    // Dynamic slippage: incorporates tax rate if tax deduction is active
    const baseSlippage = sideConfig.slippage ? 1.5 : 5.0;
    const taxRate = sideConfig.taxActive ? sideConfig.taxRate : 0;
    const totalSlippage = baseSlippage + taxRate;

    setIsExecuting(side);
    try {
      showNotification({
        status: "pending",
        title: "正在执行链上模拟 (Dry-Run)...",
        message: `检测 ${symbolIn} -> ${symbolOut} 交易输出与防貔貅机制`,
      });

      const tradeAmount = sideConfig.minAmount;
      const simResult = await simulateTradeDryRun({
        side,
        amountInFormatted: tradeAmount,
        decimalsIn,
        decimalsOut,
        tokenIn,
        tokenOut,
        priceFloor: sideConfig.priceFloor,
      });

      if (!simResult.allowed) {
        showNotification({
          status: "failed",
          title: "模拟预执行拦截",
          message: simResult.reason || "交易未通过安全策略校验",
        });
        return;
      }

      showNotification({
        status: "approving",
        title: `检查 ${symbolIn} 授权...`,
        message: `向 ${
          spender === CONTRACT_ADDRESSES.PANCAKE_ROUTER
            ? "PancakeSwap 路由"
            : spender === proxyAddress
            ? "Keeper 代理交易合约"
            : "自定义代理合约"
        } 检查额度`,
      });

      const amountInBigInt = parseUnits(tradeAmount.toString(), decimalsIn);
      const approveRes = await checkAndApprove(
        provider,
        address as Address,
        spender,
        tokenIn,
        amountInBigInt
      );

      if (!approveRes.approved && approveRes.txHash) {
        showNotification({
          status: "pending",
          title: `代币授权交易已广播`,
          message: "正在等待区块节点打包确认...",
          txHash: approveRes.txHash,
        });
        await waitForTransactionReceipt(approveRes.txHash, 30000, 2000);
      }

      const expectedOut = simResult.expectedAmountOut || amountInBigInt;
      let swapTxHash: `0x${string}`;

      if (isKeeperMode && keeper) {
        showNotification({
          status: "broadcasting",
          title: `打工小号 (Keeper) 正在免弹窗静默签名...`,
          message: `由专属 Keeper 代发交易，资产全额回流主钱包`,
        });

        const keeperRes = await executeKeeperSwap({
          keeperPrivateKey: keeper.privateKey,
          proxyAddress,
          userAddress: address as Address,
          tokenIn,
          tokenOut,
          amountIn: amountInBigInt,
          expectedAmountOut: expectedOut,
          slippagePercent: totalSlippage,
          isFeeOnTransfer: sideConfig.taxActive,
          chainId: chainId ?? 97,
        });

        swapTxHash = keeperRes.txHash;
      } else {
        showNotification({
          status: "broadcasting",
          title: `正在发起 ${side === "buy" ? "反向买入" : "反向卖出"} 交易签名...`,
          message: "请在钱包插件中确认签名交易",
        });

        const swapRes = await dispatchSwapTransaction(provider, {
          side,
          tokenIn,
          tokenOut,
          amountIn: amountInBigInt,
          expectedAmountOut: expectedOut,
          slippagePercent: totalSlippage,
          recipient: address as Address,
          customProxy:
            customProxy?.enabled && customProxy.contractAddress
              ? customProxy
              : undefined,
        });

        swapTxHash = swapRes.txHash;
      }

      showNotification({
        status: "pending",
        title: `Swap 交易已广播至网络`,
        message: "正在等待区块节点打包确认...",
        txHash: swapTxHash,
      });

      const receipt = await waitForTransactionReceipt(swapTxHash, 60000, 2000);

      if (isKeeperMode) {
        refreshBalance();
      }

      if (receipt.status === "success") {
        showNotification({
          status: "success",
          title: `${side === "buy" ? "反向买入" : "反向卖出"} 交易已确认！`,
          message: `交易成功打包于区块 #${receipt.blockNumber.toString()}${
            isKeeperMode ? " (Keeper 免弹窗静默成交)" : ""
          }`,
          txHash: swapTxHash,
        });
      } else {
        showNotification({
          status: "failed",
          title: "交易链上执行回滚 (Reverted)",
          message: "交易执行失败，请检查滑点或资金余额",
          txHash: swapTxHash,
        });
      }
    } catch (err: any) {
      showNotification({
        status: "failed",
        title: "交易执行异常",
        message: err?.message || "用户取消或网络异常",
      });
    } finally {
      setIsExecuting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-500/40 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
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
            <span>买入设置</span>
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

          <div className="flex items-center justify-between py-0.5">
            <span className="text-slate-300 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-cyber-cyan" />
              <span>价格下限</span>
            </span>
            <span className="text-slate-300 font-mono">
              1 {token1Symbol} 至少兑换{" "}
              <span className="text-cyber-cyan font-bold">
                {config.buy.priceFloor} {token0Symbol}
              </span>
            </span>
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
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>{token1Symbol}价格涨幅至</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.buy.riseThreshold}
                onChange={(riseThreshold) =>
                  updateBuy((b) => ({ ...b, riseThreshold }))
                }
                suffix="%"
                min={0.1}
                max={100}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.buy.riseActive}
                onChange={(riseActive) =>
                  updateBuy((b) => ({ ...b, riseActive }))
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

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <CyberButton
            variant="outline"
            className="text-xs"
            loading={isExecuting === "buy"}
            onClick={() => handleSimulateAndExecute("buy")}
          >
            <Play className="w-3.5 h-3.5" />
            <span>模拟并执行</span>
          </CyberButton>
          <CyberButton
            variant="gradient"
            className="text-xs"
            onClick={handleApplyBuy}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>应用设置</span>
          </CyberButton>
        </div>
      </CyberCard>

      {/* Sell Settings Card */}
      <CyberCard className="space-y-4 border-cyber-border">
        {/* Card Header */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-2 text-rose-400 font-bold text-base">
            <ArrowUp className="w-5 h-5" />
            <span>卖出设置</span>
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

        {/* Price Display */}
        <div className="flex items-center justify-between text-xs py-1 border-y border-slate-800/60">
          <div className="flex items-center space-x-1 text-slate-300 font-medium">
            <span className="text-rose-400">⇄</span>
            <span>
              {token0Symbol}兑换{token1Symbol}
            </span>
          </div>
          <div className="text-right">
            <span className="text-cyber-textMuted">实时价格: </span>
            <span className="text-rose-400 font-bold font-mono">
              {currentPrice} {token1Symbol}
            </span>
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

          <div className="flex items-center justify-between py-0.5">
            <span className="text-slate-300 flex items-center space-x-1">
              <Shield className="w-3.5 h-3.5 text-rose-400" />
              <span>价格下限</span>
            </span>
            <span className="text-slate-300 font-mono">
              1 {token0Symbol} 至少兑换{" "}
              <span className="text-rose-400 font-bold">
                {config.sell.priceFloor} {token1Symbol}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>{token0Symbol}价格跌幅至</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.sell.dropThreshold}
                onChange={(dropThreshold) =>
                  updateSell((s) => ({ ...s, dropThreshold }))
                }
                suffix="%"
                min={0.1}
                max={100}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.sell.dropActive}
                onChange={(dropActive) =>
                  updateSell((s) => ({ ...s, dropActive }))
                }
              />
            </div>
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

          <div className="flex items-center justify-between">
            <span className="text-slate-300 flex items-center space-x-1">
              <Percent className="w-3.5 h-3.5 text-rose-400" />
              <span>设置扣税比例</span>
            </span>
            <div className="flex items-center space-x-2">
              <CyberStepper
                value={config.sell.taxRate}
                onChange={(taxRate) => updateSell((s) => ({ ...s, taxRate }))}
                suffix="%"
                min={0}
                max={25}
                step={0.5}
              />
              <CyberSwitch
                size="sm"
                checked={config.sell.taxActive}
                onChange={(taxActive) =>
                  updateSell((s) => ({ ...s, taxActive }))
                }
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <CyberButton
            variant="outline"
            className="text-xs"
            loading={isExecuting === "sell"}
            onClick={() => handleSimulateAndExecute("sell")}
          >
            <Play className="w-3.5 h-3.5" />
            <span>模拟并执行</span>
          </CyberButton>
          <CyberButton
            variant="dark"
            className="text-xs"
            onClick={handleApplySell}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>应用设置</span>
          </CyberButton>
        </div>
      </CyberCard>
    </div>
  );
};
