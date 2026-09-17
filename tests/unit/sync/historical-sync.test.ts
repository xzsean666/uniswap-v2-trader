import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAddress, parseUnits } from "viem";
import {
  calculate24hStartBlock,
  backfillPair24hHistory,
  BLOCKS_PER_DAY,
  type SyncProgressUpdate,
} from "../../../src/services/sync/historical-sync";
import { createSwapEnricher } from "../../../src/services/sync/event-enricher";
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
  });
});
