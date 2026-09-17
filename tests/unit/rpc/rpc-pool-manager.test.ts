import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RpcPoolManager,
  DEFAULT_BSC_TESTNET_RPCS,
  DEFAULT_BSC_MAINNET_RPCS,
} from "../../../src/services/rpc/rpc-pool-manager";

describe("RpcPoolManager - High Availability RPC Pool & Dynamic Injection", () => {
  beforeEach(() => {
    // Reset defaults before each test
    RpcPoolManager.resetToDefaults(97);
    RpcPoolManager.resetToDefaults(56);
  });

  describe("Default Built-in RPCs", () => {
    it("provides multiple verified endpoints for BSC Testnet", () => {
      const endpoints = RpcPoolManager.getDefaultRpcUrls(97);
      expect(endpoints.length).toBeGreaterThanOrEqual(5);
      expect(endpoints).toEqual(DEFAULT_BSC_TESTNET_RPCS);
      expect(endpoints.some((url) => url.includes("bnbchain.org"))).toBe(true);
      expect(endpoints.some((url) => url.includes("publicnode.com"))).toBe(true);
      expect(endpoints.some((url) => url.includes("drpc.org"))).toBe(true);
    });

    it("provides verified endpoints for BSC Mainnet", () => {
      const endpoints = RpcPoolManager.getDefaultRpcUrls(56);
      expect(endpoints.length).toBeGreaterThanOrEqual(5);
      expect(endpoints).toEqual(DEFAULT_BSC_MAINNET_RPCS);
      expect(endpoints.some((url) => url.includes("binance.org"))).toBe(true);
      expect(endpoints.some((url) => url.includes("llamarpc.com"))).toBe(true);
    });

    it("retrieves active endpoints matching defaults when no custom RPC is added", () => {
      const active = RpcPoolManager.getActiveRpcUrls(97);
      expect(active.length).toBe(DEFAULT_BSC_TESTNET_RPCS.length);
    });
  });

  describe("Custom RPC Management & Dynamic Injection", () => {
    it("validates URL prefix format", async () => {
      const res = await RpcPoolManager.addCustomRpc(97, "ftp://invalid-url.com");
      expect(res.success).toBe(false);
      expect(res.error).toContain("http:// 或 https://");
    });

    it("successfully adds custom RPC endpoint when test ping succeeds", async () => {
      vi.spyOn(RpcPoolManager, "testEndpoint").mockResolvedValue({
        success: true,
        latencyMs: 88,
        blockNumber: 131500000n,
        actualChainId: 97,
      });

      const res = await RpcPoolManager.addCustomRpc(
        97,
        "https://my-custom-node.quicknode.pro",
        "QuickNode 测试节点"
      );

      expect(res.success).toBe(true);
      expect(res.latencyMs).toBe(88);

      const active = RpcPoolManager.getActiveRpcUrls(97);
      expect(active[0]).toBe("https://my-custom-node.quicknode.pro"); // custom is prioritized first
    });

    it("toggles and disables an endpoint", async () => {
      const defaultUrl = DEFAULT_BSC_TESTNET_RPCS[0];
      RpcPoolManager.toggleRpc(97, defaultUrl, false);

      const active = RpcPoolManager.getActiveRpcUrls(97);
      expect(active).not.toContain(defaultUrl);

      // Re-enable
      RpcPoolManager.toggleRpc(97, defaultUrl, true);
      const reActive = RpcPoolManager.getActiveRpcUrls(97);
      expect(reActive).toContain(defaultUrl);
    });

    it("removes a custom RPC endpoint", async () => {
      vi.spyOn(RpcPoolManager, "testEndpoint").mockResolvedValue({
        success: true,
        latencyMs: 95,
      });

      await RpcPoolManager.addCustomRpc(97, "https://to-delete.com");
      expect(RpcPoolManager.getActiveRpcUrls(97)).toContain("https://to-delete.com");

      RpcPoolManager.removeCustomRpc(97, "https://to-delete.com");
      expect(RpcPoolManager.getActiveRpcUrls(97)).not.toContain("https://to-delete.com");
    });

    it("notifies listeners on pool updates", async () => {
      const listener = vi.fn();
      const unsubscribe = RpcPoolManager.onPoolChange(listener);

      vi.spyOn(RpcPoolManager, "testEndpoint").mockResolvedValue({
        success: true,
        latencyMs: 60,
      });

      await RpcPoolManager.addCustomRpc(97, "https://notify-node.com");
      expect(listener).toHaveBeenCalledWith(97, expect.any(Array));

      unsubscribe();
    });
  });
});
