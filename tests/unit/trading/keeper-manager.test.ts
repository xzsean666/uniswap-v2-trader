import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  generateKeeperWallet,
  importKeeperWallet,
  getStoredKeeperWallet,
  clearKeeperWallet,
  normalizePrivateKey,
  fetchKeeperGasBalance,
  fundKeeperGas,
  getKeeperStorage,
  KEEPER_STORAGE_KEY,
} from "../../../src/services/trading/keeper-manager";
import { isAddress, parseEther } from "viem";

describe("KeeperManager Unit Tests", () => {
  beforeEach(() => {
    getKeeperStorage().clear();
    vi.restoreAllMocks();
  });

  describe("normalizePrivateKey", () => {
    it("should accept valid 64-char hex key with 0x prefix", () => {
      const validKey =
        "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
      expect(normalizePrivateKey(validKey)).toBe(validKey);
    });

    it("should prepend 0x if omitted", () => {
      const raw =
        "4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
      expect(normalizePrivateKey(raw)).toBe(`0x${raw}`);
    });

    it("should throw on invalid length or characters", () => {
      expect(() => normalizePrivateKey("0x123")).toThrow("无效的以太坊私钥格式");
      expect(() => normalizePrivateKey("not-a-hex-key")).toThrow();
    });
  });

  describe("generateKeeperWallet & Storage", () => {
    it("should generate a random Keeper EOA and persist it to localStorage", () => {
      const wallet = generateKeeperWallet();
      expect(wallet.privateKey).toMatch(/^0x[a-f0-9]{64}$/i);
      expect(isAddress(wallet.address)).toBe(true);

      const stored = getStoredKeeperWallet();
      expect(stored).not.toBeNull();
      expect(stored?.address).toBe(wallet.address);
      expect(stored?.privateKey).toBe(wallet.privateKey);
    });

    it("should clear stored keeper wallet", () => {
      generateKeeperWallet();
      expect(getKeeperStorage().getItem(KEEPER_STORAGE_KEY)).not.toBeNull();

      clearKeeperWallet();
      expect(getStoredKeeperWallet()).toBeNull();
      expect(getKeeperStorage().getItem(KEEPER_STORAGE_KEY)).toBeNull();
    });
  });

  describe("importKeeperWallet", () => {
    it("should import a known private key and derive the deterministic address", () => {
      // Well-known Hardhat account #0
      const privateKey =
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
      const expectedAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

      const imported = importKeeperWallet(privateKey);
      expect(imported.address.toLowerCase()).toBe(expectedAddress.toLowerCase());

      const stored = getStoredKeeperWallet();
      expect(stored?.address.toLowerCase()).toBe(expectedAddress.toLowerCase());
    });
  });

  describe("fetchKeeperGasBalance", () => {
    it("should correctly parse balance and calculate low gas alert", async () => {
      // Mock RPC balance response
      const balanceHex = "0x2386f26fc10000"; // 0.01 BNB in wei (10000000000000000)
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: balanceHex }),
      } as any);

      const info = await fetchKeeperGasBalance(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      );
      expect(info.balanceWei).toBe(parseEther("0.01"));
      expect(info.formatted).toBe("0.0100");
      expect(info.isLowGas).toBe(false);
    });

    it("should flag isLowGas when balance is below threshold (0.003 BNB)", async () => {
      const balanceHex = "0x38d7ea4c68000"; // 0.001 BNB in wei
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jsonrpc: "2.0", id: 1, result: balanceHex }),
      } as any);

      const info = await fetchKeeperGasBalance(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      );
      expect(info.isLowGas).toBe(true);
    });
  });

  describe("fundKeeperGas", () => {
    it("should format eth_sendTransaction call from user to keeper", async () => {
      const mockRequest = vi.fn().mockResolvedValue("0xmockfundhash");
      const provider = { request: mockRequest } as any;

      const txHash = await fundKeeperGas(
        provider,
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0.02"
      );

      expect(txHash).toBe("0xmockfundhash");
      expect(mockRequest).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: [
          {
            from: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
            to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            value: `0x${parseEther("0.02").toString(16)}`,
          },
        ],
      });
    });
  });
});
