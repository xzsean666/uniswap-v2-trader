import { getAddress, isAddress, type Address } from "viem";
import { openIndexedDB, STORES } from "./indexeddb-client";

export type SubscriptionStatus = "active" | "inactive" | "syncing" | "error";

export interface PairSubscription {
  pairAddress: Address;
  token0Address: Address;
  token0Symbol: string;
  token1Address: Address;
  token1Symbol: string;
  status: SubscriptionStatus;
  createdAt: number;
  updatedAt: number;
  lastSyncedBlock?: number;
  syncProgressPercent?: number;
  proxyContract?: Address;
  customCallData?: string;
  errorMessage?: string;
}

// In-memory cache fallback for environments without persistent IndexedDB
const memoryStore = new Map<string, PairSubscription>();

export class SubscriptionStore {
  /**
   * Save or update a pair subscription
   */
  static async save(subscription: PairSubscription): Promise<void> {
    const key = getAddress(subscription.pairAddress);
    const item: PairSubscription = {
      ...subscription,
      pairAddress: key,
      token0Address: getAddress(subscription.token0Address),
      token1Address: getAddress(subscription.token1Address),
      updatedAt: Date.now(),
      createdAt: subscription.createdAt || Date.now(),
    };

    memoryStore.set(key, item);

    try {
      const db = await openIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.PAIR_SUBSCRIPTIONS, "readwrite");
        const store = tx.objectStore(STORES.PAIR_SUBSCRIPTIONS);
        const req = store.put(item);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Fallback to in-memory store
    }
  }

  /**
   * Get a pair subscription by pair address
   */
  static async get(pairAddress: string): Promise<PairSubscription | null> {
    if (!isAddress(pairAddress)) return null;
    const key = getAddress(pairAddress);

    try {
      const db = await openIndexedDB();
      return await new Promise<PairSubscription | null>((resolve, reject) => {
        const tx = db.transaction(STORES.PAIR_SUBSCRIPTIONS, "readonly");
        const store = tx.objectStore(STORES.PAIR_SUBSCRIPTIONS);
        const req = store.get(key);
        req.onsuccess = () => {
          resolve(req.result ? (req.result as PairSubscription) : (memoryStore.get(key) ?? null));
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }

  /**
   * Retrieve all saved subscriptions
   */
  static async getAll(): Promise<PairSubscription[]> {
    try {
      const db = await openIndexedDB();
      return await new Promise<PairSubscription[]>((resolve, reject) => {
        const tx = db.transaction(STORES.PAIR_SUBSCRIPTIONS, "readonly");
        const store = tx.objectStore(STORES.PAIR_SUBSCRIPTIONS);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result as PairSubscription[];
          if (list && list.length > 0) {
            resolve(list);
          } else {
            resolve(Array.from(memoryStore.values()));
          }
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return Array.from(memoryStore.values());
    }
  }

  /**
   * Delete a subscription
   */
  static async delete(pairAddress: string): Promise<void> {
    if (!isAddress(pairAddress)) return;
    const key = getAddress(pairAddress);
    memoryStore.delete(key);

    try {
      const db = await openIndexedDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.PAIR_SUBSCRIPTIONS, "readwrite");
        const store = tx.objectStore(STORES.PAIR_SUBSCRIPTIONS);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Memory store already deleted
    }
  }

  /**
   * Update the status and optional syncing fields of a subscription
   */
  static async updateStatus(
    pairAddress: string,
    status: SubscriptionStatus,
    extra?: Partial<Omit<PairSubscription, "pairAddress" | "status">>
  ): Promise<void> {
    const existing = await this.get(pairAddress);
    if (!existing) return;

    const updated: PairSubscription = {
      ...existing,
      ...extra,
      status,
      updatedAt: Date.now(),
    };

    await this.save(updated);
  }

  /**
   * Clear all memory records (primarily for testing)
   */
  static clearMemoryCache(): void {
    memoryStore.clear();
  }
}
