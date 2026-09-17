import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress, parseUnits } from "viem";
import {
  calculate24hStartBlock,
  backfillPair24hHistory,
  BLOCKS_PER_DAY,
  type SyncProgressUpdate,
} from "../../../src/services/sync/historical-sync";
import {
  createSwapEnricher,
  sanitizeForDecodedValueCodec,
} from "../../../src/services/sync/event-enricher";
import { encodeDecodedValue } from "../../../node_modules/@evm-event-lake/node-sdk/dist/abi/decoded-value-codec.js";
import { SubscriptionStore } from "../../../src/storage/subscription-store";
import { EVMEventLake } from "@evm-event-lake/node-sdk";
import * as rpcClient from "../../../src/evm/rpc-client";

describe("Historical 24h Sync & Event Enrichment (TASK-007)", () => {
  const mockPair = getAddress("0x1111111111111111111111111111111111111111");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculate24hStartBlock", () => {
    it("subtracts 28,800 blocks when height is large", () => {
      const current = 50000000n;
      const start = calculate24hStartBlock(current);
      expect(start).toBe(50000000n - BLOCKS_PER_DAY);
    });

    it("clamps to 0 when current block is less than 28,800", () => {
      const current = 1000n;
      const start = calculate24hStartBlock(current);
      expect(start).toBe(0n);
    });

    it("respects pair deployment block if it is higher than 24h lookback", () => {
      const current = 50000000n;
      const deploymentBlock = 49990000n; // more recent than 50000000 - 28800 = 49971200
      const start = calculate24hStartBlock(current, deploymentBlock);
      expect(start).toBe(deploymentBlock);
    });
  });

  describe("createSwapEnricher", () => {
    const enricher = createSwapEnricher(18, 18);

    it("identifies sell order (Token0 sold for Token1)", () => {
      const mockContext: any = {
        arguments: {
          amount0In: parseUnits("100", 18).toString(),
          amount1In: "0",
          amount0Out: "0",
          amount1Out: parseUnits("200", 18).toString(),
          sender: "0x123",
          to: "0x456",
        },
      };

      const enriched = enricher(mockContext) as any;
      expect(enriched.direction).toBe("sell");
      expect(enriched.effectivePrice0Per1).toBeCloseTo(0.5, 4);
      expect(enriched.effectivePrice1Per0).toBeCloseTo(2.0, 4);
      expect(enriched.enrichedAt).toBeGreaterThan(0);
    });

    it("identifies buy order (Token1 sold for Token0)", () => {
      const mockContext: any = {
        arguments: {
          amount0In: "0",
          amount1In: parseUnits("200", 18).toString(),
          amount0Out: parseUnits("100", 18).toString(),
          amount1Out: "0",
          sender: "0x123",
          to: "0x456",
        },
      };

      const enriched = enricher(mockContext) as any;
      expect(enriched.direction).toBe("buy");
      expect(enriched.effectivePrice0Per1).toBeCloseTo(0.5, 4);
      expect(enriched.effectivePrice1Per0).toBeCloseTo(2.0, 4);
    });

    it("returns null for non-Swap events such as Sync", () => {
      const mockSyncContext: any = {
        eventName: "Sync",
        decodeStatus: "decoded",
        arguments: {
          reserve0: 1000000000000000000n,
          reserve1: 2000000000000000000n,
        },
      };

      const enriched = enricher(mockSyncContext);
      expect(enriched).toBeNull();
    });

    it("returns null for decode_failed or unknown events", () => {
      const mockFailedContext: any = {
        eventName: "Swap",
        decodeStatus: "decode_failed",
        arguments: null,
      };

      expect(enricher(mockFailedContext)).toBeNull();
    });

    it("returns null when context has no swap arguments", () => {
      const mockEmptyContext: any = {
        eventName: "Swap",
        decodeStatus: "decoded",
        arguments: {},
      };

      expect(enricher(mockEmptyContext)).toBeNull();
    });

    it("does not produce any undefined properties when optional fields are absent", () => {
      const mockPartialContext: any = {
        eventName: "Swap",
        decodeStatus: "decoded",
        arguments: {
          amount0In: parseUnits("100", 18).toString(),
          amount1In: "0",
          amount0Out: "0",
          amount1Out: parseUnits("200", 18).toString(),
          // sender and to are omitted
        },
      };

      const enriched = enricher(mockPartialContext) as any;
      expect(enriched).toBeDefined();
      expect("sender" in enriched).toBe(false);
      expect("to" in enriched).toBe(false);
      expect(Object.values(enriched).includes(undefined)).toBe(false);

      // Must be safely serializable by encodeDecodedValue without throwing
      expect(() => encodeDecodedValue(enriched)).not.toThrow();
    });

    it("handles zero amounts gracefully without NaN or Infinity", () => {
      const mockZeroContext: any = {
        eventName: "Swap",
        decodeStatus: "decoded",
        arguments: {
          amount0In: "0",
          amount1In: "0",
          amount0Out: "0",
          amount1Out: "0",
          sender: "0x123",
          to: "0x456",
        },
      };

      const enriched = enricher(mockZeroContext) as any;
      expect(enriched.direction).toBe("unknown");
      expect("effectivePrice0Per1" in enriched).toBe(false);
      expect("effectivePrice1Per0" in enriched).toBe(false);

      // Must be safely serializable by encodeDecodedValue without throwing
      expect(() => encodeDecodedValue(enriched)).not.toThrow();
    });
  });

  describe("sanitizeForDecodedValueCodec", () => {
    it("strips undefined keys and converts non-finite numbers safely", () => {
      const dirty = {
        a: 1,
        b: "text",
        c: undefined,
        d: {
          nestedUndefined: undefined,
          nestedValid: true,
          nestedInfinity: Infinity,
          nestedNan: NaN,
        },
        arr: [1, undefined, "item"],
      };

      const cleaned = sanitizeForDecodedValueCodec(dirty) as any;
      expect(cleaned.c).toBeUndefined();
      expect("c" in cleaned).toBe(false);
      expect("nestedUndefined" in cleaned.d).toBe(false);
      expect("nestedInfinity" in cleaned.d).toBe(false);
      expect("nestedNan" in cleaned.d).toBe(false);
      expect(cleaned.d.nestedValid).toBe(true);
      expect(cleaned.arr).toEqual([1, null, "item"]);

      // Verify that encodeDecodedValue succeeds without any error
      expect(() => encodeDecodedValue(cleaned)).not.toThrow();
    });
  });

  describe("backfillPair24hHistory Flow", () => {
    it("executes full historical sync lifecycle with progress updates", async () => {
      vi.spyOn(rpcClient, "getLatestBlockNumber").mockResolvedValue(50000000n);

      const mockLakeInstance: any = {
        update: vi.fn().mockResolvedValue({
          storedLogs: 42,
          currentBlock: 50000000n,
        }),
      };

      vi.spyOn(EVMEventLake, "create").mockResolvedValue(mockLakeInstance);
      const saveSpy = vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();

      const progressEvents: SyncProgressUpdate[] = [];
      const result = await backfillPair24hHistory({
        pairAddress: mockPair,
        onProgress: (p) => progressEvents.push(p),
      });

      expect(result.eventsSynced).toBe(42);
      expect(result.endBlock).toBe(50000000n);
      expect(mockLakeInstance.update).toHaveBeenCalledOnce();

      // Check stages
      const stages = progressEvents.map((e) => e.stage);
      expect(stages).toContain("data_preparing");
      expect(stages).toContain("backfill_syncing");
      expect(stages).toContain("ready");

      // Verify final stage percent
      const finalEvent = progressEvents[progressEvents.length - 1];
      expect(finalEvent.percent).toBe(100);
      expect(saveSpy).toHaveBeenCalledWith(mockPair, "active", expect.any(Object));
    });

    it("reuses existing target startBlock if previously registered in IndexedDB", async () => {
      vi.spyOn(rpcClient, "getLatestBlockNumber").mockResolvedValue(50000000n);
      const idbClient = await import("../../../src/storage/indexeddb-client");
      const getExistingSpy = vi
        .spyOn(idbClient, "getExistingLakeTargetStartBlock")
        .mockResolvedValue(49900000n);

      const mockLakeInstance: any = {
        update: vi.fn().mockResolvedValue({
          storedLogs: 10,
          currentBlock: 50000000n,
        }),
      };
      const createSpy = vi.spyOn(EVMEventLake, "create").mockResolvedValue(mockLakeInstance);
      vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();

      const result = await backfillPair24hHistory({ pairAddress: mockPair });

      expect(getExistingSpy).toHaveBeenCalled();
      expect(result.startBlock).toBe(49900000n);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          startBlock: 49900000n,
        })
      );
    });

    it("auto-heals and retries when TargetMetadataConflictError occurs", async () => {
      vi.spyOn(rpcClient, "getLatestBlockNumber").mockResolvedValue(50000000n);
      const idbClient = await import("../../../src/storage/indexeddb-client");
      vi.spyOn(idbClient, "getExistingLakeTargetStartBlock").mockResolvedValue(null);
      const resetSpy = vi.spyOn(idbClient, "resetLakeTargetStorage").mockResolvedValue();

      const mockLakeInstance: any = {
        update: vi.fn().mockResolvedValue({
          storedLogs: 5,
          currentBlock: 50000000n,
        }),
      };

      const conflictError = new Error("Existing target metadata conflicts with SDK options");
      conflictError.name = "TargetMetadataConflictError";

      // First call fails with conflict, second call succeeds
      const createSpy = vi
        .spyOn(EVMEventLake, "create")
        .mockRejectedValueOnce(conflictError)
        .mockResolvedValueOnce(mockLakeInstance);

      vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();

      const result = await backfillPair24hHistory({ pairAddress: mockPair });

      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(resetSpy).toHaveBeenCalledOnce();
      expect(result.eventsSynced).toBe(5);
    });

    it("strictly uses Archive RPC pool for EVMEventLake backfill", async () => {
      vi.spyOn(rpcClient, "getLatestBlockNumber").mockResolvedValue(50000000n);
      const mockLakeInstance: any = {
        update: vi.fn().mockResolvedValue({ storedLogs: 1 }),
      };
      const createSpy = vi.spyOn(EVMEventLake, "create").mockResolvedValue(mockLakeInstance);
      vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();

      await backfillPair24hHistory({ pairAddress: mockPair });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          rpcUrls: expect.arrayContaining([
            "https://bsc-testnet-rpc.publicnode.com",
            "https://bsc-testnet.drpc.org",
          ]),
        })
      );
    });

    it("guards observability.onProgress so subsequent poller updates never overwrite ready state with 95%", async () => {
      vi.spyOn(rpcClient, "getLatestBlockNumber").mockResolvedValue(50000000n);
      let capturedOnProgress: ((event: any) => void) | undefined;

      const mockLakeInstance: any = {
        update: vi.fn().mockResolvedValue({ storedLogs: 10 }),
      };

      vi.spyOn(EVMEventLake, "create").mockImplementation(async (options: any) => {
        capturedOnProgress = options.observability?.onProgress;
        return mockLakeInstance;
      });
      vi.spyOn(SubscriptionStore, "updateStatus").mockResolvedValue();

      const progressUpdates: SyncProgressUpdate[] = [];
      await backfillPair24hHistory({
        pairAddress: mockPair,
        onProgress: (p) => progressUpdates.push(p),
      });

      // Verify completion reached ready 100%
      expect(progressUpdates[progressUpdates.length - 1].stage).toBe("ready");
      expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);

      const countBefore = progressUpdates.length;

      // Simulate a poller update triggering the lake's observability hook AFTER backfill has completed
      expect(capturedOnProgress).toBeDefined();
      capturedOnProgress!({
        context: { fromBlock: "50000001", toBlock: "50000005" },
        stage: "range_committed",
      });

      // It must NOT emit or overwrite the progress state!
      expect(progressUpdates.length).toBe(countBefore);
      expect(progressUpdates[progressUpdates.length - 1].percent).toBe(100);
    });
  });
});
