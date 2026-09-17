import { getAddress, isAddress, type Address } from "viem";
import {
  CONTRACT_ADDRESSES,
  PANCAKE_FACTORY_ABI,
  PRESET_POPULAR_PAIRS,
  COMMON_TOKENS,
  type PresetPair,
  type PresetToken,
} from "../../constants/contracts";
import { multicallRead } from "../../evm/multicall";
import { fetchPairOverview, type PairOverview } from "./pair-reader";

export interface ResolvePairResult {
  exists: boolean;
  pairAddress?: Address;
  overview?: PairOverview;
  error?: string;
}

/**
 * Get PancakeSwap V2 Factory address for target chain
 */
export function getPancakeFactoryAddress(chainId?: number): Address {
  if (chainId === 56) {
    return CONTRACT_ADDRESSES.PANCAKE_FACTORY_MAINNET;
  }
  return CONTRACT_ADDRESSES.PANCAKE_FACTORY_TESTNET;
}

/**
 * Filter preset popular pairs by chain ID (defaults to BSC Testnet 97)
 */
export function getPresetPairs(chainId?: number): PresetPair[] {
  const targetChain = chainId === 56 ? 56 : 97;
  return PRESET_POPULAR_PAIRS.filter((p) => p.chainId === targetChain);
}

/**
 * Filter common tokens by chain ID (defaults to BSC Testnet 97)
 */
export function getCommonTokens(chainId?: number): PresetToken[] {
  const targetChain = chainId === 56 ? 56 : 97;
  return COMMON_TOKENS.filter((t) => t.chainId === targetChain);
}

/**
 * Resolve LP pair address and overview from Token A and Token B addresses
 */
export async function resolvePairFromTokens(
  tokenA: string,
  tokenB: string,
  chainId?: number
): Promise<ResolvePairResult> {
  if (!isAddress(tokenA) || !isAddress(tokenB)) {
    return { exists: false, error: "输入的代币地址格式不正确" };
  }

  const addrA = getAddress(tokenA);
  const addrB = getAddress(tokenB);

  if (addrA.toLowerCase() === addrB.toLowerCase()) {
    return { exists: false, error: "代币 A 与代币 B 地址不能相同" };
  }

  const factoryAddress = getPancakeFactoryAddress(chainId);

  try {
    const results = await multicallRead<Address>([
      {
        target: factoryAddress,
        abi: PANCAKE_FACTORY_ABI,
        functionName: "getPair",
        args: [addrA, addrB],
      },
    ]);

    const callRes = results[0];
    if (!callRes || !callRes.success || !callRes.result) {
      return {
        exists: false,
        error: "查询 Factory 合约失败，请检查网络或代币地址",
      };
    }

    const pairAddress = callRes.result;
    const zeroAddress = "0x0000000000000000000000000000000000000000";

    if (!pairAddress || pairAddress.toLowerCase() === zeroAddress) {
      return {
        exists: false,
        error: "该代币对尚未在 PancakeSwap V2 创建流动性池",
      };
    }

    const checksummedPair = getAddress(pairAddress);
    const overview = await fetchPairOverview(checksummedPair);

    return {
      exists: true,
      pairAddress: checksummedPair,
      overview,
    };
  } catch (err: any) {
    return {
      exists: false,
      error: err?.message || "查询 Factory 合约失败，请检查网络或代币地址",
    };
  }
}
