import { describe, it, expect, vi } from "vitest";
import { simulateTradeDryRun } from "../../../src/strategies/reverse-trade-engine";
import * as multicallModule from "../../../src/evm/multicall";

describe("Reverse Trade Hardening & Decimals Tests", () => {
  it("should reject trade amounts less than or equal to 0", async () => {
    const result = await simulateTradeDryRun({
      side: "buy",
      amountInFormatted: 0,
      decimalsIn: 18,
      decimalsOut: 18,
      tokenIn: "0x1111111111111111111111111111111111111111",
      tokenOut: "0x2222222222222222222222222222222222222222",
      priceFloor: 0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("大于 0");
  });

  it("should accurately calculate effective price with mismatched decimals (e.g. 6 to 18)", async () => {
    // 100 USDT (6 decimals = 100,000,000) for 200 Token0 (18 decimals = 200 * 10^18)
    const spy = vi.spyOn(multicallModule, "multicallRead").mockResolvedValueOnce([
      {
        success: true,
        result: [100000000n, 200000000000000000000n],
      },
    ]);

    const result = await simulateTradeDryRun({
      side: "buy",
      amountInFormatted: 100,
      decimalsIn: 6,
      decimalsOut: 18,
      tokenIn: "0x1111111111111111111111111111111111111111",
      tokenOut: "0x2222222222222222222222222222222222222222",
      priceFloor: 1.5,
    });

    expect(result.allowed).toBe(true);
    expect(result.effectivePrice).toBeCloseTo(2.0, 4); // 200 / 100 = 2.0
    spy.mockRestore();
  });

  it("should intercept trade if effective price is below price floor with different decimals", async () => {
    // 100 USDT (6 decimals) -> 80 Token0 (18 decimals) -> rate 0.8
    const spy = vi.spyOn(multicallModule, "multicallRead").mockResolvedValueOnce([
      {
        success: true,
        result: [100000000n, 80000000000000000000n],
      },
    ]);

    const result = await simulateTradeDryRun({
      side: "buy",
      amountInFormatted: 100,
      decimalsIn: 6,
      decimalsOut: 18,
      tokenIn: "0x1111111111111111111111111111111111111111",
      tokenOut: "0x2222222222222222222222222222222222222222",
      priceFloor: 1.0,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("低于设定的价格下限");
    spy.mockRestore();
  });
});
