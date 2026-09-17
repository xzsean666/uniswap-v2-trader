import { parseAbi } from "viem";

/**
 * BSC Testnet (Chapel, Chain ID: 97) Contract Addresses
 */
export const BSC_TESTNET_CHAIN_ID = 97;

export const CONTRACT_ADDRESSES = {
  // Multicall3 deployed on BSC Testnet
  MULTICALL3: "0xca11bde05977b3631167028862be2a173976ca11" as `0x${string}`,

  // PancakeSwap V2 Factory on BSC Testnet
  PANCAKE_FACTORY: "0x6725F303b657a9451d8BA641348b6761A6CC7a17" as `0x${string}`,

  // PancakeSwap V2 Router on BSC Testnet
  PANCAKE_ROUTER: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1" as `0x${string}`,

  // Wrapped BNB (WBNB) on BSC Testnet
  WBNB: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd" as `0x${string}`,
} as const;

export const BSC_TESTNET_RPCS = [
  "https://bsc-testnet-rpc.publicnode.com",
  "https://bsc-testnet.drpc.org",
] as const;

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
