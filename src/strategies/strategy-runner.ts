import { parseUnits, type Address } from "viem";
import type {
  AutoTradeConfig,
  AutoTradeExecutionRecord,
} from "./auto-trade-types";
import {
  evaluateReverseTradeTrigger,
  simulateTradeDryRun,
} from "./reverse-trade-engine";
import { executeKeeperSwap } from "../services/trading/keeper-executor";
import { checkAllowance } from "../services/trading/token-approval";
import type { StoredKeeperData } from "../services/trading/keeper-manager";

export interface StrategyRunnerContextParams {
  config: AutoTradeConfig;
  currentPrice: number;
  token0Address: Address;
  token1Address: Address;
  token0Decimals?: number;
  token1Decimals?: number;
  masterAddress: Address;
  proxyAddress: Address;
  keeper: StoredKeeperData | null;
  isSilentEnabled: boolean;
  isBoundToProxy: boolean;
  chainId?: number;
  rpcUrl?: string;
  lastExecutedAt?: number;
  isInFlight?: boolean;
}

export interface RunnerExecutionOutcome {
  triggered: boolean;
  executed: boolean;
  reason?: string;
  side?: "buy" | "sell";
  amount?: number;
  newBasePrice?: number;
  record?: AutoTradeExecutionRecord;
}

/**
 * Evaluate strategy triggers and autonomously execute trade via Keeper if conditions are satisfied
 */
export async function evaluateAndExecuteAutoTrade(
  params: StrategyRunnerContextParams
): Promise<RunnerExecutionOutcome> {
  const {
    config,
    currentPrice,
    token0Address,
    token1Address,
    token0Decimals = 18,
    token1Decimals = 18,
    masterAddress,
    proxyAddress,
    keeper,
    isSilentEnabled,
    isBoundToProxy,
    chainId = 97,
    rpcUrl,
    lastExecutedAt = 0,
    isInFlight = false,
  } = params;

  // 1. Mutex & In-flight check
  if (isInFlight) {
    return {
      triggered: false,
      executed: false,
      reason: "前序自动交易正在链上处理中 (Mutex 互斥锁保护)",
    };
  }

  // 2. Cooldown check
  const cooldownSec = config.cooldownSeconds ?? 30;
  const cooldownMs = cooldownSec * 1000;
  const timeSinceLast = Date.now() - lastExecutedAt;
  if (lastExecutedAt > 0 && timeSinceLast < cooldownMs) {
    const remainingSec = Math.ceil((cooldownMs - timeSinceLast) / 1000);
    return {
      triggered: false,
      executed: false,
      reason: `交易冷却中，剩余 ${remainingSec} 秒`,
    };
  }

  // 3. Base price resolution
  const basePrice = config.basePrice && config.basePrice > 0 ? config.basePrice : currentPrice;
  if (basePrice <= 0 || currentPrice <= 0) {
    return {
      triggered: false,
      executed: false,
      reason: "无效的当前价格或基准价格",
    };
  }

  // 4. Evaluate triggers (Buy first, then Sell)
  let triggerResult = { triggered: false, action: undefined as "buy" | "sell" | undefined, triggerReason: "", suggestedAmount: 0 };

  if (config.buy.active && config.buy.auto) {
    const buyEval = evaluateReverseTradeTrigger(config.buy, currentPrice, basePrice, "buy");
    if (buyEval.triggered) {
      triggerResult = buyEval as any;
    }
  }

  if (!triggerResult.triggered && config.sell.active && config.sell.auto) {
    const sellEval = evaluateReverseTradeTrigger(config.sell, currentPrice, basePrice, "sell");
    if (sellEval.triggered) {
      triggerResult = sellEval as any;
    }
  }

  if (!triggerResult.triggered || !triggerResult.action) {
    return {
      triggered: false,
      executed: false,
      reason: "当前价格波动未达到买入或卖出触发阈值",
    };
  }

  // 5. Pre-execution authorization & keeper checks
  const side = triggerResult.action;
  const sideConfig = side === "buy" ? config.buy : config.sell;
  const tokenIn = side === "buy" ? token1Address : token0Address;
  const tokenOut = side === "buy" ? token0Address : token1Address;
  const decimalsIn = side === "buy" ? token1Decimals : token0Decimals;
  const decimalsOut = side === "buy" ? token0Decimals : token1Decimals;
  const tradeAmount = triggerResult.suggestedAmount;

  if (!keeper || !isSilentEnabled || !isBoundToProxy) {
    return {
      triggered: true,
      executed: false,
      side,
      amount: tradeAmount,
      reason: "触发条件已满足，但打工小号 (Keeper) 未激活、未开启静默交易或未完成链上绑定",
    };
  }

  const amountInBigInt = parseUnits(tradeAmount.toString(), decimalsIn);

  // 6. Allowance verification
  try {
    const currentAllowance = await checkAllowance(masterAddress, proxyAddress, tokenIn);
    if (currentAllowance < amountInBigInt) {
      return {
        triggered: true,
        executed: false,
        side,
        amount: tradeAmount,
        reason: `主钱包对代理合约的 ${side === "buy" ? "支付代币" : "标的代币"} 授权额度不足，请先在面板手动授权`,
      };
    }
  } catch (err: any) {
    return {
      triggered: true,
      executed: false,
      side,
      amount: tradeAmount,
      reason: `检查代币授权失败: ${err?.message || "网络异常"}`,
    };
  }

  // 7. Dry-Run simulation check
  try {
    const simResult = await simulateTradeDryRun({
      side,
      amountInFormatted: tradeAmount,
      decimalsIn,
      decimalsOut,
      tokenIn,
      tokenOut,
      priceFloor: sideConfig.priceFloor,
    });

    if (!simResult.allowed || !simResult.expectedAmountOut || simResult.expectedAmountOut <= 0n) {
      return {
        triggered: true,
        executed: false,
        side,
        amount: tradeAmount,
        reason: `预执行模拟校验拦截: ${simResult.reason || "未能获取有效链上预期输出金额，流动性不足或防貔貅机制生效"}`,
      };
    }

    // 8. Execute silent swap via Keeper EOA
    const baseSlippage = sideConfig.slippage ? 1.5 : 5.0;
    const taxRate = sideConfig.taxActive ? sideConfig.taxRate : 0;
    const totalSlippage = baseSlippage + taxRate;
    const expectedOut = simResult.expectedAmountOut;

    const keeperRes = await executeKeeperSwap({
      keeperPrivateKey: keeper.privateKey,
      proxyAddress,
      userAddress: masterAddress,
      tokenIn,
      tokenOut,
      amountIn: amountInBigInt,
      expectedAmountOut: expectedOut,
      slippagePercent: totalSlippage,
      isFeeOnTransfer: sideConfig.taxActive,
      chainId,
      rpcUrl,
    });

    const record: AutoTradeExecutionRecord = {
      id: `${keeperRes.txHash}-${Date.now()}`,
      timestamp: Date.now(),
      pairAddress: config.pairAddress,
      side,
      amount: tradeAmount,
      price: currentPrice,
      reason: triggerResult.triggerReason || "价格阈值达成",
      txHash: keeperRes.txHash,
      status: "success",
    };

    return {
      triggered: true,
      executed: true,
      side,
      amount: tradeAmount,
      newBasePrice: currentPrice, // Update baseline to current execution price
      record,
    };
  } catch (err: any) {
    return {
      triggered: true,
      executed: false,
      side,
      amount: tradeAmount,
      reason: `Keeper 静默广播异常: ${err?.message || "未知错误"}`,
    };
  }
}
