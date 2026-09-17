import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAddress } from "viem";
import {
  startRealtimePolling,
  stopRealtimePolling,
  isPairPolling,
  stopAllPolling,
} from "../../../src/services/sync/realtime-poller";
import { syncEvents, type SwapLogPayload } from "../../../src/services/sync/event-emitter";
import { SubscriptionStore } from "../../../src/storage/subscription-store";

describe("Realtime Incremental Poller (TASK-008)", () => {
  const mockPair = getAddress("0x1111111111111111111111111111111111111111");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
    vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();
    stopAllPolling();
  });

  afterEach(() => {
    stopAllPolling();
    vi.useRealTimers();
  });

  it("registers event listener and receives emitted payloads", () => {
    const received: SwapLogPayload[] = [];
    const unbind = syncEvents.on("new_swap", (p) => received.push(p));

    const testPayload: SwapLogPayload = {
      pairAddress: mockPair,
      transactionHash: "0xabc",
      blockNumber: "12345",
      logIndex: 0,
      direction: "buy",
      amount0: "100",
      amount1: "200",
      timestamp: Date.now(),
    };

    syncEvents.emit("new_swap", testPayload);
    expect(received).toHaveLength(1);
    expect(received[0].transactionHash).toBe("0xabc");

    unbind();
    syncEvents.emit("new_swap", testPayload);
    expect(received).toHaveLength(1); // Not called after unbind
  });

  it("starts polling, invokes lake.update() on interval and emits new events", async () => {
    const mockLake: any = {
      update: vi.fn().mockResolvedValue({
        storedLogs: 1,
        toBlock: 50000001n,
      }),
      events: {
        findMany: vi.fn().mockResolvedValue({
          items: [
            {
              transactionHash: "0xdeadbeef",
              blockNumber: 50000001n,
              logIndex: 1,
              arguments: {},
              additionalData: {
                direction: "sell",
                amount0In: "50",
                amount1Out: "100",
                effectivePrice1Per0: 2.0,
                enrichedAt: 1710000000,
              },
            },
          ],
        }),
      },
    };

    const statusSpy = vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();
    const emittedSwaps: SwapLogPayload[] = [];
    syncEvents.on("new_swap", (payload) => emittedSwaps.push(payload));

    const session = startRealtimePolling(mockPair, mockLake, 1000);
    expect(isPairPolling(mockPair)).toBe(true);
    expect(session.pairAddress).toBe(mockPair);

    // Advance clock by 1000ms
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockLake.update).toHaveBeenCalledOnce();
    expect(mockLake.events.findMany).toHaveBeenCalledOnce();
    expect(emittedSwaps).toHaveLength(1);
    expect(emittedSwaps[0].transactionHash).toBe("0xdeadbeef");
    expect(emittedSwaps[0].direction).toBe("sell");
    expect(statusSpy).toHaveBeenCalledWith(mockPair, "active", {
      lastSyncedBlock: 50000001,
    });
  });

  it("stops polling cleanly and clears timer", async () => {
    const mockLake: any = {
      update: vi.fn().mockResolvedValue({ storedLogs: 0, toBlock: 50000000n }),
    };

    startRealtimePolling(mockPair, mockLake, 1000);
    expect(isPairPolling(mockPair)).toBe(true);

    await stopRealtimePolling(mockPair);
    expect(isPairPolling(mockPair)).toBe(false);

    // Advance time again, lake.update should not be called anymore
    await vi.advanceTimersByTimeAsync(3000);
    expect(mockLake.update).not.toHaveBeenCalled();
  });
});
