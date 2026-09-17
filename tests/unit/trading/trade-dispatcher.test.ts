import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUnits, type Address, decodeFunctionData } from "viem";
import {
  calculateAmountOutMin,
  assembleSwapCalldata,
  dispatchSwapTransaction,
  waitForTransactionReceipt,
  type TradeDispatchParams,
} from "../../../src/services/trading/trade-dispatcher";
import { CONTRACT_ADDRESSES } from "../../../src/constants/contracts";
import { PANCAKE_ROUTER_ABI } from "../../../src/abi/pancake";
import * as rpcClient from "../../../src/evm/rpc-client";
import type { EIP1193Provider } from "../../../src/wallet/ethereum";

describe("Trade Dispatcher Service (TASK-014)", () => {
  const tokenIn: Address = "0x1111111111111111111111111111111111111111";
  const tokenOut: Address = "0x2222222222222222222222222222222222222222";
  const recipient: Address = "0x3333333333333333333333333333333333333333";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateAmountOutMin", () => {
    it("correctly calculates minimum amount with 1% slippage", () => {
      const expected = parseUnits("100", 18);
      const minOut = calculateAmountOutMin(expected, 1.0);
      expect(minOut).toBe(parseUnits("99", 18));
    });

    it("correctly calculates minimum amount with 0.5% slippage", () => {
      const expected = 10000n;
      const minOut = calculateAmountOutMin(expected, 0.5);
      expect(minOut).toBe(9950n);
    });

    it("handles zero or edge values safely", () => {
      expect(calculateAmountOutMin(0n, 5)).toBe(0n);
      expect(calculateAmountOutMin(100n, 0)).toBe(100n);
      expect(calculateAmountOutMin(100n, 100)).toBe(0n);
    });
  });

  describe("assembleSwapCalldata", () => {
    const baseParams: TradeDispatchParams = {
      side: "buy",
      tokenIn,
      tokenOut,
      amountIn: parseUnits("10", 18),
      expectedAmountOut: parseUnits("100", 18),
      slippagePercent: 2.0, // 2%
      recipient,
      deadlineMinutes: 15,
    };

    it("assembles standard PancakeSwap Router calldata", () => {
      const fixedTime = 1700000000;
      const calldataResult = assembleSwapCalldata(baseParams, fixedTime);

      expect(calldataResult.target.toLowerCase()).toBe(
        CONTRACT_ADDRESSES.PANCAKE_ROUTER.toLowerCase()
      );
      expect(calldataResult.amountIn).toBe(parseUnits("10", 18));
      expect(calldataResult.amountOutMin).toBe(parseUnits("98", 18)); // 2% slippage off 100
      expect(calldataResult.deadline).toBe(BigInt(fixedTime + 15 * 60));

      // Decode and verify function data
      const decoded = decodeFunctionData({
        abi: PANCAKE_ROUTER_ABI,
        data: calldataResult.data,
      });

      expect(decoded.functionName).toBe("swapExactTokensForTokens");
      expect(decoded.args[0]).toBe(calldataResult.amountIn);
      expect(decoded.args[1]).toBe(calldataResult.amountOutMin);
      expect((decoded.args[3] as Address).toLowerCase()).toBe(recipient.toLowerCase());
    });

    it("assembles custom proxy contract calldata when enabled", () => {
      const customProxyAddr: Address = "0x8888888888888888888888888888888888888888";
      const customParams: TradeDispatchParams = {
        ...baseParams,
        customProxy: {
          enabled: true,
          contractAddress: customProxyAddr,
          methodName: "swapExactTokensForTokens",
        },
      };

      const result = assembleSwapCalldata(customParams, 1700000000);
      expect(result.target.toLowerCase()).toBe(customProxyAddr.toLowerCase());
      expect(result.data).toBeDefined();
    });
  });

  describe("dispatchSwapTransaction", () => {
    it("dispatches transaction via wallet provider", async () => {
      const mockRequest = vi.fn().mockResolvedValue("0xswaptx987654");
      const mockProvider: EIP1193Provider = { request: mockRequest };

      const params: TradeDispatchParams = {
        side: "sell",
        tokenIn,
        tokenOut,
        amountIn: parseUnits("50", 18),
        expectedAmountOut: parseUnits("50", 18),
        slippagePercent: 1.0,
        recipient,
      };

      const result = await dispatchSwapTransaction(mockProvider, params);

      expect(result.txHash).toBe("0xswaptx987654");
      expect(result.isCustomProxy).toBe(false);
      expect(mockRequest).toHaveBeenCalledTimes(1);
      const call = mockRequest.mock.calls[0][0];
      expect(call.method).toBe("eth_sendTransaction");
      expect(call.params[0].from.toLowerCase()).toBe(recipient.toLowerCase());
      expect(call.params[0].to.toLowerCase()).toBe(
        CONTRACT_ADDRESSES.PANCAKE_ROUTER.toLowerCase()
      );
    });
  });

  describe("waitForTransactionReceipt", () => {
    it("returns success receipt when status is 0x1", async () => {
      vi.spyOn(rpcClient, "requestJsonRpc").mockResolvedValueOnce({
        blockNumber: "0x1234",
        status: "0x1",
        gasUsed: "0x5208",
      });

      const receipt = await waitForTransactionReceipt(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        1000,
        10
      );

      expect(receipt.status).toBe("success");
      expect(receipt.blockNumber).toBe(BigInt(0x1234));
      expect(receipt.gasUsed).toBe(BigInt(0x5208));
    });

    it("returns reverted receipt when status is 0x0", async () => {
      vi.spyOn(rpcClient, "requestJsonRpc").mockResolvedValueOnce({
        blockNumber: "0x1234",
        status: "0x0",
        gasUsed: "0x5208",
      });

      const receipt = await waitForTransactionReceipt(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        1000,
        10
      );

      expect(receipt.status).toBe("reverted");
    });

    it("retries when receipt is temporarily null", async () => {
      vi.spyOn(rpcClient, "requestJsonRpc")
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          blockNumber: "0x2000",
          status: "0x1",
          gasUsed: "0x6000",
        });

      const receipt = await waitForTransactionReceipt(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        2000,
        10
      );

      expect(receipt.status).toBe("success");
      expect(receipt.blockNumber).toBe(BigInt(0x2000));
    });
  });
});
