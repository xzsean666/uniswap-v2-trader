/**
 * BSC Testnet Network Parameters & EIP-1193 Ethereum Provider Helpers
 */

export const BSC_TESTNET_CHAIN_ID = 97;
export const BSC_TESTNET_CHAIN_ID_HEX = "0x61"; // 97 in hex

export const BSC_TESTNET_CONFIG = {
  chainId: BSC_TESTNET_CHAIN_ID_HEX,
  chainName: "Binance Smart Chain Testnet",
  nativeCurrency: {
    name: "tBNB",
    symbol: "tBNB",
    decimals: 18,
  },
  rpcUrls: [
    "https://bsc-testnet-rpc.publicnode.com",
    "https://bsc-testnet.drpc.org",
  ],
  blockExplorerUrls: ["https://testnet.bscscan.com"],
};

export interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

/**
 * Format a hexadecimal or decimal string/number chain ID to decimal number.
 */
export function parseChainId(chainId: string | number): number {
  if (typeof chainId === "number") return chainId;
  if (typeof chainId === "string") {
    if (chainId.startsWith("0x") || chainId.startsWith("0X")) {
      return parseInt(chainId, 16);
    }
    return parseInt(chainId, 10);
  }
  return 0;
}

/**
 * Format an Ethereum address for UI display (e.g. 0x8Fd3...4A2b)
 */
export function formatAddress(address: string | null | undefined): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Detect the injected Ethereum provider in the window object
 */
export function getInjectedProvider(): EIP1193Provider | null {
  if (typeof window === "undefined") return null;
  const ethereum = (window as unknown as { ethereum?: EIP1193Provider }).ethereum;
  return ethereum || null;
}

/**
 * Request account access from the injected provider
 */
export async function requestAccounts(provider: EIP1193Provider): Promise<string[]> {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  return accounts.map((acc) => acc.toLowerCase());
}

/**
 * Request current chainId from the injected provider
 */
export async function getProviderChainId(provider: EIP1193Provider): Promise<number> {
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  return parseChainId(chainId);
}

/**
 * Switch to BSC Testnet (chain ID 97). If not added yet, attempt to add it.
 */
export async function switchToBscTestnet(provider: EIP1193Provider): Promise<void> {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BSC_TESTNET_CHAIN_ID_HEX }],
    });
  } catch (switchError: any) {
    // Error 4902 indicates that the chain has not been added to MetaMask
    if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [BSC_TESTNET_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
}
