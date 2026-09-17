import type { EventEnricher, EventEnrichmentContext } from "@evm-event-lake/node-sdk";
import { formatUnits } from "viem";

export interface SwapEnrichmentData {
  direction: "buy" | "sell" | "unknown";
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  sender?: string;
  to?: string;
  effectivePrice0Per1?: number;
  effectivePrice1Per0?: number;
  enrichedAt: number;
}

/**
 * Creates an enricher hook for Uniswap/PancakeSwap V2 Swap events
 */
export function createSwapEnricher(token0Decimals = 18, token1Decimals = 18): EventEnricher {
  return (context: EventEnrichmentContext): SwapEnrichmentData => {
    const args = (context.arguments ?? {}) as Record<string, unknown>;

    const amount0In = BigInt(String(args.amount0In ?? "0"));
    const amount1In = BigInt(String(args.amount1In ?? "0"));
    const amount0Out = BigInt(String(args.amount0Out ?? "0"));
    const amount1Out = BigInt(String(args.amount1Out ?? "0"));
    const sender = args.sender ? String(args.sender) : undefined;
    const to = args.to ? String(args.to) : undefined;

    // Direction analysis:
    // If amount0In > 0 && amount1Out > 0: Selling Token0 to buy Token1
    // If amount1In > 0 && amount0Out > 0: Selling Token1 to buy Token0
    let direction: "buy" | "sell" | "unknown" = "unknown";
    if (amount0In > 0n && amount1Out > 0n) {
      direction = "sell"; // Sold Token0
    } else if (amount1In > 0n && amount0Out > 0n) {
      direction = "buy"; // Bought Token0
    }

    // Calculate effective swap execution price
    let effectivePrice0Per1: number | undefined;
    let effectivePrice1Per0: number | undefined;

    try {
      const a0 = parseFloat(
        formatUnits(amount0In > 0n ? amount0In : amount0Out, token0Decimals)
      );
      const a1 = parseFloat(
        formatUnits(amount1In > 0n ? amount1In : amount1Out, token1Decimals)
      );

      if (a0 > 0 && a1 > 0) {
        effectivePrice0Per1 = a0 / a1;
        effectivePrice1Per0 = a1 / a0;
      }
    } catch {
      // Fallback if formatting fails
    }

    return {
      direction,
      amount0In: amount0In.toString(),
      amount1In: amount1In.toString(),
      amount0Out: amount0Out.toString(),
      amount1Out: amount1Out.toString(),
      sender,
      to,
      effectivePrice0Per1,
      effectivePrice1Per0,
      enrichedAt: Date.now(),
    };
  };
}
