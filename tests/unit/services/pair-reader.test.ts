import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress, parseUnits } from "viem";
import {
  validatePairAddress,
  calculatePrices,
  fetchPairOverview,
} from "../../../src/services/pair/pair-reader";
import * as multicallModule from "../../../src/evm/multicall";

describe("LP Pair Reader & Price Calculator (TASK-005)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Address Validation", () => {
    it("validates and checksums valid EVM addresses", () => {
      const validLower = "0xae13d989dac2f0debff460ac112a837c89baa7cd";
      const res = validatePairAddress(validLower);
      expect(res.valid).toBe(true);
      expect(res.checksummed).toBe(getAddress(validLower));
    });

    it("rejects non-address strings", () => {
      expect(validatePairAddress("").valid).toBe(false);
      expect(validatePairAddress("0x123").valid).toBe(false);
      expect(validatePairAddress("not_an_address").valid).toBe(false);
    });
  });

  describe("Price & Ratio Calculations", () => {
    it("handles standard 18-decimal pairs with equal reserves", () => {
      const res0 = parseUnits("1000", 18);
      const res1 = parseUnits("1000", 18);
      const prices = calculatePrices(res0, 18, res1, 18);

      expect(prices.price0Per1).toBeCloseTo(1.0, 4);
      expect(prices.price1Per0).toBeCloseTo(1.0, 4);
      expect(prices.price0Per1Formatted).toBe("1.0000");
    });

    it("handles asymmetric reserves and different decimals (e.g. 18 & 6)", () => {
      // 100 WBNB (18 dec) and 60,000 USDT (6 dec)
      // 1 WBNB = 600 USDT; 1 USDT = 1/600 WBNB ~= 0.001667 WBNB
      const res0 = parseUnits("100", 18);
      const res1 = parseUnits("60000", 6);
      const prices = calculatePrices(res0, 18, res1, 6);

      expect(prices.price1Per0).toBeCloseTo(600, 2);
      expect(prices.price0Per1).toBeCloseTo(1 / 600, 5);
      expect(prices.price1Per0Formatted).toBe("600.00");
    });

    it("safely handles zero reserves without throwing division by zero", () => {
      const prices = calculatePrices(0n, 18, 0n, 18);
      expect(prices.price0Per1).toBe(0);
      expect(prices.price1Per0).toBe(0);
      expect(prices.price0Per1Formatted).toBe("0");
    });
  });

  describe("fetchPairOverview Multicall Integration", () => {
    it("fetches pair reserves and token metadata in aggregate", async () => {
      const mockPair = getAddress("0x1111111111111111111111111111111111111111");
      const mockToken0 = getAddress("0x2222222222222222222222222222222222222222");
      const mockToken1 = getAddress("0x3333333333333333333333333333333333333333");

      const spy = vi.spyOn(multicallModule, "multicallRead");

      // First call: token0, token1, getReserves
      // Second call: token0 (symbol, name, decimals), token1 (symbol, name, decimals)
      spy.mockImplementation(async (calls: any[]) => {
        if (calls.length === 3) {
          return [
            { success: true, result: mockToken0 },
            { success: true, result: mockToken1 },
            { success: true, result: [parseUnits("500", 18), parseUnits("1000", 18), 1710000000] },
          ];
        }
        if (calls.length === 6) {
          return [
            { success: true, result: "ACP" },
            { success: true, result: "Anvil Cyber Protocol" },
            { success: true, result: 18 },
            { success: true, result: "USDT" },
            { success: true, result: "Tether USD" },
            { success: true, result: 18 },
          ];
        }
        return [];
      });

      const overview = await fetchPairOverview(mockPair);

      expect(overview.pairAddress).toBe(mockPair);
      expect(overview.token0.symbol).toBe("ACP");
      expect(overview.token0.reserveFormatted).toBe("500");
      expect(overview.token1.symbol).toBe("USDT");
      expect(overview.token1.reserveFormatted).toBe("1000");
      // 500 ACP / 1000 USDT -> 1 USDT = 0.5 ACP, 1 ACP = 2 USDT
      expect(overview.price0Per1).toBeCloseTo(0.5, 4);
      expect(overview.price1Per0).toBeCloseTo(2.0, 4);
    });

    it("throws error when pair call fails", async () => {
      const mockPair = getAddress("0x1111111111111111111111111111111111111111");
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
        { success: false, error: new Error("Contract call reverted") },
        { success: false },
        { success: false },
      ]);

      await expect(fetchPairOverview(mockPair)).rejects.toThrow(
        "无法从地址"
      );
    });
  });
});
