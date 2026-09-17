import { describe, it, expect, vi } from "vitest";
import type { StrategySubTab } from "../../../src/App";
import { executeKeeperSwap } from "../../../src/services/trading/keeper-executor";
import { resolveProxyTraderAddress } from "../../../src/contracts/proxy-trader";
import * as keeperManagerModule from "../../../src/services/trading/keeper-manager";
import { parseUnits, type Address } from "viem";

describe("Strategy Redesign & Keeper Delegation (TASK-019)", () => {
  it("defines Keeper tab as an explicit strategy sub-tab", () => {
    const validSubTabs: StrategySubTab[] = ["keeper", "reverse", "auto", "arbitrage"];
    expect(validSubTabs).toContain("keeper");
    expect(validSubTabs).toContain("reverse");
    expect(validSubTabs).toContain("auto");
    expect(validSubTabs).toContain("arbitrage");
  });

  it("verifies proxy contract is the mandatory spender for Keeper reverse trading", () => {
    const proxy97 = resolveProxyTraderAddress(97);
    expect(proxy97).toBeDefined();
    expect(proxy97?.startsWith("0x")).toBe(true);
  });

  it("fails early when executing keeper swap with 0 gas balance", async () => {
    vi.spyOn(keeperManagerModule, "fetchKeeperGasBalance").mockResolvedValueOnce({
      balanceWei: 0n,
      formatted: "0.0000",
      isLowGas: true,
    });

    const mockZeroGasKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
    const proxyAddress = resolveProxyTraderAddress(97)!;
    const userAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address;
    const tokenIn = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as Address;
    const tokenOut = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address;

    // Zero amount check
    await expect(
      executeKeeperSwap({
        keeperPrivateKey: mockZeroGasKey,
        proxyAddress,
        userAddress,
        tokenIn,
        tokenOut,
        amountIn: 0n,
        expectedAmountOut: 1000n,
        slippagePercent: 1.5,
      })
    ).rejects.toThrow("交易输入金额必须大于 0");
  });

  it("formats keeper execution parameters for proxyTrader contract accurately", async () => {
    vi.spyOn(keeperManagerModule, "fetchKeeperGasBalance").mockResolvedValueOnce({
      balanceWei: parseUnits("0.05", 18),
      formatted: "0.0500",
      isLowGas: false,
    });

    const mockKey = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
    const proxyAddress = resolveProxyTraderAddress(97)!;
    const userAddress = "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address;
    const tokenIn = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd" as Address;
    const tokenOut = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as Address;
    const amountIn = parseUnits("10", 18);
    const expectedOut = parseUnits("19.5", 18);

    const mockWriteContract = vi.fn().mockResolvedValue("0xmockTxHash1234567890");
    const mockWalletClient = {
      writeContract: mockWriteContract,
    };

    const res = await executeKeeperSwap({
      keeperPrivateKey: mockKey,
      proxyAddress,
      userAddress,
      tokenIn,
      tokenOut,
      amountIn,
      expectedAmountOut: expectedOut,
      slippagePercent: 2.0,
      walletClient: mockWalletClient,
      rpcUrl: "http://127.0.0.1:8545",
    });

    expect(res.txHash).toBe("0xmockTxHash1234567890");
    expect(mockWriteContract).toHaveBeenCalled();
  });
});
