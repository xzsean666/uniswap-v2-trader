import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPancakeFactoryAddress,
  getPresetPairs,
  getCommonTokens,
  resolvePairFromTokens,
} from "../../../src/services/pair/pair-resolver";
import { CONTRACT_ADDRESSES } from "../../../src/constants/contracts";
import * as multicallModule from "../../../src/evm/multicall";
import * as pairReaderModule from "../../../src/services/pair/pair-reader";

describe("Pancake Pair Resolver (services/pair-resolver.ts)", () => {
  const mockTokenA = "0xd26cdc2d33bda34c07f01c459ab32a2bf4c9f441";
  const mockTokenB = "0x7a939029997569074973b1ee95118d387f171863";
  const mockPair = "0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct Factory address for Testnet and Mainnet", () => {
    expect(getPancakeFactoryAddress(97)).toBe(CONTRACT_ADDRESSES.PANCAKE_FACTORY_TESTNET);
    expect(getPancakeFactoryAddress(56)).toBe(CONTRACT_ADDRESSES.PANCAKE_FACTORY_MAINNET);
    expect(getPancakeFactoryAddress()).toBe(CONTRACT_ADDRESSES.PANCAKE_FACTORY_TESTNET);
  });

  it("returns preset popular pairs filtered by chain ID", () => {
    const testnetPairs = getPresetPairs(97);
    expect(testnetPairs.length).toBeGreaterThan(0);
    expect(testnetPairs[0].token0Symbol).toBe("ALPHA");

    const mainnetPairs = getPresetPairs(56);
    expect(mainnetPairs.length).toBeGreaterThan(0);
    expect(mainnetPairs.some((p) => p.token0Symbol === "WBNB" && p.token1Symbol === "USDT")).toBe(true);
  });

  it("returns common tokens filtered by chain ID", () => {
    const testnetTokens = getCommonTokens(97);
    expect(testnetTokens.some((t) => t.symbol === "ALPHA")).toBe(true);

    const mainnetTokens = getCommonTokens(56);
    expect(mainnetTokens.some((t) => t.symbol === "CAKE")).toBe(true);
  });

  it("validates invalid token addresses before calling RPC", async () => {
    const res1 = await resolvePairFromTokens("invalid-address", mockTokenB);
    expect(res1.exists).toBe(false);
    expect(res1.error).toContain("代币地址格式不正确");

    const res2 = await resolvePairFromTokens(mockTokenA, mockTokenA);
    expect(res2.exists).toBe(false);
    expect(res2.error).toContain("地址不能相同");
  });

  it("handles non-existent liquidity pools from Factory", async () => {
    vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
      { success: true, result: "0x0000000000000000000000000000000000000000" as any },
    ]);

    const res = await resolvePairFromTokens(mockTokenA, mockTokenB, 97);
    expect(res.exists).toBe(false);
    expect(res.error).toContain("尚未在 PancakeSwap V2 创建流动性池");
  });

  it("successfully resolves valid pair address and overview", async () => {
    vi.spyOn(multicallModule, "multicallRead").mockResolvedValue([
      { success: true, result: mockPair as any },
    ]);

    const mockOverview = {
      pairAddress: mockPair,
      token0: { address: mockTokenA, symbol: "ALPHA", decimals: 18, name: "Alpha" },
      token1: { address: mockTokenB, symbol: "BETA", decimals: 18, name: "Beta" },
      reserve0: "50000",
      reserve1: "100000",
      reserve0Raw: 50000n * 10n ** 18n,
      reserve1Raw: 100000n * 10n ** 18n,
      price0: 2,
      price1: 0.5,
    };

    vi.spyOn(pairReaderModule, "fetchPairOverview").mockResolvedValue(mockOverview as any);

    const res = await resolvePairFromTokens(mockTokenA, mockTokenB, 97);
    expect(res.exists).toBe(true);
    expect(res.pairAddress?.toLowerCase()).toBe(mockPair.toLowerCase());
    expect(res.overview?.token0.symbol).toBe("ALPHA");
    expect(res.overview?.token1.symbol).toBe("BETA");
  });
});
