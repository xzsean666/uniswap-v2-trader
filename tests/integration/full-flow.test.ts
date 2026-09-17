import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseUnits, type Address } from "viem";
import { evaluateReverseTradeTrigger, simulateTradeDryRun } from "../../src/strategies/reverse-trade-engine";
import { checkAndApprove } from "../../src/services/trading/token-approval";
import { dispatchSwapTransaction, waitForTransactionReceipt } from "../../src/services/trading/trade-dispatcher";
import * as multicall from "../../src/evm/multicall";
import * as rpcClient from "../../src/evm/rpc-client";
import type { TradeSideConfig } from "../../src/strategies/auto-trade-types";
import type { EIP1193Provider } from "../../src/wallet/ethereum";
import { CONTRACT_ADDRESSES } from "../../src/constants/contracts";

describe("Full System E2E Flow (TASK-014)", () => {
  const userAddress: Address = "0x8Fd31234567890abcdef1234567890abcdef1234";
  const tokenUSDT: Address = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd"; // BSC Testnet USDT
  const tokenACP: Address = "0x1111111111111111111111111111111111111111";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("executes complete lifecycle: trigger check -> dry run simulation -> approve -> swap dispatch -> receipt confirmation", async () => {
    // 1. Strategy Trigger Check
    const buyConfig: TradeSideConfig = {
      active: true,
      auto: true,
      slippage: true,
      antiSandwich: true,
      antiHoneypot: true,
      maxAmount: 200,
      minAmount: 100,
      priceFloor: 0.5888,
      dropThreshold: 5.0, // 5% drop
      dropActive: true,
      riseThreshold: 3.0,
      riseActive: false,
      taxRate: 1.5,
      taxActive: true,
    };

    const basePrice = 1.0;
    const droppedPrice = 0.94; // 6% drop, triggers buy
    const triggerResult = evaluateReverseTradeTrigger(buyConfig, droppedPrice, basePrice, "buy");

    expect(triggerResult.triggered).toBe(true);
    expect(triggerResult.action).toBe("buy");
    expect(triggerResult.suggestedAmount).toBeGreaterThanOrEqual(100);
    expect(triggerResult.suggestedAmount).toBeLessThanOrEqual(200);

    // 2. Dry Run Simulation via Multicall
    // Mock getAmountsOut returning 1.05 ACP for 1 USDT
    const amountIn = parseUnits(triggerResult.suggestedAmount.toString(), 18);
    const expectedOut = (amountIn * 105n) / 100n; // 1.05 ratio

    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      {
        success: true,
        result: [amountIn, expectedOut],
      },
    ]);

    const simResult = await simulateTradeDryRun({
      side: "buy",
      amountInFormatted: triggerResult.suggestedAmount,
      decimalsIn: 18,
      decimalsOut: 18,
      tokenIn: tokenUSDT,
      tokenOut: tokenACP,
      priceFloor: buyConfig.priceFloor,
    });

    expect(simResult.allowed).toBe(true);
    expect(simResult.expectedAmountOut).toBe(expectedOut);
    expect(simResult.effectivePrice).toBeGreaterThan(buyConfig.priceFloor);

    // 3. Allowance Check and Approval
    // First multicall check returns 0 allowance
    vi.spyOn(multicall, "multicallRead").mockResolvedValueOnce([
      { success: true, result: 0n },
    ]);

    const mockRequest = vi.fn();
    const mockProvider: EIP1193Provider = { request: mockRequest };

    mockRequest.mockResolvedValueOnce("0xapprovetransactionhash");

    const approvalResult = await checkAndApprove(
      mockProvider,
      userAddress,
      CONTRACT_ADDRESSES.PANCAKE_ROUTER,
      tokenUSDT,
      amountIn
    );

    expect(approvalResult.approved).toBe(false);
    expect(approvalResult.txHash).toBe("0xapprovetransactionhash");
    expect(mockRequest).toHaveBeenCalledTimes(1);

    // 4. Swap Dispatch via Wallet
    mockRequest.mockResolvedValueOnce("0xswaptransactionhash999");

    const swapResult = await dispatchSwapTransaction(mockProvider, {
      side: "buy",
      tokenIn: tokenUSDT,
      tokenOut: tokenACP,
      amountIn,
      expectedAmountOut: expectedOut,
      slippagePercent: 1.5,
      recipient: userAddress,
      deadlineMinutes: 20,
    });

    expect(swapResult.txHash).toBe("0xswaptransactionhash999");
    expect(swapResult.amountIn).toBe(amountIn);
    expect(swapResult.amountOutMin).toBeLessThan(expectedOut);

    // 5. Transaction Receipt Polling Confirmation
    vi.spyOn(rpcClient, "requestJsonRpc").mockResolvedValueOnce({
      blockNumber: "0x1e8480", // 2,000,000
      status: "0x1",
      gasUsed: "0x249f0", // 150,000
    });

    const receipt = await waitForTransactionReceipt(swapResult.txHash, 5000, 10);

    expect(receipt.status).toBe("success");
    expect(receipt.blockNumber).toBe(2000000n);
    expect(receipt.transactionHash).toBe("0xswaptransactionhash999");
  });
});
