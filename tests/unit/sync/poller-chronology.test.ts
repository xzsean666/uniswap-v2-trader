import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { startRealtimePolling, stopAllPolling } from "../../../src/services/sync/realtime-poller";
import { syncEvents, type SwapLogPayload } from "../../../src/services/sync/event-emitter";

describe("Realtime Poller Chronology Tests", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    stopAllPolling();
  });

  afterEach(() => {
    stopAllPolling();
    vi.useRealTimers();
  });

  it("should emit batch logs chronologically so newest event ends at index 0 when prepending", async () => {
    const emittedLogs: SwapLogPayload[] = [];
    const unbind = syncEvents.on("new_swap", (log) => {
      // Standard UI prepend behavior
      emittedLogs.unshift(log);
    });

    const mockLake: any = {
      update: vi.fn().mockResolvedValue({
        storedLogs: 2,
        toBlock: 1002n,
      }),
      events: {
        findMany: vi.fn().mockResolvedValue({
          // EventLake returns descending by default
          items: [
            {
              transactionHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
              blockNumber: 1002n,
              logIndex: 1,
              additionalData: { direction: "buy", effectivePrice1Per0: 2.5 },
            },
            {
              transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
              blockNumber: 1001n,
              logIndex: 0,
              additionalData: { direction: "sell", effectivePrice1Per0: 2.0 },
            },
          ],
        }),
      },
    };

    startRealtimePolling("0x6725F303b657a9451d8BA641348b6761A6CC7a17", mockLake, 1000);

    // Advance timer to trigger poller tick
    await vi.advanceTimersByTimeAsync(1000);

    expect(emittedLogs.length).toBe(2);
    // Index 0 must be the newest log (#1002)
    expect(emittedLogs[0].blockNumber).toBe("1002");
    expect(emittedLogs[1].blockNumber).toBe("1001");

    unbind();
  });
});
