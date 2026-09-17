import {
  encodeFunctionData,
  getAddress,
  parseAbi,
  type Address,
} from "viem";
import { PANCAKE_ROUTER_ABI } from "../../abi/pancake";
import { CONTRACT_ADDRESSES } from "../../constants/contracts";
import { requestJsonRpc } from "../../evm/rpc-client";
import type { EIP1193Provider } from "../../wallet/ethereum";

export interface CustomProxyConfig {
  enabled: boolean;
  contractAddress?: Address;
  methodName?: string;
}

export interface TradeDispatchParams {
  side: "buy" | "sell";
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  expectedAmountOut: bigint;
  slippagePercent: number; // e.g. 1.5 for 1.5%
  recipient: Address;
  deadlineMinutes?: number; // default 20 minutes
  routerAddress?: Address;
  customProxy?: CustomProxyConfig;
}

export interface DispatchCalldataResult {
  target: Address;
  data: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  deadline: bigint;
  path: [Address, Address];
}

export interface DispatchedTradeResult {
  txHash: `0x${string}`;
  amountIn: bigint;
  amountOutMin: bigint;
  targetContract: Address;
  isCustomProxy: boolean;
}

export interface TransactionReceiptResult {
  transactionHash: `0x${string}`;
  blockNumber: bigint;
  status: "success" | "reverted";
  gasUsed: bigint;
}

/**
 * Calculate minimum amount out factoring in slippage tolerance
 */
export function calculateAmountOutMin(
  expectedAmountOut: bigint,
  slippagePercent: number
): bigint {
  if (expectedAmountOut <= 0n) return 0n;
  const slippageBps = BigInt(Math.max(0, Math.min(10000, Math.floor(slippagePercent * 100))));
  const minOut = (expectedAmountOut * (10000n - slippageBps)) / 10000n;
  return minOut;
}

/**
 * Assemble swap calldata for either standard PancakeSwap Router or custom proxy contract
 */
export function assembleSwapCalldata(
  params: TradeDispatchParams,
  currentTimestampSec: number = Math.floor(Date.now() / 1000)
): DispatchCalldataResult {
  const normTokenIn = getAddress(params.tokenIn);
  const normTokenOut = getAddress(params.tokenOut);
  const normRecipient = getAddress(params.recipient);
  const path: [Address, Address] = [normTokenIn, normTokenOut];

  const amountOutMin = calculateAmountOutMin(params.expectedAmountOut, params.slippagePercent);
  const deadlineMinutes = params.deadlineMinutes ?? 20;
  const deadline = BigInt(currentTimestampSec + deadlineMinutes * 60);

  // Check if custom proxy is enabled
  if (params.customProxy?.enabled && params.customProxy.contractAddress) {
    const proxyAddress = getAddress(params.customProxy.contractAddress);
    const methodName = params.customProxy.methodName?.trim() || "swapExactTokensForTokens";

    // Build dynamic or standard proxy ABI
    const proxyAbi = parseAbi([
      `function ${methodName}(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)` as const,
    ]);

    const data = encodeFunctionData({
      abi: proxyAbi,
      functionName: methodName as any,
      args: [params.amountIn, amountOutMin, path, normRecipient, deadline],
    });

    return {
      target: proxyAddress,
      data,
      amountIn: params.amountIn,
      amountOutMin,
      deadline,
      path,
    };
  }

  // Standard PancakeSwap Router
  const router = params.routerAddress
    ? getAddress(params.routerAddress)
    : CONTRACT_ADDRESSES.PANCAKE_ROUTER;

  const data = encodeFunctionData({
    abi: PANCAKE_ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [params.amountIn, amountOutMin, path, normRecipient, deadline],
  });

  return {
    target: router,
    data,
    amountIn: params.amountIn,
    amountOutMin,
    deadline,
    path,
  };
}

/**
 * Dispatch Swap transaction using external Web3 wallet
 */
export async function dispatchSwapTransaction(
  provider: EIP1193Provider,
  params: TradeDispatchParams
): Promise<DispatchedTradeResult> {
  const normRecipient = getAddress(params.recipient);
  const calldataResult = assembleSwapCalldata(params);

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: normRecipient,
        to: calldataResult.target,
        data: calldataResult.data,
      },
    ],
  })) as `0x${string}`;

  const isCustomProxy = !!(
    params.customProxy?.enabled && params.customProxy.contractAddress
  );

  return {
    txHash,
    amountIn: calldataResult.amountIn,
    amountOutMin: calldataResult.amountOutMin,
    targetContract: calldataResult.target,
    isCustomProxy,
  };
}

/**
 * Poll for transaction receipt with configurable timeout and interval
 */
export async function waitForTransactionReceipt(
  txHash: `0x${string}`,
  timeoutMs: number = 60000,
  pollIntervalMs: number = 2000
): Promise<TransactionReceiptResult> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const receipt = await requestJsonRpc<any | null>(
        "eth_getTransactionReceipt",
        [txHash]
      );

      if (receipt && receipt.blockNumber) {
        const statusHex = receipt.status;
        const isSuccess =
          statusHex === "0x1" || statusHex === 1 || statusHex === "0x01";

        return {
          transactionHash: txHash,
          blockNumber: BigInt(receipt.blockNumber),
          status: isSuccess ? "success" : "reverted",
          gasUsed: BigInt(receipt.gasUsed || "0"),
        };
      }
    } catch {
      // Continue polling on transient RPC failures
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`交易 ${txHash} 确认超时 (超过 ${Math.round(timeoutMs / 1000)} 秒)`);
}
