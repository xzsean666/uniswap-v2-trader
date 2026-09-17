import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeKeeperSwap } from "../../../src/services/trading/keeper-executor";
import * as keeperManagerModule from "../../../src/services/trading/keeper-manager";

describe("KeeperExecutor Unit Tests", () => {
  const mockPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const mockUser = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const mockProxy = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
  const mockTokenIn = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const mockTokenOut = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should throw error if amountIn is <= 0n", async () => {
    await expect(
      executeKeeperSwap({
        keeperPrivateKey: mockPrivateKey,
        proxyAddress: mockProxy,
        userAddress: mockUser,
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: 0n,
        expectedAmountOut: 1000n,
        slippagePercent: 1.5,
      })
    ).rejects.toThrow("交易输入金额必须大于 0");
  });

  it("should throw error if Keeper Gas balance is 0", async () => {
    vi.spyOn(keeperManagerModule, "fetchKeeperGasBalance").mockResolvedValueOnce({
      balanceWei: 0n,
      formatted: "0.0000",
      isLowGas: true,
    });

    await expect(
      executeKeeperSwap({
        keeperPrivateKey: mockPrivateKey,
        proxyAddress: mockProxy,
        userAddress: mockUser,
        tokenIn: mockTokenIn,
        tokenOut: mockTokenOut,
        amountIn: 1000000000000000000n,
        expectedAmountOut: 1000000000000000000n,
        slippagePercent: 1.5,
      })
    ).rejects.toThrow("Gas 余额为 0");
  });

  it("should construct and broadcast executeSwap transaction via walletClient", async () => {
    vi.spyOn(keeperManagerModule, "fetchKeeperGasBalance").mockResolvedValueOnce({
      balanceWei: 10000000000000000n,
      formatted: "0.0100",
      isLowGas: false,
    });

    const mockWriteContract = vi.fn().mockResolvedValue("0xmockexecutedswaptxhash");
    const mockWalletClient = { writeContract: mockWriteContract };

    const result = await executeKeeperSwap({
      keeperPrivateKey: mockPrivateKey,
      proxyAddress: mockProxy,
      userAddress: mockUser,
      tokenIn: mockTokenIn,
      tokenOut: mockTokenOut,
      amountIn: 1000000000000000000n,
      expectedAmountOut: 2000000000000000000n,
      slippagePercent: 2.0, // 2% -> minOut = 1960000000000000000n
      currentTimestampSec: 1700000000,
      deadlineMinutes: 15,
      isFeeOnTransfer: false,
      walletClient: mockWalletClient,
    });

    expect(result.txHash).toBe("0xmockexecutedswaptxhash");
    expect(result.methodName).toBe("executeSwap");

    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockProxy,
        functionName: "executeSwap",
        args: [
          mockUser, // Zero-Theft: user is target
          [mockTokenIn, mockTokenOut],
          1000000000000000000n,
          1960000000000000000n, // slippage-protected minOut
          BigInt(1700000000 + 15 * 60),
        ],
      })
    );
  });

  it("should switch to executeSwapSupportingFeeOnTransferTokens when isFeeOnTransfer is true", async () => {
    vi.spyOn(keeperManagerModule, "fetchKeeperGasBalance").mockResolvedValueOnce({
      balanceWei: 10000000000000000n,
      formatted: "0.0100",
      isLowGas: false,
    });

    const mockWriteContract = vi.fn().mockResolvedValue("0xmockfeeswaptxhash");
    const mockWalletClient = { writeContract: mockWriteContract };

    const result = await executeKeeperSwap({
      keeperPrivateKey: mockPrivateKey,
      proxyAddress: mockProxy,
      userAddress: mockUser,
      tokenIn: mockTokenIn,
      tokenOut: mockTokenOut,
      amountIn: 1000000000000000000n,
      expectedAmountOut: 2000000000000000000n,
      slippagePercent: 5.0,
      isFeeOnTransfer: true,
      walletClient: mockWalletClient,
    });

    expect(result.txHash).toBe("0xmockfeeswaptxhash");
    expect(result.methodName).toBe("executeSwapSupportingFeeOnTransferTokens");
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "executeSwapSupportingFeeOnTransferTokens",
      })
    );
  });
});
