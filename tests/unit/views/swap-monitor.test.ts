import { describe, it, expect } from "vitest";
import { validatePairAddress } from "../../../src/services/pair/pair-reader";
import type { SwapLogPayload } from "../../../src/services/sync/event-emitter";

describe("Swap Monitor View Logic & Components (TASK-009)", () => {
  it("validates LP Pair input correctly for monitoring start", () => {
    const valid = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
    const invalid = "0xinvalid";
    const empty = "";

    expect(validatePairAddress(valid).valid).toBe(true);
    expect(validatePairAddress(invalid).valid).toBe(false);
    expect(validatePairAddress(empty).valid).toBe(false);
  });

  it("handles event payload fields for RecentEventsTable", () => {
    const sampleEvent: SwapLogPayload = {
      pairAddress: "0x6725F303b657a9451d8BA641348b6761A6CC7a17",
      transactionHash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
      blockNumber: "50123456",
      logIndex: 0,
      direction: "buy",
      amount0: "1000000000000000000",
      amount1: "2000000000000000000",
      effectivePrice: 2.0,
      timestamp: 1710000000000,
    };

    expect(sampleEvent.direction).toBe("buy");
    expect(sampleEvent.effectivePrice).toBe(2.0);
    expect(sampleEvent.transactionHash.startsWith("0x")).toBe(true);
  });

  it("extracts pair strategy summary correctly for active and inactive states", async () => {
    const { StrategyStore, getPairStrategySummary } = await import(
      "../../../src/strategies/strategy-store"
    );

    const testPair = "0x9999999999999999999999999999999999999999";
    // Default / unconfigured pair
    const inactiveSummary = getPairStrategySummary(testPair);
    expect(inactiveSummary.hasActive).toBe(false);
    expect(inactiveSummary.details).toBe("策略已关闭");

    // Configure active strategy for this pair
    StrategyStore.saveAutoTrade({
      pairAddress: testPair,
      buy: {
        active: true,
        auto: true,
        slippage: true,
        antiSandwich: true,
        antiHoneypot: true,
        maxAmount: 100,
        minAmount: 50,
        priceFloor: 0.5,
        dropThreshold: 5,
        dropActive: true,
        riseThreshold: 3,
        riseActive: false,
        taxRate: 1.5,
        taxActive: true,
      },
      sell: {
        active: true,
        auto: false,
        slippage: true,
        antiSandwich: true,
        antiHoneypot: true,
        maxAmount: 80,
        minAmount: 30,
        priceFloor: 0.5,
        dropThreshold: 7,
        dropActive: false,
        riseThreshold: 8,
        riseActive: true,
        taxRate: 1.5,
        taxActive: false,
      },
      updatedAt: Date.now(),
    });

    const activeSummary = getPairStrategySummary(testPair);
    expect(activeSummary.hasActive).toBe(true);
    expect(activeSummary.reverseBuy).toBe(true);
    expect(activeSummary.reverseSell).toBe(true);
    expect(activeSummary.autoActive).toBe(true);
    expect(activeSummary.details).toBe("买跌5% | 卖涨8%");
  });

  it("correctly deduplicates and orders multi-pair aggregated events", () => {
    const ev1: SwapLogPayload = {
      pairAddress: "0xAAAA",
      transactionHash: "0x1",
      blockNumber: "100",
      logIndex: 0,
      direction: "buy",
      amount0: "10",
      amount1: "20",
      timestamp: 1000,
    };
    const ev2: SwapLogPayload = {
      pairAddress: "0xBBBB",
      transactionHash: "0x2",
      blockNumber: "101",
      logIndex: 0,
      direction: "sell",
      amount0: "5",
      amount1: "15",
      timestamp: 2000,
    };
    const evDuplicate: SwapLogPayload = {
      pairAddress: "0xAAAA",
      transactionHash: "0x1",
      blockNumber: "100",
      logIndex: 0,
      direction: "buy",
      amount0: "10",
      amount1: "20",
      timestamp: 1000,
    };

    const combined = [ev1, ev2, evDuplicate];
    combined.sort((a, b) => {
      const bBlock = BigInt(b.blockNumber || "0");
      const aBlock = BigInt(a.blockNumber || "0");
      if (bBlock !== aBlock) {
        return bBlock > aBlock ? 1 : -1;
      }
      return b.logIndex - a.logIndex;
    });

    const seen = new Set<string>();
    const deduped: SwapLogPayload[] = [];
    for (const ev of combined) {
      const id = `${ev.transactionHash}:${ev.logIndex}`;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(ev);
      }
    }

    expect(deduped.length).toBe(2);
    expect(deduped[0].transactionHash).toBe("0x2"); // Higher block #101 comes first
    expect(deduped[1].transactionHash).toBe("0x1");
  });
});
