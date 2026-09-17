/**
 * Client IndexedDB Connection & Storage Infrastructure
 */

export const DATABASE_NAME = "uniswap_v2_trader_app";
export const DATABASE_URL = "indexeddb://uniswap_v2_trader";
export const DB_VERSION = 1;

export const STORES = {
  PAIR_SUBSCRIPTIONS: "pair_subscriptions",
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
