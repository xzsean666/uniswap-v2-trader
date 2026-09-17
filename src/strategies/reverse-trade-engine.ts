import { parseUnits, formatUnits, type Address } from "viem";
import type { TradeSideConfig } from "./auto-trade-types";
import { multicallRead } from "../evm/multicall";
import { PANCAKE_ROUTER_ABI } from "../abi/pancake";
import { CONTRACT_ADDRESSES } from "../constants/contracts";

export interface TriggerEvaluationResult {
  triggered: boolean;
  action?: "buy" | "sell";
  triggerReason?: string;
  suggestedAmount: number;
}

export interface TradeSimulationResult {
  allowed: boolean;
  amountIn: bigint;
  expectedAmountOut?: bigint;
  effectivePrice?: number;
  reason?: string;
}

export interface TradeSimulationParams {
  side: "buy" | "sell";
  amountInFormatted: number;
  decimalsIn: number;
  decimalsOut: number;
  tokenIn: Address;
  tokenOut: Address;
  priceFloor: number;
  slippageTolerancePercent?: number;
  routerAddress?: Address;
}

/**
 * Check if current price relative to reference price triggers reverse action
 */
export function evaluateReverseTradeTrigger(
  config: TradeSideConfig,
  currentPrice: number,
  basePrice: number,
  action: "buy" | "sell"
): TriggerEvaluationResult {
  if (!config.active) {
    return { triggered: false, suggestedAmount: 0 };
  }

  if (basePrice <= 0) {
    return { triggered: false, suggestedAmount: 0 };
  }

  const priceDiffPercent = ((currentPrice - basePrice) / basePrice) * 100;

  // Check drop threshold: e.g. price dropped by 5%
  if (config.dropActive && priceDiffPercent <= -config.dropThreshold) {
    const amount = generateRandomTradeAmount(config.minAmount, config.maxAmount);
    return {
      triggered: true,
      action,
      triggerReason: `价格跌幅达 ${Math.abs(priceDiffPercent).toFixed(2)}% (阈值: ${config.dropThreshold}%)`,
      suggestedAmount: amount,
    };
  }

  // Check rise threshold: e.g. price rose by 3%
  if (config.riseActive && priceDiffPercent >= config.riseThreshold) {
    const amount = generateRandomTradeAmount(config.minAmount, config.maxAmount);
    return {
      triggered: true,
      action,
      triggerReason: `价格涨幅达 ${priceDiffPercent.toFixed(2)}% (阈值: ${config.riseThreshold}%)`,
      suggestedAmount: amount,
    };
  }

  return { triggered: false, suggestedAmount: 0 };
}

/**
 * Generate a random number within [min, max] rounded to 2 decimals
 */
export function generateRandomTradeAmount(min: number, max: number): number {
  if (min >= max) return min;
  const randomVal = min + Math.random() * (max - min);
  return Number(randomVal.toFixed(2));
}

/**
 * Dry-run simulate trade using PancakeSwap Router getAmountsOut to verify slippage & price floor
 */
export async function simulateTradeDryRun(
  params: TradeSimulationParams
): Promise<TradeSimulationResult> {
  const router = params.routerAddress ?? CONTRACT_ADDRESSES.PANCAKE_ROUTER;
  const amountIn = parseUnits(params.amountInFormatted.toString(), params.decimalsIn);

  if (amountIn <= 0n) {
    return { allowed: false, amountIn, reason: "交易金额必须大于 0" };
  }

  try {
    const results = await multicallRead([
      {
        target: router,
        abi: PANCAKE_ROUTER_ABI,
        functionName: "getAmountsOut",
        args: [amountIn, [params.tokenIn, params.tokenOut]],
      },
    ]);

    const res = results[0];
    if (!res.success || !res.result) {
      return {
        allowed: false,
        amountIn,
        reason: "链上模拟静态调用被拦截或回滚，可能存在防貔貅机制或池子流动性不足",
      };
    }

    const amounts = res.result as bigint[];
    const amountOut = amounts[amounts.length - 1];

    // Calculate effective price: output / input (normalized via formatUnits to avoid Number float overflow)
    const normIn = parseFloat(formatUnits(amountIn, params.decimalsIn));
    const normOut = parseFloat(formatUnits(amountOut, params.decimalsOut));

    if (normIn <= 0 || !Number.isFinite(normIn)) {
      return {
        allowed: false,
        amountIn,
        reason: "输入数量无效或归一化计算失败",
      };
    }

    const effectivePrice = normOut / normIn;

    const formattedPrice =
      effectivePrice >= 1
        ? effectivePrice.toFixed(4)
        : effectivePrice >= 0.0001
        ? effectivePrice.toFixed(6)
        : effectivePrice.toPrecision(4);

    // Verify against price floor
    if (params.priceFloor > 0 && effectivePrice < params.priceFloor) {
      return {
        allowed: false,
        amountIn,
        expectedAmountOut: amountOut,
        effectivePrice,
        reason: `模拟输出价格 (${formattedPrice}) 低于设定的价格下限 (${params.priceFloor})`,
      };
    }

    return {
      allowed: true,
      amountIn,
      expectedAmountOut: amountOut,
      effectivePrice,
    };
  } catch (err: any) {
    return {
      allowed: false,
      amountIn,
      reason: `模拟调用异常: ${err?.message || "未知错误"}`,
    };
  }
}
