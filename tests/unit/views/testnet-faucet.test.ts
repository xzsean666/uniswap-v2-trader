import { describe, it, expect } from "vitest";
import { TESTNET_CONFIG } from "../../../src/views/faucet/TestnetFaucetView";
import { isAddress } from "viem";

describe("BSC Testnet Faucet View & Configuration", () => {
  it("has valid BSC Testnet chain ID and RPC url", () => {
    expect(TESTNET_CONFIG.chainId).toBe(97);
    expect(TESTNET_CONFIG.networkName).toContain("BSC Testnet");
    expect(TESTNET_CONFIG.rpcUrl).toBe("https://bsc-testnet-dataseed.bnbchain.org");
  });

  it("defines valid checksummed addresses for test pair, router, and proxy", () => {
    expect(isAddress(TESTNET_CONFIG.pairAddress)).toBe(true);
    expect(isAddress(TESTNET_CONFIG.routerAddress)).toBe(true);
    expect(isAddress(TESTNET_CONFIG.proxyTraderAddress)).toBe(true);
  });

  it("configures Token A (ALPHA) and Token B (BETA) correctly", () => {
    expect(TESTNET_CONFIG.tokenA.symbol).toBe("ALPHA");
    expect(TESTNET_CONFIG.tokenA.decimals).toBe(18);
    expect(isAddress(TESTNET_CONFIG.tokenA.address)).toBe(true);
    expect(Number(TESTNET_CONFIG.tokenA.defaultAmount)).toBeGreaterThan(0);

    expect(TESTNET_CONFIG.tokenB.symbol).toBe("BETA");
    expect(TESTNET_CONFIG.tokenB.decimals).toBe(18);
    expect(isAddress(TESTNET_CONFIG.tokenB.address)).toBe(true);
    expect(Number(TESTNET_CONFIG.tokenB.defaultAmount)).toBeGreaterThan(0);
  });

  it("includes official BNB Chain faucet endpoints", () => {
    expect(TESTNET_CONFIG.officialFaucets.length).toBeGreaterThanOrEqual(2);
    const urls = TESTNET_CONFIG.officialFaucets.map((f) => f.url);
    expect(urls.some((u) => u.includes("bnbchain.org"))).toBe(true);
    expect(urls.some((u) => u.includes("discord.gg"))).toBe(true);
  });
});
