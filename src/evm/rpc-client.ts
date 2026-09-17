import {
  createEvmCallClient,
  type EvmCallClient,
} from "@evm-event-lake/node-sdk/evm-call";
import {
  BSC_TESTNET_CHAIN_ID,
  CONTRACT_ADDRESSES,
  getStandardRpcUrlsForChain,
} from "../constants/contracts";
import { MemoryStorageAdapter } from "./memory-storage";
import { RpcPoolManager } from "../services/rpc/rpc-pool-manager";

let clientInstance: EvmCallClient | null = null;
let currentClientChainId: number | null = null;
let activeChainId: number = BSC_TESTNET_CHAIN_ID;
let currentRpcIndex = 0;

// Listen for dynamic RPC pool modifications and reset EvmCallClient to inject updated endpoints
RpcPoolManager.onPoolChange((changedChainId) => {
  if (currentClientChainId === null || currentClientChainId === changedChainId) {
    closeEvmCallClient();
  }
});

/**
 * Set the currently active chain ID for default RPC routing
 */
export function setActiveChainId(chainId: number): void {
  if (activeChainId !== chainId) {
    activeChainId = chainId;
    if (currentClientChainId !== chainId) {
      closeEvmCallClient();
    }
  }
}

/**
 * Get the currently active chain ID
 */
export function getActiveChainId(): number {
  return activeChainId;
}

/**
 * Get or create the shared EvmCallClient configured for target chain.
 */
export async function getEvmCallClient(chainId?: number): Promise<EvmCallClient> {
  const targetChainId = chainId ?? activeChainId;
  if (clientInstance && currentClientChainId === targetChainId) {
    return clientInstance;
  }

  if (clientInstance) {
    await closeEvmCallClient();
  }

  const rpcPool = [...getStandardRpcUrlsForChain(targetChainId)];
  const memoryStorage = new MemoryStorageAdapter();
  clientInstance = createEvmCallClient({
    chainId: targetChainId,
    customRpcUrls: rpcPool,
    multicall3Address: CONTRACT_ADDRESSES.MULTICALL3,
    storageAdapter: memoryStorage as any,
  });

  currentClientChainId = targetChainId;

  try {
    await clientInstance.init();
  } catch (err) {
    console.warn("EvmCallClient init warning:", err);
  }

  return clientInstance;
}

/**
 * Close EvmCallClient instance
 */
export async function closeEvmCallClient(): Promise<void> {
  if (clientInstance) {
    try {
      await clientInstance.close();
    } finally {
      clientInstance = null;
      currentClientChainId = null;
    }
  }
}

/**
 * Resolve target RPC list from explicit param or active chain
 */
function resolveRpcPool(customRpcUrlOrChainId?: string | number): readonly string[] {
  if (typeof customRpcUrlOrChainId === "string" && customRpcUrlOrChainId.length > 0) {
    return [customRpcUrlOrChainId];
  }
  if (typeof customRpcUrlOrChainId === "number") {
    return getStandardRpcUrlsForChain(customRpcUrlOrChainId);
  }
  return getStandardRpcUrlsForChain(activeChainId);
}

/**
 * Send raw JSON-RPC request with automatic failover and retry across target RPC pool.
 */
export async function requestJsonRpc<T = unknown>(
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal,
  customRpcUrlOrChainId?: string | number
): Promise<T> {
  let lastError: Error | null = null;
  const pool = resolveRpcPool(customRpcUrlOrChainId);
  const attempts = pool.length * 2;

  for (let i = 0; i < attempts; i++) {
    const rpcUrl = pool[currentRpcIndex % pool.length];
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now() + i,
          method,
          params,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} from ${rpcUrl}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(`RPC Error (${json.error.code}): ${json.error.message}`);
      }

      return json.result as T;
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      lastError = err;
      // Switch to next RPC endpoint
      currentRpcIndex++;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  throw lastError ?? new Error("All RPC endpoints in pool failed");
}

/**
 * Fetch current block number from active network
 */
export async function getLatestBlockNumber(
  chainId?: number,
  signal?: AbortSignal
): Promise<bigint> {
  const result = await requestJsonRpc<string>("eth_blockNumber", [], signal, chainId);
  return BigInt(result);
}

/**
 * Send JSON-RPC batch request for native non-multicall batch queries
 */
export async function requestJsonRpcBatch<T = unknown>(
  requests: Array<{ method: string; params: unknown[] }>,
  signal?: AbortSignal,
  customRpcUrlOrChainId?: string | number
): Promise<T[]> {
  if (requests.length === 0) return [];

  let lastError: Error | null = null;
  const pool = resolveRpcPool(customRpcUrlOrChainId);
  const attempts = pool.length * 2;

  const payload = requests.map((req, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: req.method,
    params: req.params,
  }));

  for (let i = 0; i < attempts; i++) {
    const rpcUrl = pool[currentRpcIndex % pool.length];
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status} from ${rpcUrl}`);
      }

      const jsonList = await response.json();
      if (!Array.isArray(jsonList)) {
        throw new Error("Invalid batch RPC response: expected array");
      }

      // Sort by id to guarantee ordering
      jsonList.sort((a, b) => Number(a.id) - Number(b.id));
      return jsonList.map((item) => {
        if (item.error) {
          throw new Error(`Batch RPC Error: ${item.error.message}`);
        }
        return item.result;
      });
    } catch (err: any) {
      if (signal?.aborted) {
        throw err;
      }
      lastError = err;
      currentRpcIndex++;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100 * (i + 1)));
      }
    }
  }

  throw lastError ?? new Error("All RPC endpoints in pool failed for batch request");
}
