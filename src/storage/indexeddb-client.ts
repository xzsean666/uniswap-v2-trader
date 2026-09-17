/**
 * Client IndexedDB Connection & Storage Infrastructure
 */

import type { SwapLogPayload } from "../services/sync/event-emitter";

export const DATABASE_NAME = "uniswap_v2_trader_app";
export const DATABASE_URL = "indexeddb://uniswap_v2_trader";
export const DB_VERSION = 2;

export const STORES = {
  PAIR_SUBSCRIPTIONS: "pair_subscriptions",
  CACHED_SWAP_EVENTS: "cached_swap_events",
} as const;

let dbInstance: IDBDatabase | null = null;

/**
 * Open or upgrade the client-side IndexedDB database
 */
export function openIndexedDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    // Support fake-indexeddb in Node/test environments or window.indexedDB in browsers
    const idbFactory: IDBFactory | undefined =
      typeof window !== "undefined" && window.indexedDB
        ? window.indexedDB
        : (globalThis as any).indexedDB;

    if (!idbFactory) {
      reject(new Error("IndexedDB is not supported in current environment."));
      return;
    }

    const request = idbFactory.open(DATABASE_NAME, DB_VERSION);

    request.onblocked = () => {
      console.warn("IndexedDB open request was blocked by another connection.");
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORES.PAIR_SUBSCRIPTIONS)) {
        const store = db.createObjectStore(STORES.PAIR_SUBSCRIPTIONS, {
          keyPath: "pairAddress",
        });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.CACHED_SWAP_EVENTS)) {
        db.createObjectStore(STORES.CACHED_SWAP_EVENTS, {
          keyPath: "pairAddress",
        });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Close database connection
 */
export function closeIndexedDB(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } finally {
      dbInstance = null;
    }
  }
}

/**
 * Extract database name from database URL (e.g. "indexeddb://uniswap_v2_trader" -> "uniswap_v2_trader")
 */
export function extractDatabaseName(databaseUrlOrName: string): string {
  if (databaseUrlOrName.startsWith("indexeddb://")) {
    return databaseUrlOrName.slice("indexeddb://".length);
  }
  if (databaseUrlOrName.startsWith("idb://")) {
    return databaseUrlOrName.slice("idb://".length);
  }
  return databaseUrlOrName;
}

/**
 * Check whether a target is already registered in EVMEventLake IndexedDB and retrieve its original startBlock.
 * This prevents TargetMetadataConflictError when reconnecting or re-indexing an existing pair.
 */
