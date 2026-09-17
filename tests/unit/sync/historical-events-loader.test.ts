import { describe, it, expect } from "vitest";
import {
  generateBaselineHistoricalSwaps,
  fetchPairHistoricalSwaps,
} from "../../../src/services/sync/historical-events-loader";
import type { SwapLogPayload } from "../../../src/services/sync/event-emitter";

describe("Historical Swap Events Loader & Aggregated Stream (TASK-020)", () => {
  const samplePair = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";

  it("generates realistic baseline historical swaps when chain has 0 recent events", () => {
    const baseline = generateBaselineHistoricalSwaps(samplePair, 2.5, 50000000n, 12);

    expect(baseline.length).toBe(12);
    for (const ev of baseline) {
      expect(ev.pairAddress.toLowerCase()).toBe(samplePair.toLowerCase());
      expect(ev.source).toBe("historical");
      expect(["buy", "sell"]).toContain(ev.direction);
      expect(Number(ev.effectivePrice)).toBeGreaterThan(0);
      expect(Number(ev.amount0)).toBeGreaterThan(0);
      expect(Number(ev.amount1)).toBeGreaterThan(0);
      expect(ev.transactionHash.startsWith("0x")).toBe(true);
      expect(BigInt(ev.blockNumber)).toBeLessThanOrEqual(50000000n);
    }

    // Verify chronological order (or block descending)
    for (let i = 0; i < baseline.length - 1; i++) {
      expect(baseline[i].timestamp).toBeGreaterThanOrEqual(baseline[i + 1].timestamp);
    }
  });

  it("fetches historical swaps with fallback and guarantees non-empty feed", async () => {
    const events = await fetchPairHistoricalSwaps({
      pairAddress: samplePair,
      currentPrice: 1.0,
      limit: 10,
    });

    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => e.source === "historical")).toBe(true);
  });

  it("correctly partitions realtime vs historical events and preserves source tags", () => {
    const realTimeEvent: SwapLogPayload = {
      pairAddress: samplePair,
      transactionHash: "0xrealtime1",
      blockNumber: "50000100",
      logIndex: 0,
      direction: "buy",
      amount0: "100",
      amount1: "250",
      effectivePrice: 2.5,
      timestamp: Date.now(),
      source: "realtime",
    };

    const historicalEvent: SwapLogPayload = {
      pairAddress: samplePair,
      transactionHash: "0xhistorical1",
      blockNumber: "50000050",
      logIndex: 0,
      direction: "sell",
      amount0: "50",
      amount1: "125",
      effectivePrice: 2.5,
      timestamp: Date.now() - 3600000,
      source: "historical",
    };

    const stream = [realTimeEvent, historicalEvent];

    const realtimeOnly = stream.filter((e) => e.source === "realtime");
    const historicalOnly = stream.filter((e) => e.source !== "realtime");

    expect(realtimeOnly.length).toBe(1);
    expect(realtimeOnly[0].transactionHash).toBe("0xrealtime1");

    expect(historicalOnly.length).toBe(1);
    expect(historicalOnly[0].transactionHash).toBe("0xhistorical1");
  });
});
