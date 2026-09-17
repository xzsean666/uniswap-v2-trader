import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { getAddress } from "viem";
import {
  DATABASE_NAME,
  DATABASE_URL,
  openIndexedDB,
  closeIndexedDB,
} from "../../../src/storage/indexeddb-client";
import {
  SubscriptionStore,
  type PairSubscription,
} from "../../../src/storage/subscription-store";

describe("IndexedDB Storage & SubscriptionStore (TASK-006)", () => {
  const mockPair = getAddress("0x1111111111111111111111111111111111111111");
  const mockToken0 = getAddress("0x2222222222222222222222222222222222222222");
  const mockToken1 = getAddress("0x3333333333333333333333333333333333333333");

  beforeEach(async () => {
    SubscriptionStore.clearMemoryCache();
    await SubscriptionStore.delete(mockPair);
  });

  it("exports correct database configuration", () => {
    expect(DATABASE_NAME).toBe("uniswap_v2_trader_app");
    expect(DATABASE_URL).toBe("indexeddb://uniswap_v2_trader");
  });

  it("opens IndexedDB connection successfully", async () => {
    const db = await openIndexedDB();
    expect(db).toBeDefined();
    expect(db.name).toBe(DATABASE_NAME);
    expect(db.objectStoreNames.contains("pair_subscriptions")).toBe(true);
    closeIndexedDB();
  });

  it("saves and retrieves a pair subscription", async () => {
    const sub: PairSubscription = {
      pairAddress: mockPair,
      token0Address: mockToken0,
      token0Symbol: "ACP",
      token1Address: mockToken1,
      token1Symbol: "USDT",
      status: "active",
      createdAt: 1710000000000,
      updatedAt: 1710000000000,
    };

    await SubscriptionStore.save(sub);
    const retrieved = await SubscriptionStore.get(mockPair);

    expect(retrieved).toBeDefined();
    expect(retrieved?.pairAddress).toBe(mockPair);
    expect(retrieved?.token0Symbol).toBe("ACP");
    expect(retrieved?.status).toBe("active");
  });

  it("updates subscription status and sync progress", async () => {
    const sub: PairSubscription = {
      pairAddress: mockPair,
      token0Address: mockToken0,
      token0Symbol: "ACP",
      token1Address: mockToken1,
      token1Symbol: "USDT",
      status: "syncing",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await SubscriptionStore.save(sub);
    await SubscriptionStore.updateStatus(mockPair, "active", {
      lastSyncedBlock: 12345678,
      syncProgressPercent: 100,
    });

    const updated = await SubscriptionStore.get(mockPair);
    expect(updated?.status).toBe("active");
    expect(updated?.lastSyncedBlock).toBe(12345678);
    expect(updated?.syncProgressPercent).toBe(100);
  });

  it("lists all saved subscriptions", async () => {
    const sub1: PairSubscription = {
      pairAddress: mockPair,
      token0Address: mockToken0,
      token0Symbol: "ACP",
      token1Address: mockToken1,
      token1Symbol: "USDT",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await SubscriptionStore.save(sub1);
    const list = await SubscriptionStore.getAll();
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((s) => s.pairAddress === mockPair)).toBe(true);
  });

  it("deletes a subscription", async () => {
    const sub: PairSubscription = {
      pairAddress: mockPair,
      token0Address: mockToken0,
      token0Symbol: "ACP",
      token1Address: mockToken1,
      token1Symbol: "USDT",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await SubscriptionStore.save(sub);
    await SubscriptionStore.delete(mockPair);

    const check = await SubscriptionStore.get(mockPair);
    expect(check).toBeNull();
  });
});
