import { describe, it, expect, beforeEach } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  parseChainId,
  formatAddress,
  requestAccounts,
  getProviderChainId,
  switchToBscTestnet,
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_CHAIN_ID_HEX,
  type EIP1193Provider,
} from "../../../src/wallet/ethereum";
import {
  generateNonce,
  buildSignInMessage,
  verifySignature,
  saveAuthSession,
  loadAuthSession,
  clearAuthSession,
  type AuthSession,
} from "../../../src/wallet/auth";

describe("Web3 Wallet & Authentication (TASK-003)", () => {
  const TEST_PRIVATE_KEY =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const testAccount = privateKeyToAccount(TEST_PRIVATE_KEY);

  beforeEach(() => {
    clearAuthSession();
  });

  describe("Ethereum Provider & Utilities", () => {
    it("parses various chain ID formats accurately", () => {
      expect(parseChainId(97)).toBe(97);
      expect(parseChainId("0x61")).toBe(97);
      expect(parseChainId("97")).toBe(97);
      expect(parseChainId("0x1")).toBe(1);
    });

    it("formats addresses with ellipsis", () => {
      expect(formatAddress(testAccount.address)).toBe(
        `${testAccount.address.slice(0, 6)}...${testAccount.address.slice(-4)}`
      );
      expect(formatAddress("")).toBe("");
      expect(formatAddress("0x12345")).toBe("0x12345");
    });

    it("requests accounts from EIP-1193 provider", async () => {
      const mockProvider: EIP1193Provider = {
        request: async ({ method }) => {
          if (method === "eth_requestAccounts") {
            return [testAccount.address];
          }
          throw new Error(`Unhandled method: ${method}`);
        },
      };

      const accounts = await requestAccounts(mockProvider);
      expect(accounts).toEqual([testAccount.address.toLowerCase()]);
    });

    it("gets chain ID from EIP-1193 provider", async () => {
      const mockProvider: EIP1193Provider = {
        request: async ({ method }) => {
          if (method === "eth_chainId") {
            return BSC_TESTNET_CHAIN_ID_HEX;
          }
          throw new Error(`Unhandled method: ${method}`);
        },
      };

      const chainId = await getProviderChainId(mockProvider);
      expect(chainId).toBe(BSC_TESTNET_CHAIN_ID);
    });

    it("handles switch to BSC testnet and adds chain if not found (4902)", async () => {
      let chainAdded = false;

      const mockProvider: EIP1193Provider = {
        request: async ({ method }) => {
          if (method === "wallet_switchEthereumChain") {
            const err: any = new Error("Chain not added");
            err.code = 4902;
            throw err;
          }
          if (method === "wallet_addEthereumChain") {
            chainAdded = true;
            return null;
          }
          return null;
        },
      };

      await switchToBscTestnet(mockProvider);
      expect(chainAdded).toBe(true);
    });
  });

  describe("EIP-191 Authentication & Signature Verification", () => {
    it("generates a random nonce", () => {
      const n1 = generateNonce();
      const n2 = generateNonce();
      expect(n1).toBeDefined();
      expect(n1.length).toBe(16);
      expect(n1).not.toBe(n2);
    });

    it("builds a standard sign-in challenge message", () => {
      const nonce = generateNonce();
      const timestamp = 1710000000000;
      const message = buildSignInMessage({
        address: testAccount.address,
        chainId: 97,
        nonce,
        timestamp,
        domain: "localhost:5173",
      });

      expect(message).toContain("localhost:5173 想要使用您的 Web3 账户登录:");
      expect(message).toContain(testAccount.address);
      expect(message).toContain("Chain ID: 97");
      expect(message).toContain(`Nonce: ${nonce}`);
    });

    it("verifies real EIP-191 signatures signed with private key", async () => {
      const message = buildSignInMessage({
        address: testAccount.address,
        chainId: 97,
        nonce: generateNonce(),
        timestamp: Date.now(),
      });

      const signature = await testAccount.signMessage({ message });

      const isValid = await verifySignature({
        address: testAccount.address,
        message,
        signature,
      });

      expect(isValid).toBe(true);

      const isInvalid = await verifySignature({
        address: testAccount.address,
        message: message + " tampered",
        signature,
      });

      expect(isInvalid).toBe(false);
    });

    it("persists and restores auth session in localStorage", () => {
      const session: AuthSession = {
        address: testAccount.address,
        signature: "0x1234" as `0x${string}`,
        message: "test message",
        timestamp: Date.now(),
        nonce: "test_nonce",
      };

      saveAuthSession(session);
      const loaded = loadAuthSession();
      expect(loaded).toEqual(session);

      clearAuthSession();
      expect(loadAuthSession()).toBeNull();
    });
  });
});
