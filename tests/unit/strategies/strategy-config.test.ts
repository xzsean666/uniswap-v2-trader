import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateTargetPrice,
  DEFAULT_TRADE_SIDE_BUY,
  DEFAULT_TRADE_SIDE_SELL,
  type AutoTradeConfig,
  type PriceGrowthConfig,
} from "../../../src/strategies/auto-trade-types";
import { StrategyStore } from "../../../src/strategies/strategy-store";

describe("Strategy Configuration & Store (TASK-012)", () => {
  beforeEach(() => {
    // Clear storage if needed
  });

  it("calculates daily target price accurately based on growth percent", () => {
    expect(calculateTargetPrice(1.0, 5.0)).toBe(1.05);
    expect(calculateTargetPrice(200.0, 10.0)).toBe(220.0);
    expect(calculateTargetPrice(0.5, 2.5)).toBe(0.5125);
    expect(calculateTargetPrice(0, 5.0)).toBe(0);
  });

  it("persists and restores AutoTrade configuration", () => {
    const pair = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
    const customConfig: AutoTradeConfig = {
      pairAddress: pair,
      buy: {
        ...DEFAULT_TRADE_SIDE_BUY,
        maxAmount: 500,
        dropThreshold: 8.5,
      },
      sell: {
        ...DEFAULT_TRADE_SIDE_SELL,
        maxAmount: 300,
        riseThreshold: 6.0,
      },
      updatedAt: Date.now(),
    };

    StrategyStore.saveAutoTrade(customConfig);
    const loaded = StrategyStore.loadAutoTrade(pair);

    expect(loaded.pairAddress).toBe(pair);
    expect(loaded.buy.maxAmount).toBe(500);
    expect(loaded.buy.dropThreshold).toBe(8.5);
    expect(loaded.sell.maxAmount).toBe(300);
    expect(loaded.sell.riseThreshold).toBe(6.0);
  });

  it("persists and restores PriceGrowth configuration", () => {
    const pair = "0x6725F303b657a9451d8BA641348b6761A6CC7a17";
    const growthConfig: PriceGrowthConfig = {
      pairAddress: pair,
      active: true,
      dailyGrowthPercent: 7.5,
      durationHours: 16,
      intervalMinutes: 45,
      basePrice: 1.2,
      targetPrice: 1.29,
      autoResetDaily: true,
      updatedAt: Date.now(),
    };

    StrategyStore.savePriceGrowth(growthConfig);
    const loaded = StrategyStore.loadPriceGrowth(pair);

    expect(loaded.active).toBe(true);
    expect(loaded.dailyGrowthPercent).toBe(7.5);
    expect(loaded.durationHours).toBe(16);
    expect(loaded.intervalMinutes).toBe(45);
    expect(loaded.basePrice).toBe(1.2);
    expect(loaded.targetPrice).toBe(1.29);
  });
});
