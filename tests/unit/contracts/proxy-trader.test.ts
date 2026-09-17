import { describe, it, expect, vi } from "vitest";
import {
  UNISWAP_V2_PROXY_TRADER_ABI,
  resolveProxyTraderAddress,
  encodeSetKeeperData,
  encodeRemoveKeeperData,
  sendSetKeeperTransaction,
  sendRemoveKeeperTransaction,
  getBoundKeeper,
  DEFAULT_PROXY_TRADER_ADDRESSES,
} from "../../../src/contracts/proxy-trader";
import * as multicallModule from "../../../src/evm/multicall";
import { decodeFunctionData } from "viem";

describe("ProxyTrader Contract Interface Unit Tests", () => {
  const mockUser = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const mockKeeper = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const mockProxy = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  describe("resolveProxyTraderAddress", () => {
    it("should resolve local Hardhat default proxy address for chainId 31337", () => {
      const resolved = resolveProxyTraderAddress(31337);
      expect(resolved?.toLowerCase()).toBe(
        DEFAULT_PROXY_TRADER_ADDRESSES[31337].toLowerCase()
      );
    });

    it("should prioritize valid custom contract address if supplied", () => {
      const custom = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4df";
      const resolved = resolveProxyTraderAddress(31337, custom);
      expect(resolved?.toLowerCase()).toBe(custom.toLowerCase());
    });

    it("should fallback to default when custom address is invalid", () => {
      const resolved = resolveProxyTraderAddress(31337, "invalid-address");
      expect(resolved?.toLowerCase()).toBe(
        DEFAULT_PROXY_TRADER_ADDRESSES[31337].toLowerCase()
      );
    });
  });

  describe("encodeSetKeeperData & encodeRemoveKeeperData", () => {
    it("should correctly encode setKeeper function calldata", () => {
      const calldata = encodeSetKeeperData(mockKeeper);
      expect(calldata.startsWith("0x")).toBe(true);

      const decoded = decodeFunctionData({
        abi: UNISWAP_V2_PROXY_TRADER_ABI,
        data: calldata,
      });
      expect(decoded.functionName).toBe("setKeeper");
      expect((decoded.args?.[0] as string).toLowerCase()).toBe(
        mockKeeper.toLowerCase()
      );
    });

    it("should correctly encode removeKeeper function calldata", () => {
      const calldata = encodeRemoveKeeperData();
      const decoded = decodeFunctionData({
        abi: UNISWAP_V2_PROXY_TRADER_ABI,
        data: calldata,
      });
      expect(decoded.functionName).toBe("removeKeeper");
    });
  });

  describe("sendSetKeeperTransaction & sendRemoveKeeperTransaction", () => {
    it("should send setKeeper transaction using external wallet provider", async () => {
      const mockRequest = vi.fn().mockResolvedValue("0xmocksetkeeperhash");
      const provider = { request: mockRequest } as any;

      const txHash = await sendSetKeeperTransaction(
        provider,
        mockUser,
        mockProxy,
        mockKeeper
      );

      expect(txHash).toBe("0xmocksetkeeperhash");
      expect(mockRequest).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: [
          {
            from: mockUser,
            to: mockProxy,
            data: encodeSetKeeperData(mockKeeper),
          },
        ],
      });
    });

    it("should send removeKeeper transaction using external wallet provider", async () => {
      const mockRequest = vi.fn().mockResolvedValue("0xmockremovekeeperhash");
      const provider = { request: mockRequest } as any;

      const txHash = await sendRemoveKeeperTransaction(
        provider,
        mockUser,
        mockProxy
      );

      expect(txHash).toBe("0xmockremovekeeperhash");
      expect(mockRequest).toHaveBeenCalledWith({
        method: "eth_sendTransaction",
        params: [
          {
            from: mockUser,
            to: mockProxy,
            data: encodeRemoveKeeperData(),
          },
        ],
      });
    });
  });

  describe("getBoundKeeper", () => {
    it("should return bound keeper address from multicall", async () => {
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValueOnce([
        {
          success: true,
          result: mockKeeper,
        },
      ]);

      const bound = await getBoundKeeper(mockProxy, mockUser);
      expect(bound?.toLowerCase()).toBe(mockKeeper.toLowerCase());
    });

    it("should return null if bound keeper is zero address or call failed", async () => {
      vi.spyOn(multicallModule, "multicallRead").mockResolvedValueOnce([
        {
          success: true,
          result: "0x0000000000000000000000000000000000000000",
        },
      ]);

      const bound = await getBoundKeeper(mockProxy, mockUser);
      expect(bound).toBeNull();
    });
  });
});
