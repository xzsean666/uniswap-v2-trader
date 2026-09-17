import {
  formatEther,
  getAddress,
  isHex,
  parseEther,
  type Address,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { requestJsonRpc } from "../../evm/rpc-client";
import type { EIP1193Provider } from "../../wallet/ethereum";

export const KEEPER_STORAGE_KEY = "uniswap_v2_trader_keeper_v1";
export const LOW_GAS_THRESHOLD_BNB = 0.003;
export const LOW_GAS_THRESHOLD_WEI = parseEther("0.003");

export interface StoredKeeperData {
  privateKey: Hex;
  address: Address;
  createdAt: number;
}

export interface KeeperBalanceInfo {
  balanceWei: bigint;
  formatted: string;
  isLowGas: boolean;
}

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const memoryStorageFallback = new MemoryStorage();

export function getKeeperStorage(): Storage | MemoryStorage {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // fallback
  }
  return memoryStorageFallback;
}

/**
 * Validate and normalize a private key string
 */
export function normalizePrivateKey(rawKey: string): Hex {
  const trimmed = rawKey.trim();
  const hexKey = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  if (!isHex(hexKey) || hexKey.length !== 66) {
    throw new Error("无效的以太坊私钥格式，必须为 64 位十六进制字符 (带 0x 长度为 66)");
  }
  if (/^0x0{64}$/i.test(hexKey)) {
    throw new Error("不能使用全零的无效私钥");
  }
  return hexKey.toLowerCase() as Hex;
}

/**
 * Retrieve existing Keeper wallet from local browser storage
 */
export function getStoredKeeperWallet(): StoredKeeperData | null {
  try {
    const storage = getKeeperStorage();
    const raw = storage.getItem(KEEPER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredKeeperData;
    if (!data.privateKey || !data.address) return null;

    // Verify consistency
    const account = privateKeyToAccount(data.privateKey);
    if (getAddress(account.address) !== getAddress(data.address)) {
      return null;
    }

    return {
      privateKey: data.privateKey,
      address: getAddress(data.address),
      createdAt: data.createdAt || Date.now(),
    };
  } catch {
    return null;
  }
}

/**
 * Generate a new dedicated local Keeper wallet EOA
 */
export function generateKeeperWallet(): StoredKeeperData {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const data: StoredKeeperData = {
    privateKey,
    address: getAddress(account.address),
    createdAt: Date.now(),
  };
  getKeeperStorage().setItem(KEEPER_STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Import an existing Keeper wallet from private key
 */
export function importKeeperWallet(rawKey: string): StoredKeeperData {
  const privateKey = normalizePrivateKey(rawKey);
  const account = privateKeyToAccount(privateKey);
  const data: StoredKeeperData = {
    privateKey,
    address: getAddress(account.address),
    createdAt: Date.now(),
  };
  getKeeperStorage().setItem(KEEPER_STORAGE_KEY, JSON.stringify(data));
  return data;
}

/**
 * Clear stored Keeper wallet with zero-fill memory sanitization
 */
export function clearKeeperWallet(): void {
  try {
    const storage = getKeeperStorage();
    storage.setItem(KEEPER_STORAGE_KEY, "0".repeat(66));
    storage.removeItem(KEEPER_STORAGE_KEY);
  } catch {
    // Fallback if storage access fails
  }
}

/**
 * Fetch native Gas (BNB/ETH) balance of Keeper account
 */
export async function fetchKeeperGasBalance(
  keeperAddress: Address,
  rpcUrl?: string
): Promise<KeeperBalanceInfo> {
  const normAddress = getAddress(keeperAddress);
  let hexBalance: string;

  if (rpcUrl) {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getBalance",
        params: [normAddress, "latest"],
      }),
    });
    const json = await res.json();
    hexBalance = json.result || "0x0";
  } else {
    hexBalance = await requestJsonRpc<string>("eth_getBalance", [
      normAddress,
      "latest",
    ]);
  }

  const balanceWei = BigInt(hexBalance || "0x0");
  const formatted = Number(formatEther(balanceWei)).toFixed(4);
  const isLowGas = balanceWei < LOW_GAS_THRESHOLD_WEI;

  return {
    balanceWei,
    formatted,
    isLowGas,
  };
}

/**
 * Prompt Master Wallet to transfer native Gas (BNB/ETH) to Keeper account
 */
export async function fundKeeperGas(
  provider: EIP1193Provider,
  fromUser: Address,
  keeperAddress: Address,
  amountEther: string = "0.01"
): Promise<`0x${string}`> {
  const normFrom = getAddress(fromUser);
  const normTo = getAddress(keeperAddress);
  const valueWei = parseEther(amountEther);

  const txHash = (await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from: normFrom,
        to: normTo,
        value: `0x${valueWei.toString(16)}`,
      },
    ],
  })) as `0x${string}`;

  return txHash;
}
