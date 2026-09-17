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
 * Recursively strips any properties with undefined or non-finite number values
 * to guarantee strict compatibility with @evm-event-lake/node-sdk's encodeDecodedValue.
 */
export function sanitizeForDecodedValueCodec<T>(value: T): T {
  if (value === undefined) {
    return null as unknown as T;
  }
  if (value === null || typeof value !== "object") {
    if (typeof value === "number") {
      return (Number.isFinite(value) ? value : null) as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      item === undefined ? null : sanitizeForDecodedValueCodec(item)
    ) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (val !== undefined) {
      if (typeof val === "number" && !Number.isFinite(val)) {
        continue;
      }
      result[key] = sanitizeForDecodedValueCodec(val);
    }
  }
  return result as unknown as T;
}

/**
 * Creates an enricher hook for Uniswap/PancakeSwap V2 Swap events.
 * Returns null for non-Swap events (Sync, Mint, Burn, etc.) or malformed logs.
 */
export function createSwapEnricher(token0Decimals = 18, token1Decimals = 18): EventEnricher {
  return (context: EventEnrichmentContext): SwapEnrichmentData | null => {
    // Only enrich valid decoded Swap events
    if (context.eventName && context.eventName !== "Swap") {
      return null;
    }
    if (context.decodeStatus && context.decodeStatus !== "decoded") {
      return null;
    }
    if (!context.arguments) {
      return null;
    }

    const args = context.arguments as Record<string, unknown>;

    // Verify presence of at least one Swap parameter
    if (
      args.amount0In === undefined &&
      args.amount1In === undefined &&
      args.amount0Out === undefined &&
      args.amount1Out === undefined
    ) {
      return null;
    }

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
        const p01 = a0 / a1;
        const p10 = a1 / a0;
        if (Number.isFinite(p01)) effectivePrice0Per1 = p01;
        if (Number.isFinite(p10)) effectivePrice1Per0 = p10;
      }
    } catch {
      // Fallback if formatting fails
    }

    const enrichment: SwapEnrichmentData = {
      direction,
      amount0In: amount0In.toString(),
      amount1In: amount1In.toString(),
      amount0Out: amount0Out.toString(),
      amount1Out: amount1Out.toString(),
      enrichedAt: Date.now(),
    };

    if (sender) {
      enrichment.sender = sender;
    }
    if (to) {
      enrichment.to = to;
    }
    if (effectivePrice0Per1 !== undefined) {
      enrichment.effectivePrice0Per1 = effectivePrice0Per1;
    }
    if (effectivePrice1Per0 !== undefined) {
      enrichment.effectivePrice1Per0 = effectivePrice1Per0;
    }

    return sanitizeForDecodedValueCodec(enrichment);
  };
}
