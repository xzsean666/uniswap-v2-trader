import {
  encodeFunctionData,
  getAddress,
  parseAbi,
  type Address,
} from "viem";
import { multicallRead } from "../evm/multicall";
import type { EIP1193Provider } from "../wallet/ethereum";

/**
 * UniswapV2ProxyTrader Contract ABI definition
 */
export const UNISWAP_V2_PROXY_TRADER_ABI = parseAbi([
  "function router() view returns (address)",
  "function keepers(address user) view returns (address)",
  "function setKeeper(address keeper) external",
  "function removeKeeper() external",
  "function executeSwap(address user, address[] calldata path, uint256 amountIn, uint256 amountOutMin, uint256 deadline) external returns (uint256[] memory amounts)",
  "function executeSwapSupportingFeeOnTransferTokens(address user, address[] calldata path, uint256 amountIn, uint256 amountOutMin, uint256 deadline) external returns (uint256 actualAmountOut)",
  "event KeeperUpdated(address indexed user, address indexed oldKeeper, address indexed newKeeper)",
  "event KeeperRemoved(address indexed user, address indexed oldKeeper)",
  "event SwapExecuted(address indexed user, address indexed keeper, address indexed tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)",
]);

/**
 * Known default deployed ProxyTrader contract addresses per Chain ID
 */
export const DEFAULT_PROXY_TRADER_ADDRESSES: Record<number, Address> = {
  // Hardhat local node default deterministic deployment
  31337: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  // BSC Testnet deployed proxy trader
  97: "0x3c43ac2680e9a4fc387a31ea47f9a88eee8b1b13" as Address,
};

/**
 * Resolve effective ProxyTrader contract address
 */
export function resolveProxyTraderAddress(
  chainId: number = 97,
  customAddress?: string
): Address | null {
  if (customAddress && customAddress.trim()) {
    try {
      return getAddress(customAddress.trim());
    } catch {
      // invalid address format, fallback to default
    }
  }
  return DEFAULT_PROXY_TRADER_ADDRESSES[chainId] || null;
}

/**
 * Query bound Keeper address for a specific user from the ProxyTrader contract
 */
export async function getBoundKeeper(
  proxyAddress: Address,
  userAddress: Address
): Promise<Address | null> {
  const normProxy = getAddress(proxyAddress);
  const normUser = getAddress(userAddress);

  const results = await multicallRead([
    {
      target: normProxy,
      abi: UNISWAP_V2_PROXY_TRADER_ABI,
      functionName: "keepers",
      args: [normUser],
    },
  ]);

  if (!results[0].success || !results[0].result) {
    return null;
  }

  const boundKeeper = results[0].result as Address;
  if (
    !boundKeeper ||
    boundKeeper === "0x0000000000000000000000000000000000000000"
  ) {
    return null;
  }

  return getAddress(boundKeeper);
}

/**
 * Encode calldata for user setting keeper on ProxyTrader
 */
export function encodeSetKeeperData(keeperAddress: Address): `0x${string}` {
  return encodeFunctionData({
    abi: UNISWAP_V2_PROXY_TRADER_ABI,
    functionName: "setKeeper",
    args: [getAddress(keeperAddress)],
  });
}

/**
 * Encode calldata for user removing keeper on ProxyTrader
 */
export function encodeRemoveKeeperData(): `0x${string}` {
  return encodeFunctionData({
    abi: UNISWAP_V2_PROXY_TRADER_ABI,
    functionName: "removeKeeper",
    args: [],
  });
}

/**
 * Send setKeeper transaction via user's external Web3 wallet (Master Wallet)
 */
export async function sendSetKeeperTransaction(
  provider: EIP1193Provider,
  userAddress: Address,
  proxyAddress: Address,
  keeperAddress: Address
): Promise<`0x${string}`> {
  const data = encodeSetKeeperData(keeperAddress);

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: getAddress(userAddress),
        to: getAddress(proxyAddress),
        data,
      },
    ],
  })) as `0x${string}`;

  return txHash;
}

/**
 * Send removeKeeper transaction via user's external Web3 wallet (Master Wallet)
 */
export async function sendRemoveKeeperTransaction(
  provider: EIP1193Provider,
  userAddress: Address,
  proxyAddress: Address
): Promise<`0x${string}`> {
  const data = encodeRemoveKeeperData();

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: getAddress(userAddress),
        to: getAddress(proxyAddress),
        data,
      },
    ],
  })) as `0x${string}`;

  return txHash;
}
