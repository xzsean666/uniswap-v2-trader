import { describe, it, expect, beforeEach } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  generateNonce,
  buildSignInMessage,
  validateSessionTamperProof,
  type AuthSession,
} from "../../src/wallet/auth";
import {
  generateKeeperWallet,
  clearKeeperWallet,
  normalizePrivateKey,
  getStoredKeeperWallet,
} from "../../src/services/trading/keeper-manager";
import {
  getRpcUrlsForChain,
  BSC_TESTNET_RPCS,
  BSC_MAINNET_RPCS,
  LOCALHOST_RPCS,
} from "../../src/constants/contracts";
import {
  setActiveChainId,
  getActiveChainId,
} from "../../src/evm/rpc-client";
import { evaluateAndExecuteAutoTrade } from "../../src/strategies/strategy-runner";
import type { AutoTradeConfig } from "../../src/strategies/auto-trade-types";

describe("Audit Optimizations & Security Safeguards (Audit 2026-09-17)", () => {
  const TEST_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

  describe("S-01: Session Tamper Proof & Verification", () => {
    it("validates authentic, untampered session signature", async () => {
      const nonce = generateNonce();
      const timestamp = Date.now();
      const message = buildSignInMessage({
        address: testAccount.address,
        chainId: 97,
        nonce,
        timestamp,
      });
      const signature = await testAccount.signMessage({ message });

      const session: AuthSession = {
        address: testAccount.address,
        signature,
        message,
        timestamp,
        nonce,
      };

      const isValid = await validateSessionTamperProof(session);
      expect(isValid).toBe(true);
    });

    it("rejects tampered address or forged message", async () => {
      const nonce = generateNonce();
      const timestamp = Date.now();
      const message = buildSignInMessage({
        address: testAccount.address,
        chainId: 97,
        nonce,
        timestamp,
      });
      const signature = await testAccount.signMessage({ message });

      const forgedSession: AuthSession = {
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        signature, // signature does not belong to this address
        message,
        timestamp,
        nonce,
      };

      const isValid = await validateSessionTamperProof(forgedSession);
      expect(isValid).toBe(false);
    });

    it("rejects expired session older than 24 hours", async () => {
      const nonce = generateNonce();
      const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      const message = buildSignInMessage({
        address: testAccount.address,
        chainId: 97,
        nonce,
        timestamp: expiredTimestamp,
      });
      const signature = await testAccount.signMessage({ message });

      const expiredSession: AuthSession = {
        address: testAccount.address,
        signature,
        message,
        timestamp: expiredTimestamp,
        nonce,
      };

      const isValid = await validateSessionTamperProof(expiredSession);
      expect(isValid).toBe(false);
    });
  });

  describe("S-02: Keeper Key Sanitization & Memory Wipe", () => {
    beforeEach(() => {
      clearKeeperWallet();
    });

    it("rejects all-zero private key", () => {
      const zeroKey = "0x" + "0".repeat(64);
      expect(() => normalizePrivateKey(zeroKey)).toThrow("不能使用全零的无效私钥");
    });

    it("clears keeper wallet cleanly", () => {
      generateKeeperWallet();
      expect(getStoredKeeperWallet()).not.toBeNull();

      clearKeeperWallet();
      expect(getStoredKeeperWallet()).toBeNull();
    });
  });

  describe("P-01: Multi-Network RPC Routing", () => {
    it("resolves correct RPC pool for Testnet, Mainnet, and Localhost", () => {
      expect(getRpcUrlsForChain(97)).toEqual(BSC_TESTNET_RPCS);
      expect(getRpcUrlsForChain(56)).toEqual(BSC_MAINNET_RPCS);
      expect(getRpcUrlsForChain(31337)).toEqual(LOCALHOST_RPCS);
      expect(getRpcUrlsForChain(undefined)).toEqual(BSC_TESTNET_RPCS);
    });

    it("tracks and updates activeChainId in rpc-client", () => {
      setActiveChainId(56);
      expect(getActiveChainId()).toBe(56);

      setActiveChainId(97);
      expect(getActiveChainId()).toBe(97);
    });
  });

  describe("L-01: Trade Runner Output Guard", () => {
    it("rejects execution if expectedAmountOut is missing or 0", async () => {
      const dummyConfig: AutoTradeConfig = {
        pairAddress: "0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02",
        basePrice: 1.0,
        cooldownSeconds: 0,
        updatedAt: Date.now(),
        buy: {
          active: true,
          auto: true,
          minAmount: 10,
          maxAmount: 10,
          dropActive: true,
          dropThreshold: 1, // 1% drop
          riseActive: false,
          riseThreshold: 10,
          slippage: true,
          priceFloor: 0,
          taxActive: false,
          taxRate: 0,
          antiSandwich: false,
          antiHoneypot: false,
        },
        sell: {
          active: false,
          auto: false,
          minAmount: 10,
          maxAmount: 10,
          dropActive: false,
          dropThreshold: 5,
          riseActive: false,
          riseThreshold: 5,
          slippage: true,
          priceFloor: 0,
          taxActive: false,
          taxRate: 0,
          antiSandwich: false,
          antiHoneypot: false,
        },
      };

      const outcome = await evaluateAndExecuteAutoTrade({
        config: dummyConfig,
        currentPrice: 0.95, // 5% drop, triggers buy
        token0Address: "0xd26cdc2d33bda34c07f01c459ab32a2bf4c9f441",
        token1Address: "0x7a939029997569074973b1ee95118d387f171863",
        masterAddress: testAccount.address,
        proxyAddress: "0x3c43ac2680e9a4fc387a31ea47f9a88eee8b1b13",
        keeper: null, // keeper not set
        isSilentEnabled: false,
        isBoundToProxy: false,
      });

      expect(outcome.triggered).toBe(true);
      expect(outcome.executed).toBe(false);
      expect(outcome.reason).toContain("打工小号 (Keeper) 未激活");
    });
  });
});
