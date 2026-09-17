import {
  createWalletClient,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet, hardhat } from "viem/chains";
import { UNISWAP_V2_PROXY_TRADER_ABI } from "../../contracts/proxy-trader";
import { calculateAmountOutMin, waitForTransactionReceipt, type TransactionReceiptResult } from "./trade-dispatcher";
import { BSC_TESTNET_RPCS } from "../../constants/contracts";
import { fetchKeeperGasBalance } from "./keeper-manager";

export interface KeeperExecutionParams {
  keeperPrivateKey: Hex;
  proxyAddress: Address;
  userAddress: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  expectedAmountOut: bigint;
  slippagePercent: number;
  deadlineMinutes?: number;
  isFeeOnTransfer?: boolean;
  chainId?: number;
  rpcUrl?: string;
  currentTimestampSec?: number;
  walletClient?: any;
}

export interface KeeperExecutionResult {
  txHash: Hex;
  keeperAddress: Address;
  proxyAddress: Address;
  userAddress: Address;
  amountIn: bigint;
  amountOutMin: bigint;
  methodName: "executeSwap" | "executeSwapSupportingFeeOnTransferTokens";
  timestamp: number;
}

/**
 * Execute silent automated swap using local Keeper EOA without wallet popups
 */
export async function executeKeeperSwap(
  params: KeeperExecutionParams
): Promise<KeeperExecutionResult> {
  const account = privateKeyToAccount(params.keeperPrivateKey);
  const keeperAddress = getAddress(account.address);
  const normUser = getAddress(params.userAddress);
  const normProxy = getAddress(params.proxyAddress);
  const normTokenIn = getAddress(params.tokenIn);
  const normTokenOut = getAddress(params.tokenOut);

  if (params.amountIn <= 0n) {
    throw new Error("交易输入金额必须大于 0");
  }

  const targetChainId = params.chainId ?? 97;
  const chain = targetChainId === 31337 ? hardhat : bscTestnet;
  const defaultRpc = targetChainId === 31337 ? "http://127.0.0.1:8545" : BSC_TESTNET_RPCS[0];
  const rpcUrl = params.rpcUrl || defaultRpc;

  // Pre-flight Gas reserve check
  const gasInfo = await fetchKeeperGasBalance(keeperAddress, rpcUrl);
  if (gasInfo.balanceWei === 0n) {
    throw new Error(`打工小号 ${keeperAddress} Gas 余额为 0，请先充值 BNB 燃料`);
  }

  const path: [Address, Address] = [normTokenIn, normTokenOut];
  const amountOutMin = calculateAmountOutMin(
    params.expectedAmountOut,
    params.slippagePercent
  );

  const nowSec = params.currentTimestampSec ?? Math.floor(Date.now() / 1000);
  const deadlineMinutes = params.deadlineMinutes ?? 20;
  const deadline = BigInt(nowSec + deadlineMinutes * 60);

  const client =
    params.walletClient ||
    createWalletClient({
      account,
      chain,
      transport: http(rpcUrl),
    });

  const methodName = params.isFeeOnTransfer
    ? "executeSwapSupportingFeeOnTransferTokens"
    : "executeSwap";

  const txHash = await client.writeContract({
    address: normProxy,
    abi: UNISWAP_V2_PROXY_TRADER_ABI,
    functionName: methodName,
    args: [normUser, path, params.amountIn, amountOutMin, deadline],
  });

  return {
    txHash,
    keeperAddress,
    proxyAddress: normProxy,
    userAddress: normUser,
    amountIn: params.amountIn,
    amountOutMin,
    methodName,
    timestamp: Date.now(),
  };
}

export { waitForTransactionReceipt, type TransactionReceiptResult };
