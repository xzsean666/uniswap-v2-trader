import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { getAddress } from "viem";
import { SubscriptionStore, type PairSubscription } from "../../../src/storage/subscription-store";
import {
  getPancakeFactoryAddress,
  getPresetPairs,
  getCommonTokens,
} from "../../../src/services/pair/pair-resolver";
import { CONTRACT_ADDRESSES } from "../../../src/constants/contracts";

describe("Pancake Pair Selector & Watchlist Management", () => {
  const mockPair1 = getAddress("0x1111111111111111111111111111111111111111");
  const mockPair2 = getAddress("0x2222222222222222222222222222222222222222");
  const mockTokenA = getAddress("0xd26cdc2d33bda34c07f01c459ab32a2bf4c9f441");
  const mockTokenB = getAddress("0x7a939029997569074973b1ee95118d387f171863");

  beforeEach(async () => {
    SubscriptionStore.clearMemoryCache();
    await SubscriptionStore.delete(mockPair1);
    await SubscriptionStore.delete(mockPair2);
  });

  describe("Preset popular pairs and common tokens", () => {
    it("contains BSC Testnet official ALPHA/BETA pair", () => {
      const testnetPairs = getPresetPairs(97);
      expect(testnetPairs.length).toBeGreaterThan(0);
      const alphaBeta = testnetPairs.find((p) => p.token0Symbol === "ALPHA");
      expect(alphaBeta).toBeDefined();
      expect(alphaBeta?.pairAddress.toLowerCase()).toBe("0xf03ebe5cd689fedc9204af66cb3431750b89bc02");
    });

    it("contains BSC Mainnet top volume pairs (WBNB/USDT, CAKE/WBNB)", () => {
      const mainnetPairs = getPresetPairs(56);
      expect(mainnetPairs.length).toBeGreaterThan(0);
      const bnbUsdt = mainnetPairs.find((p) => p.token0Symbol === "WBNB" && p.token1Symbol === "USDT");
      expect(bnbUsdt).toBeDefined();
      expect(bnbUsdt?.pairAddress.toLowerCase()).toBe("0x16b9a82891338f9ba80e2d6970fdda79d1eb0dae");
    });

    it("distinguishes common tokens between testnet and mainnet", () => {
      const testnetTokens = getCommonTokens(97);
      expect(testnetTokens.some((t) => t.symbol === "ALPHA")).toBe(true);

      const mainnetTokens = getCommonTokens(56);
      expect(mainnetTokens.some((t) => t.symbol === "CAKE")).toBe(true);
      expect(mainnetTokens.some((t) => t.symbol === "USDT")).toBe(true);
    });

    it("routes to correct PancakeSwap Factory address based on chain", () => {
      expect(getPancakeFactoryAddress(97)).toBe(CONTRACT_ADDRESSES.PANCAKE_FACTORY_TESTNET);
      expect(getPancakeFactoryAddress(56)).toBe(CONTRACT_ADDRESSES.PANCAKE_FACTORY_MAINNET);
    });
  });

  describe("Custom Watchlist Persistence (IndexedDB)", () => {
    it("allows users to add a custom pair subscription and persists to store", async () => {
      const sub: PairSubscription = {
        pairAddress: mockPair1,
        token0Address: mockTokenA,
        token0Symbol: "ALPHA",
        token1Address: mockTokenB,
        token1Symbol: "BETA",
        status: "inactive",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await SubscriptionStore.save(sub);
      const all = await SubscriptionStore.getAll();
      expect(all.some((s) => s.pairAddress === mockPair1)).toBe(true);

      const retrieved = await SubscriptionStore.get(mockPair1);
      expect(retrieved?.token0Symbol).toBe("ALPHA");
      expect(retrieved?.token1Symbol).toBe("BETA");
    });

    it("allows users to remove a custom pair subscription", async () => {
      const sub1: PairSubscription = {
        pairAddress: mockPair1,
        token0Address: mockTokenA,
        token0Symbol: "ALPHA",
        token1Address: mockTokenB,
        token1Symbol: "BETA",
        status: "inactive",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const sub2: PairSubscription = {
        pairAddress: mockPair2,
        token0Address: mockTokenA,
        token0Symbol: "ALPHA",
        token1Address: mockTokenB,
        token1Symbol: "CUSTOM",
        status: "inactive",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await SubscriptionStore.save(sub1);
      await SubscriptionStore.save(sub2);

      let all = await SubscriptionStore.getAll();
      expect(all.length).toBe(2);

      await SubscriptionStore.delete(mockPair1);
      all = await SubscriptionStore.getAll();
      expect(all.length).toBe(1);
      expect(all[0].pairAddress).toBe(mockPair2);
    });
  });
});
