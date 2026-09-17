import { isAddress, getAddress, formatUnits, type Address } from "viem";
import { PANCAKE_PAIR_ABI, ERC20_ABI } from "../../abi/pancake";
import { multicallRead } from "../../evm/multicall";

export interface TokenMeta {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  reserveRaw: bigint;
  reserveFormatted: string;
}

export interface PairOverview {
  pairAddress: Address;
  token0: TokenMeta;
  token1: TokenMeta;
  blockTimestampLast: number;
  price0Per1: number; // Token0 per 1 Token1 (e.g. ACP per USDT)
  price1Per0: number; // Token1 per 1 Token0 (e.g. USDT per ACP)
  price0Per1Formatted: string;
  price1Per0Formatted: string;
}

export function validatePairAddress(address: string): {
  valid: boolean;
  error?: string;
  checksummed?: Address;
} {
  if (!address || typeof address !== "string") {
    return { valid: false, error: "请输入币对合约地址" };
  }
  const trimmed = address.trim();
  if (!isAddress(trimmed)) {
    return { valid: false, error: "不是有效的 EVM 合约地址格式 (0x...)" };
  }
  return { valid: true, checksummed: getAddress(trimmed) };
}

/**
 * Calculate token ratios and normalized exchange rates safely
 */
export function calculatePrices(
  reserve0: bigint,
  decimals0: number,
  reserve1: bigint,
  decimals1: number
): {
  price0Per1: number;
  price1Per0: number;
  price0Per1Formatted: string;
  price1Per0Formatted: string;
} {
  if (reserve0 === 0n || reserve1 === 0n) {
    return {
      price0Per1: 0,
      price1Per0: 0,
      price0Per1Formatted: "0",
      price1Per0Formatted: "0",
    };
  }

  const r0 = parseFloat(formatUnits(reserve0, decimals0));
  const r1 = parseFloat(formatUnits(reserve1, decimals1));

  if (r0 <= 0 || r1 <= 0) {
    return {
      price0Per1: 0,
      price1Per0: 0,
      price0Per1Formatted: "0",
      price1Per0Formatted: "0",
    };
  }

  const price0Per1 = r0 / r1; // How many Token0 for 1 Token1
  const price1Per0 = r1 / r0; // How many Token1 for 1 Token0

  const formatPrice = (val: number): string => {
    if (val === 0 || !Number.isFinite(val)) return "0";
    if (val >= 100) return val.toFixed(2);
    if (val >= 1) return val.toFixed(4);
    if (val >= 0.0001) return val.toFixed(6);
    return val.toExponential(4);
  };

  return {
    price0Per1,
    price1Per0,
    price0Per1Formatted: formatPrice(price0Per1),
    price1Per0Formatted: formatPrice(price1Per0),
  };
}

// Token metadata memory cache to minimize redundant RPC lookups
const tokenMetaCache = new Map<
  string,
  { symbol: string; name: string; decimals: number }
>();

export function clearTokenMetaCache(): void {
  tokenMetaCache.clear();
}

/**
 * Fetch token metadata (symbol, name, decimals) using Multicall3
 */
export async function fetchTokensMetadata(
  tokenAddresses: Address[]
): Promise<Map<string, { symbol: string; name: string; decimals: number }>> {
  const result = new Map<string, { symbol: string; name: string; decimals: number }>();
  const needed: Address[] = [];

  for (const addr of tokenAddresses) {
    const cached = tokenMetaCache.get(addr.toLowerCase());
    if (cached) {
      result.set(addr.toLowerCase(), cached);
    } else {
      needed.push(addr);
    }
  }

  if (needed.length > 0) {
    const calls = needed.flatMap((addr) => [
      { target: addr, abi: ERC20_ABI, functionName: "symbol" },
      { target: addr, abi: ERC20_ABI, functionName: "name" },
      { target: addr, abi: ERC20_ABI, functionName: "decimals" },
    ]);

    const multicallResults = await multicallRead(calls);

    for (let i = 0; i < needed.length; i++) {
      const addr = needed[i];
      const symbolRes = multicallResults[i * 3];
      const nameRes = multicallResults[i * 3 + 1];
      const decimalsRes = multicallResults[i * 3 + 2];

      const symbol = symbolRes.success ? (symbolRes.result as string) : "TOKEN";
      const name = nameRes.success ? (nameRes.result as string) : "Token";
      const decimals = decimalsRes.success ? Number(decimalsRes.result) : 18;

      const meta = { symbol, name, decimals };
      tokenMetaCache.set(addr.toLowerCase(), meta);
      result.set(addr.toLowerCase(), meta);
    }
  }

  return result;
}

/**
 * Fetch full LP Pair overview with reserves and token metadata via Multicall3
 */
export async function fetchPairOverview(pairAddress: Address): Promise<PairOverview> {
  const checksummedPair = getAddress(pairAddress);

  // 1. Multicall3 for token0, token1, and getReserves
  const pairCallResults = await multicallRead([
    { target: checksummedPair, abi: PANCAKE_PAIR_ABI, functionName: "token0" },
    { target: checksummedPair, abi: PANCAKE_PAIR_ABI, functionName: "token1" },
    { target: checksummedPair, abi: PANCAKE_PAIR_ABI, functionName: "getReserves" },
  ]);

  const token0Res = pairCallResults[0];
  const token1Res = pairCallResults[1];
  const reservesRes = pairCallResults[2];

  if (!token0Res.success || !token1Res.success || !reservesRes.success) {
    throw new Error(
      `无法从地址 ${checksummedPair} 读取 Uniswap/PancakeSwap V2 Pair 数据，请检查地址是否为合法 LP 币对。`
    );
  }

  const token0Address = getAddress(token0Res.result as string);
  const token1Address = getAddress(token1Res.result as string);
  const [reserve0Raw, reserve1Raw, blockTimestampLast] = reservesRes.result as [
    bigint,
    bigint,
    number,
  ];

  // 2. Fetch metadata for token0 & token1
  const metaMap = await fetchTokensMetadata([token0Address, token1Address]);
  const token0Meta = metaMap.get(token0Address.toLowerCase()) ?? {
    symbol: "TOKEN0",
    name: "Token 0",
    decimals: 18,
  };
  const token1Meta = metaMap.get(token1Address.toLowerCase()) ?? {
    symbol: "TOKEN1",
    name: "Token 1",
    decimals: 18,
  };

  const prices = calculatePrices(
    reserve0Raw,
    token0Meta.decimals,
    reserve1Raw,
    token1Meta.decimals
  );

  return {
    pairAddress: checksummedPair,
    token0: {
      address: token0Address,
      symbol: token0Meta.symbol,
      name: token0Meta.name,
      decimals: token0Meta.decimals,
      reserveRaw: reserve0Raw,
      reserveFormatted: formatUnits(reserve0Raw, token0Meta.decimals),
    },
    token1: {
      address: token1Address,
      symbol: token1Meta.symbol,
      name: token1Meta.name,
      decimals: token1Meta.decimals,
      reserveRaw: reserve1Raw,
      reserveFormatted: formatUnits(reserve1Raw, token1Meta.decimals),
    },
    blockTimestampLast,
    ...prices,
  };
}
