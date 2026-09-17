import { verifyMessage, type Address } from "viem";

export interface AuthSession {
  address: `0x${string}`;
  signature: `0x${string}`;
  message: string;
  timestamp: number;
  nonce: string;
}

const AUTH_SESSION_STORAGE_KEY = "uniswap_v2_trader_auth_session";

/**
 * Generate a cryptographically random nonce string.
 */
export function generateNonce(length = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return result;
}

/**
 * Build standard EIP-191 sign-in challenge message
 */
export function buildSignInMessage(params: {
  address: string;
  chainId: number;
  nonce: string;
  timestamp: number;
  domain?: string;
}): string {
  const domain = params.domain || (typeof window !== "undefined" ? window.location.host : "uniswap-v2-trader");
  const isoTime = new Date(params.timestamp).toISOString();

  return [
    `${domain} 想要使用您的 Web3 账户登录:`,
    params.address,
    "",
    "这是一个纯客户端免密签名登录请求，不会产生任何 Gas 费用。",
    "",
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${isoTime}`,
  ].join("\n");
}

/**
 * Request EIP-191 personal_sign from injected provider
 */
export async function signLoginMessage(
  provider: { request: (args: { method: string; params: unknown[] }) => Promise<unknown> },
  address: string,
  message: string
): Promise<`0x${string}`> {
  const signature = (await provider.request({
    method: "personal_sign",
    params: [message, address],
  })) as `0x${string}`;
  return signature;
}

/**
 * Verify an EIP-191 signature locally using viem
 */
export async function verifySignature(params: {
  address: `0x${string}`;
  message: string;
  signature: `0x${string}`;
}): Promise<boolean> {
  try {
    const isValid = await verifyMessage({
      address: params.address as Address,
      message: params.message,
      signature: params.signature,
    });
    return isValid;
  } catch (err) {
    console.error("Signature verification failed:", err);
    return false;
  }
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

function getStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    if (typeof globalThis !== "undefined" && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage;
    }
  } catch {
    // Restricted or unavailable
  }
  return memoryStorageFallback;
}

/**
 * Save auth session to local storage
 */
export function saveAuthSession(session: AuthSession): void {
  const storage = getStorage();
  storage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Load auth session from local storage
 */
export function loadAuthSession(): AuthSession | null {
  try {
    const storage = getStorage();
    const raw = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

/**
 * Clear auth session from local storage
 */
export function clearAuthSession(): void {
  const storage = getStorage();
  storage.removeItem(AUTH_SESSION_STORAGE_KEY);
}

