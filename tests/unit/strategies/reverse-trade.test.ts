import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress, parseUnits } from "viem";
import {
  evaluateReverseTradeTrigger,
  generateRandomTradeAmount,
  simulateTradeDryRun,
} from "../../../src/strategies/reverse-trade-engine";
import { DEFAULT_TRADE_SIDE_BUY } from "../../../src/strategies/auto-trade-types";
import * as multicallModule from "../../../src/evm/multicall";

describe("Reverse Trade Engine & Dry Run Simulation (TASK-013)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("evaluateReverseTradeTrigger", () => {
    it("triggers buy when price drop exceeds threshold", () => {
      const config = {
        ...DEFAULT_TRADE_SIDE_BUY,
        active: true,
        dropActive: true,
        dropThreshold: 5.0, // 5% drop
      };

      // Base: 1.0, Current: 0.94 -> -6% drop
      const res = evaluateReverseTradeTrigger(config, 0.94, 1.0, "buy");
      expect(res.triggered).toBe(true);
      expect(res.action).toBe("buy");
      expect(res.suggestedAmount).toBeGreaterThanOrEqual(config.minAmount);
      expect(res.suggestedAmount).toBeLessThanOrEqual(config.maxAmount);
    });

    it("triggers buy when price rise exceeds threshold", () => {
      const config = {
        ...DEFAULT_TRADE_SIDE_BUY,
        active: true,
        riseActive: true,
        riseThreshold: 3.0, // 3% rise
      };

      // Base: 1.0, Current: 1.04 -> +4% rise
      const res = evaluateReverseTradeTrigger(config, 1.04, 1.0, "buy");
      expect(res.triggered).toBe(true);
      expect(res.action).toBe("buy");
    });

    it("does not trigger when inactive or price fluctuation is within threshold", () => {
      const config = {
        ...DEFAULT_TRADE_SIDE_BUY,
        active: true,
        dropActive: true,
        dropThreshold: 5.0,
      };

      // Base: 1.0, Current: 0.98 -> -2% drop (less than 5%)
      const res = evaluateReverseTradeTrigger(config, 0.98, 1.0, "buy");
      expect(res.triggered).toBe(false);

      // Inactive
      const inactiveRes = evaluateReverseTradeTrigger(
        { ...config, active: false },
        0.8,
        1.0,
        "buy"
      );
      expect(inactiveRes.triggered).toBe(false);
    });
  });

  describe("generateRandomTradeAmount", () => {
    it("returns values within [min, max] range", () => {
      for (let i = 0; i < 20; i++) {
        const val = generateRandomTradeAmount(50, 100);
        expect(val).toBeGreaterThanOrEqual(50);
        expect(val).toBeLessThanOrEqual(100);
      }
    });

    it("returns min when min >= max", () => {
      expect(generateRandomTradeAmount(80, 80)).toBe(80);
      expect(generateRandomTradeAmount(100, 50)).toBe(100);
    });
  });

  describe("simulateTradeDryRun", () => {
    const tokenIn = getAddress("0xae13d989dac2f0debff460ac112a837c89baa7cd");
    const tokenOut = getAddress("0x1111111111111111111111111111111111111111");

    it("rejects zero trade amount", async () => {
      const res = await simulateTradeDryRun({
        side: "buy",
        amountInFormatted: 0,
        decimalsIn: 18,
        decimalsOut: 18,
        tokenIn,
        tokenOut,
        priceFloor: 0.5,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("大于 0");
    });

    it("approves simulation when price floor is satisfied", async () => {
      // 100 tokenIn -> 150 tokenOut (price = 1.5 > priceFloor 0.5)
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
        {
          success: true,
          result: [parseUnits("100", 18), parseUnits("150", 18)],
        },
      ]);

      const res = await simulateTradeDryRun({
        side: "buy",
        amountInFormatted: 100,
        decimalsIn: 18,
        decimalsOut: 18,
        tokenIn,
        tokenOut,
        priceFloor: 0.5,
      });

      expect(res.allowed).toBe(true);
      expect(res.effectivePrice).toBeCloseTo(1.5, 2);
    });

    it("rejects simulation when output price violates price floor", async () => {
      // 100 tokenIn -> 40 tokenOut (price = 0.4 < priceFloor 0.5888)
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
        {
          success: true,
          result: [parseUnits("100", 18), parseUnits("40", 18)],
        },
      ]);

      const res = await simulateTradeDryRun({
        side: "buy",
        amountInFormatted: 100,
        decimalsIn: 18,
        decimalsOut: 18,
        tokenIn,
        tokenOut,
        priceFloor: 0.5888,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("低于设定的价格下限");
    });

    it("handles contract call revert safely", async () => {
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
        {
          success: false,
          error: new Error("PancakeRouter: INSUFFICIENT_OUTPUT_AMOUNT"),
        },
      ]);

      const res = await simulateTradeDryRun({
        side: "buy",
        amountInFormatted: 100,
        decimalsIn: 18,
        decimalsOut: 18,
        tokenIn,
        tokenOut,
        priceFloor: 0.5,
      });

      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("防貔貅机制或池子流动性不足");
    });
  });
});
