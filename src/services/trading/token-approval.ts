import {
  encodeFunctionData,
  getAddress,
  maxUint256,
  type Address,
} from "viem";
import { ERC20_ABI } from "../../abi/pancake";
import { multicallRead } from "../../evm/multicall";
import type { EIP1193Provider } from "../../wallet/ethereum";

export interface ApprovalStatus {
  hasSufficientAllowance: boolean;
  currentAllowance: bigint;
  requiredAmount: bigint;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Check allowance of an ERC-20 token for a spender via Multicall
 */
export async function checkAllowance(
  owner: Address,
  spender: Address,
  tokenAddress: Address
): Promise<bigint> {
  const normOwner = getAddress(owner);
  const normSpender = getAddress(spender);
  const normToken = getAddress(tokenAddress);

  if (normSpender === ZERO_ADDRESS) {
    throw new Error("授权目标 (Spender) 不能为零地址");
  }

  const results = await multicallRead([
    {
      target: normToken,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [normOwner, normSpender],
    },
  ]);

  if (!results[0].success || results[0].result === undefined) {
    throw new Error(`查询代币 ${normToken} 授权额度失败`);
  }

  return results[0].result as bigint;
}

/**
 * Check if current allowance is sufficient for the trade amount
 */
export async function verifyAllowanceStatus(
  owner: Address,
  spender: Address,
  tokenAddress: Address,
  requiredAmount: bigint
): Promise<ApprovalStatus> {
  const currentAllowance = await checkAllowance(owner, spender, tokenAddress);
  return {
    hasSufficientAllowance: currentAllowance >= requiredAmount,
    currentAllowance,
    requiredAmount,
  };
}

/**
 * Send an ERC-20 approve transaction through user's external Web3 wallet provider
 */
export async function approveToken(
  provider: EIP1193Provider,
  owner: Address,
  spender: Address,
  tokenAddress: Address,
  amount: bigint = maxUint256
): Promise<`0x${string}`> {
  const normOwner = getAddress(owner);
  const normSpender = getAddress(spender);
  const normToken = getAddress(tokenAddress);

  if (normSpender === ZERO_ADDRESS) {
    throw new Error("授权目标 (Spender) 不能为零地址");
  }

  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [normSpender, amount],
  });

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: normOwner,
        to: normToken,
        data,
      },
    ],
  })) as `0x${string}`;

  return txHash;
}

/**
 * Check allowance and prompt approve transaction if needed
 */
export async function checkAndApprove(
  provider: EIP1193Provider,
  owner: Address,
  spender: Address,
  tokenAddress: Address,
  requiredAmount: bigint
): Promise<{ approved: boolean; txHash?: `0x${string}` }> {
  const status = await verifyAllowanceStatus(owner, spender, tokenAddress, requiredAmount);
  if (status.hasSufficientAllowance) {
    return { approved: true };
  }

  const txHash = await approveToken(provider, owner, spender, tokenAddress, maxUint256);
  return {
    approved: false, // Transaction pending confirmation
    txHash,
  };
}
