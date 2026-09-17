import {
  createEvmCallClient,
  type EvmCallClient,
} from "@evm-event-lake/node-sdk/evm-call";
import {
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_RPCS,
  CONTRACT_ADDRESSES,
} from "../constants/contracts";
import { MemoryStorageAdapter } from "./memory-storage";

let clientInstance: EvmCallClient | null = null;
let currentRpcIndex = 0;

/**
 * Get or create the shared EvmCallClient configured for BSC Testnet.
 */
export async function getEvmCallClient(): Promise<EvmCallClient> {
  if (clientInstance) {
    return clientInstance;
  }

  const memoryStorage = new MemoryStorageAdapter();
  clientInstance = createEvmCallClient({
    chainId: BSC_TESTNET_CHAIN_ID,
    customRpcUrls: [...BSC_TESTNET_RPCS],
    multicall3Address: CONTRACT_ADDRESSES.MULTICALL3,
    storageAdapter: memoryStorage as any,
  });

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
    }
  }
}

/**
 * Send raw JSON-RPC request with automatic failover and retry across BSC Testnet RPC pool.
 */
export async function requestJsonRpc<T = unknown>(
  method: string,
  params: unknown[] = [],
  signal?: AbortSignal
): Promise<T> {
  let lastError: Error | null = null;
  const attempts = BSC_TESTNET_RPCS.length * 2;

  for (let i = 0; i < attempts; i++) {
    const rpcUrl = BSC_TESTNET_RPCS[currentRpcIndex % BSC_TESTNET_RPCS.length];
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
      lastError = err;
      // Switch to next RPC endpoint
      currentRpcIndex++;
    }
  }

  throw lastError ?? new Error("All RPC endpoints in pool failed");
}

/**
 * Fetch current block number from BSC Testnet
 */
export async function getLatestBlockNumber(): Promise<bigint> {
  const result = await requestJsonRpc<string>("eth_blockNumber");
  return BigInt(result);
}

/**
 * Send JSON-RPC batch request for native non-multicall batch queries
 */
export async function requestJsonRpcBatch<T = unknown>(
  requests: Array<{ method: string; params: unknown[] }>,
  signal?: AbortSignal
): Promise<T[]> {
  if (requests.length === 0) return [];

  let lastError: Error | null = null;
  const attempts = BSC_TESTNET_RPCS.length * 2;

  const payload = requests.map((req, index) => ({
    jsonrpc: "2.0",
    id: index + 1,
    method: req.method,
    params: req.params,
  }));

  for (let i = 0; i < attempts; i++) {
    const rpcUrl = BSC_TESTNET_RPCS[currentRpcIndex % BSC_TESTNET_RPCS.length];
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
      lastError = err;
      currentRpcIndex++;
    }
  }

  throw lastError ?? new Error("All RPC endpoints in pool failed for batch request");
}