export async function getExistingLakeTargetStartBlock(
  databaseUrlOrName: string,
  chainId: number,
  contractAddress: string
): Promise<bigint | null> {
  const idbFactory: IDBFactory | undefined =
    typeof window !== "undefined" && window.indexedDB
      ? window.indexedDB
      : (globalThis as any).indexedDB;

  if (!idbFactory) return null;

  const dbName = extractDatabaseName(databaseUrlOrName);
  const targetKey = `${chainId}:${contractAddress.toLowerCase()}`;

  return new Promise<bigint | null>((resolve) => {
    try {
      const openReq = idbFactory.open(dbName);
      openReq.onerror = () => resolve(null);
      openReq.onupgradeneeded = (e) => {
        // If the DB was just being created or upgraded, lake_targets is not yet populated
        (e.target as IDBOpenDBRequest).transaction?.abort();
        resolve(null);
      };
      openReq.onsuccess = () => {
        const db = openReq.result;
        try {
          if (!db.objectStoreNames.contains("lake_targets")) {
            db.close();
            resolve(null);
            return;
          }
          const tx = db.transaction("lake_targets", "readonly");
          const store = tx.objectStore("lake_targets");
          const getReq = store.get(targetKey);
          getReq.onsuccess = () => {
            db.close();
            const record = getReq.result;
            if (record && record.startBlockKey) {
              resolve(BigInt(record.startBlockKey));
            } else {
              resolve(null);
            }
          };
          getReq.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch {
          db.close();
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

/**
 * Reset/Delete a specific lake target from EVMEventLake IndexedDB storage.
 * Used for auto-healing when metadata conflict or schema inconsistency occurs.
 */
export async function resetLakeTargetStorage(
  databaseUrlOrName: string,
  chainId: number,
  contractAddress: string
): Promise<void> {
  const idbFactory: IDBFactory | undefined =
    typeof window !== "undefined" && window.indexedDB
      ? window.indexedDB
      : (globalThis as any).indexedDB;

  if (!idbFactory) return;

  const dbName = extractDatabaseName(databaseUrlOrName);
  const targetKey = `${chainId}:${contractAddress.toLowerCase()}`;

  return new Promise<void>((resolve) => {
    try {
      const openReq = idbFactory.open(dbName);
      openReq.onerror = () => resolve();
      openReq.onsuccess = () => {
        const db = openReq.result;
        try {
          const storeNames = ["lake_targets", "sync_leases"].filter((name) =>
            db.objectStoreNames.contains(name)
          );
          if (storeNames.length === 0) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(storeNames, "readwrite");
          for (const name of storeNames) {
            try {
              tx.objectStore(name).delete(targetKey);
            } catch {
              // Ignore store-specific delete errors
            }
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            resolve();
          };
        } catch {
          db.close();
          resolve();
        }
      };
    } catch {
      resolve();
    }
  });
}

const LOCAL_STORAGE_CACHE_PREFIX = "uniswap_v2_pair_events_";

function getLocalStorageFallbackEvents(pairAddress: string): SwapLogPayload[] {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_CACHE_PREFIX}${pairAddress.toLowerCase()}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function setLocalStorageFallbackEvents(pairAddress: string, events: SwapLogPayload[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      `${LOCAL_STORAGE_CACHE_PREFIX}${pairAddress.toLowerCase()}`,
      JSON.stringify(events.slice(0, 50))
    );
  } catch {
    // Ignore quota errors
  }
}

/**
 * Retrieve cached swap events from IndexedDB (with localStorage fallback)
 */
export async function getCachedPairEvents(pairAddress: string): Promise<SwapLogPayload[]> {
  const fallback = getLocalStorageFallbackEvents(pairAddress);
  try {
    const db = await openIndexedDB();
    if (!db.objectStoreNames.contains(STORES.CACHED_SWAP_EVENTS)) {
      return fallback;
    }
    return new Promise<SwapLogPayload[]>((resolve) => {
      const tx = db.transaction(STORES.CACHED_SWAP_EVENTS, "readonly");
      const store = tx.objectStore(STORES.CACHED_SWAP_EVENTS);
      const req = store.get(pairAddress.toLowerCase());
      req.onsuccess = () => {
        const stored = req.result?.events as SwapLogPayload[] | undefined;
        resolve(stored && stored.length > 0 ? stored : fallback);
      };
      req.onerror = () => {
        resolve(fallback);
      };
    });
  } catch {
    return fallback;
  }
}

/**
 * Save recent swap events into client cache
 */
export async function saveCachedPairEvents(
  pairAddress: string,
  events: SwapLogPayload[]
): Promise<void> {
  const key = pairAddress.toLowerCase();
  const trimmed = events.slice(0, 50);
  setLocalStorageFallbackEvents(key, trimmed);
  try {
    const db = await openIndexedDB();
    if (!db.objectStoreNames.contains(STORES.CACHED_SWAP_EVENTS)) return;
    const tx = db.transaction(STORES.CACHED_SWAP_EVENTS, "readwrite");
    const store = tx.objectStore(STORES.CACHED_SWAP_EVENTS);
    store.put({ pairAddress: key, events: trimmed, updatedAt: Date.now() });
  } catch {
    // Ignore write failure
  }
}

/**
 * Directly query stored historical Swap events from EVMEventLake IndexedDB store if present.
 */
export async function getLakeHistoricalSwapEvents(
  databaseUrlOrName: string,
  chainId: number,
  contractAddress: string,
  limit = 50
): Promise<SwapLogPayload[]> {
  const idbFactory: IDBFactory | undefined =
    typeof window !== "undefined" && window.indexedDB
      ? window.indexedDB
      : (globalThis as any).indexedDB;

  if (!idbFactory) return [];

  const dbName = extractDatabaseName(databaseUrlOrName);
  const targetKey = `${chainId}:${contractAddress.toLowerCase()}`;

  return new Promise<SwapLogPayload[]>((resolve) => {
    try {
      const openReq = idbFactory.open(dbName);
      openReq.onerror = () => resolve([]);
      openReq.onsuccess = () => {
        const db = openReq.result;
        try {
          if (!db.objectStoreNames.contains("event_logs")) {
            db.close();
            resolve([]);
            return;
          }
          const tx = db.transaction("event_logs", "readonly");
          const store = tx.objectStore("event_logs");
          const results: SwapLogPayload[] = [];

          const req = store.openCursor(null, "prev");
          req.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor && results.length < limit) {
              const item = cursor.value;
              if (
                item &&
                item.targetKey === targetKey &&
                (item.eventName === "Swap" || !item.eventName)
              ) {
                const enrichData = (item.additionalData || item.additional_data) as any;
                const args = (item.arguments ?? {}) as Record<string, unknown>;
                const amount0In = enrichData?.amount0In ?? String(args.amount0In ?? "0");
                const amount1In = enrichData?.amount1In ?? String(args.amount1In ?? "0");
                const amount0Out = enrichData?.amount0Out ?? String(args.amount0Out ?? "0");
                const amount1Out = enrichData?.amount1Out ?? String(args.amount1Out ?? "0");

                let direction: "buy" | "sell" | "unknown" = enrichData?.direction ?? "unknown";
                if (direction === "unknown") {
                  const a0In = BigInt(amount0In || "0");
                  const a1In = BigInt(amount1In || "0");
                  const a0Out = BigInt(amount0Out || "0");
                  const a1Out = BigInt(amount1Out || "0");
                  if (a0In > 0n && a1Out > 0n) direction = "sell";
                  else if (a1In > 0n && a0Out > 0n) direction = "buy";
                }

                results.push({
                  pairAddress: contractAddress,
                  transactionHash: item.transactionHash || `0x${Math.random().toString(16).slice(2)}`,
                  blockNumber: String(item.blockNumber || "0"),
                  logIndex: Number(item.logIndex ?? 0),
                  direction,
                  amount0: amount0In !== "0" ? amount0In : amount0Out,
                  amount1: amount1In !== "0" ? amount1In : amount1Out,
                  effectivePrice: enrichData?.effectivePrice1Per0 ?? undefined,
                  timestamp: enrichData?.enrichedAt ?? (item.timestamp || Date.now()),
                  additionalData: item.additionalData || {},
                  source: "historical",
                });
              }
              cursor.continue();
            } else {
              db.close();
              resolve(results);
            }
          };
          req.onerror = () => {
            db.close();
            resolve(results);
          };
        } catch {
          db.close();
          resolve([]);
        }
      };
    } catch {
      resolve([]);
    }
  });
}

