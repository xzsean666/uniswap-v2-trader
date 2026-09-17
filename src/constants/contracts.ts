import { parseAbi } from "viem";

/**
 * BSC Testnet (Chapel, Chain ID: 97) Contract Addresses
 */
export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_MAINNET_CHAIN_ID = 56;

export const CONTRACT_ADDRESSES = {
  // Multicall3 deployed on BSC Testnet & Mainnet (same address)
  MULTICALL3: "0xca11bde05977b3631167028862be2a173976ca11" as `0x${string}`,

  // PancakeSwap V2 Factory
  PANCAKE_FACTORY_TESTNET: "0x6725F303b657a9451d8BA641348b6761A6CC7a17" as `0x${string}`,
  PANCAKE_FACTORY_MAINNET: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73" as `0x${string}`,
  PANCAKE_FACTORY: "0x6725F303b657a9451d8BA641348b6761A6CC7a17" as `0x${string}`,

  // PancakeSwap V2 Router
  PANCAKE_ROUTER_TESTNET: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as `0x${string}`,
  PANCAKE_ROUTER_MAINNET: "0x10ED43C718714eb63d5aA57B78B54704E256024E" as `0x${string}`,
  PANCAKE_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as `0x${string}`,

  // Wrapped BNB (WBNB)
  WBNB_TESTNET: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as `0x${string}`,
  WBNB_MAINNET: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as `0x${string}`,
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as `0x${string}`,
} as const;

export const BSC_TESTNET_RPCS = [
  "https://bsc-testnet-dataseed.bnbchain.org",
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.drpc.org",
] as const;

export const BSC_MAINNET_RPCS = [
  "https://bsc-dataseed.binance.org",
  "https://bsc-rpc.publicnode.com",
  "https://binance.llamarpc.com",
] as const;

export const LOCALHOST_RPCS = [
  "http://127.0.0.1:8545",
] as const;

/**
 * Retrieve high-availability RPC endpoint pool for given Chain ID
 */
export function getRpcUrlsForChain(chainId?: number): readonly string[] {
  if (chainId === 31337) {
    return LOCALHOST_RPCS;
  }
  if (chainId === 56) {
    return BSC_MAINNET_RPCS;
  }
  return BSC_TESTNET_RPCS;
}

export interface PresetPair {
  chainId: number;
  label: string;
  pairAddress: `0x${string}`;
  token0Symbol: string;
  token1Symbol: string;
  tag?: string;
}

export interface PresetToken {
  chainId: number;
  symbol: string;
  name: string;
  address: `0x${string}`;
}

export const PRESET_POPULAR_PAIRS: PresetPair[] = [
  // Testnet
  {
    chainId: 97,
    label: "ALPHA / BETA",
    pairAddress: "0xf03EBe5CD689FEdC9204aF66Cb3431750B89bc02",
    token0Symbol: "ALPHA",
    token1Symbol: "BETA",
    tag: "官方测试池",
  },
  // Mainnet
  {
    chainId: 56,
    label: "WBNB / USDT",
    pairAddress: "0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE",
    token0Symbol: "WBNB",
    token1Symbol: "USDT",
    tag: "Top 成交量",
  },
  {
    chainId: 56,
    label: "CAKE / WBNB",
    pairAddress: "0x0eD7e52944161450477ee417DE9Cd3a859b14fD0",
    token0Symbol: "CAKE",
    token1Symbol: "WBNB",
    tag: "Pancake 核心",
  },
  {
    chainId: 56,
    label: "BTCB / WBNB",
    pairAddress: "0x61EB789d75A95CAa563D9777Ba3bef0e65d992DE",
    token0Symbol: "BTCB",
    token1Symbol: "WBNB",
  },
  {
    chainId: 56,
    label: "ETH / WBNB",
    pairAddress: "0x74E4716E431f459c8c4CB78663d2617f08089bC8",
    token0Symbol: "ETH",
    token1Symbol: "WBNB",
  },
];

export const COMMON_TOKENS: PresetToken[] = [
  // Testnet
  { chainId: 97, symbol: "ALPHA", name: "Alpha Test Token", address: "0xd26cdc2d33bda34c07f01c459ab32a2bf4c9f441" },
  { chainId: 97, symbol: "BETA", name: "Beta Test Token", address: "0x7a939029997569074973b1ee95118d387f171863" },
  { chainId: 97, symbol: "WBNB", name: "Wrapped BNB", address: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" },
  // Mainnet
  { chainId: 56, symbol: "WBNB", name: "Wrapped BNB", address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" },
  { chainId: 56, symbol: "USDT", name: "Tether USD", address: "0x55d398326f99059fF775485246999027B3197955" },
  { chainId: 56, symbol: "CAKE", name: "PancakeSwap Token", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82" },
  { chainId: 56, symbol: "BTCB", name: "Binance-Peg BTC", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
  { chainId: 56, symbol: "ETH", name: "Binance-Peg ETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
];

/**
 * Standard ABIs using viem human-readable parseAbi
 */
export const MULTICALL3_ABI = parseAbi([
  "struct Call3 { address target; bool allowFailure; bytes callData; }",
  "struct Result { bool success; bytes returnData; }",
  "function aggregate3(Call3[] calls) payable returns (Result[] returnData)",
  "function getEthBalance(address addr) view returns (uint256 balance)",
  "function getBlockNumber() view returns (uint256)",
]);

export const PANCAKE_FACTORY_ABI = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address pair)",
  "function allPairs(uint256) view returns (address pair)",
  "function allPairsLength() view returns (uint256)",
]);

export const PANCAKE_PAIR_ABI = parseAbi([
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
  "function price0CumulativeLast() view returns (uint256)",
  "function price1CumulativeLast() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
]);

export const PANCAKE_ROUTER_ABI = parseAbi([
  "function factory() pure returns (address)",
  "function WETH() pure returns (address)",
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[] amounts)",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[] amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] calldata path, address to, uint256 deadline) payable returns (uint256[] amounts)",
  "function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] calldata path, address to, uint256 deadline) returns (uint256[] amounts)",
]);

export const ERC20_ABI = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
]);
