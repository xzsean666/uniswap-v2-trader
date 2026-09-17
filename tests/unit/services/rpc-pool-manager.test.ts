import { describe, it, expect, beforeEach } from "vitest";
import {
  RpcPoolManager,
  DEFAULT_BSC_TESTNET_ARCHIVE_RPCS,
  DEFAULT_BSC_TESTNET_STANDARD_RPCS,
  DEFAULT_BSC_MAINNET_ARCHIVE_RPCS,
  DEFAULT_BSC_MAINNET_STANDARD_RPCS,
  isArchiveRpcUrl,
} from "../../../src/services/rpc/rpc-pool-manager";
import {
  getArchiveRpcUrlsForChain,
  getStandardRpcUrlsForChain,
} from "../../../src/constants/contracts";

describe("RpcPoolManager Archive & Standard Node Decoupling", () => {
  beforeEach(() => {
    RpcPoolManager.resetToDefaults(97);
    RpcPoolManager.resetToDefaults(56);
  });

  it("identifies archive URLs correctly via isArchiveRpcUrl", () => {
    expect(isArchiveRpcUrl("https://bsc-testnet-rpc.publicnode.com")).toBe(true);
    expect(isArchiveRpcUrl("https://bsc-testnet.drpc.org")).toBe(true);
    expect(isArchiveRpcUrl("https://bsc-rpc.publicnode.com")).toBe(true);
    expect(isArchiveRpcUrl("http://127.0.0.1:8545")).toBe(true);
    expect(isArchiveRpcUrl("https://my-custom-archive-node.io")).toBe(true);

    expect(isArchiveRpcUrl("https://bsc-testnet-dataseed.bnbchain.org")).toBe(false);
    expect(isArchiveRpcUrl("https://data-seed-prebsc-1-s1.binance.org:8545")).toBe(false);
    expect(isArchiveRpcUrl("https://bsc-dataseed.binance.org")).toBe(false);
  });

  it("returns verified archive endpoints for Testnet and Mainnet", () => {
    const testnetArchive = getArchiveRpcUrlsForChain(97);
    expect(testnetArchive).toEqual(DEFAULT_BSC_TESTNET_ARCHIVE_RPCS);
    expect(testnetArchive.every((url) => isArchiveRpcUrl(url))).toBe(true);

    const mainnetArchive = getArchiveRpcUrlsForChain(56);
    expect(mainnetArchive).toEqual(DEFAULT_BSC_MAINNET_ARCHIVE_RPCS);
    expect(mainnetArchive.every((url) => isArchiveRpcUrl(url))).toBe(true);
  });

  it("returns high-throughput standard endpoints for Testnet and Mainnet", () => {
    const testnetStandard = getStandardRpcUrlsForChain(97);
    expect(testnetStandard).toEqual(DEFAULT_BSC_TESTNET_STANDARD_RPCS);

    const mainnetStandard = getStandardRpcUrlsForChain(56);
    expect(mainnetStandard).toEqual(DEFAULT_BSC_MAINNET_STANDARD_RPCS);
  });

  it("classifies and returns nodeType correctly in getAllEndpoints", () => {
    const all = RpcPoolManager.getAllEndpoints(97);
    expect(all.length).toBeGreaterThan(0);

    const archives = all.filter((ep) => ep.nodeType === "archive");
    const standards = all.filter((ep) => ep.nodeType === "standard");

    expect(archives.length).toBe(DEFAULT_BSC_TESTNET_ARCHIVE_RPCS.length);
    expect(standards.length).toBe(DEFAULT_BSC_TESTNET_STANDARD_RPCS.length);
  });
});
