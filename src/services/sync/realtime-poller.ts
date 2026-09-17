import type { EVMEventLake } from "@evm-event-lake/node-sdk";
import { getAddress, type Address } from "viem";
import { syncEvents, type SwapLogPayload } from "./event-emitter";
import { SubscriptionStore } from "../../storage/subscription-store";
import type { SwapEnrichmentData } from "./event-enricher";

export interface PollerSession {
  pairAddress: string;
  lake: EVMEventLake;
  timer: ReturnType<typeof setInterval> | null;
  isUpdating: boolean;
  emittedKeys: Set<string>;
}

const activePollers = new Map<string, PollerSession>();

/**
 * Start real-time incremental log synchronization for a pair
 */
export function startRealtimePolling(
  pairAddress: Address,
  lake: EVMEventLake,
  intervalMs = 3000
): PollerSession {
  const key = getAddress(pairAddress);

  if (activePollers.has(key)) {
    return activePollers.get(key)!;
  }

  const session: PollerSession = {
    pairAddress: key,
    lake,
    timer: null,
    isUpdating: false,
    emittedKeys: new Set<string>(),
  };

  const pollTick = async () => {
    if (session.isUpdating) return;
    session.isUpdating = true;

    try {
      const updateResult = await lake.update();
      const storedCount = updateResult.storedLogs ?? updateResult.decodedLogs ?? 0;

      if (storedCount > 0) {
        // Query recent events from event lake, prioritizing Swap events
        const page = await lake.events.findMany({
          where: { eventName: "Swap" },
          limit: Math.min(storedCount, 20),
          order: "descending",
        });

        // Reverse items so they are emitted chronologically (oldest first, newest last)
        // This ensures that prepending in UI leaves the newest event at index 0
        const chronologicalItems = [...page.items].reverse();

        for (const item of chronologicalItems) {
          if (item.eventName && item.eventName !== "Swap") {
            continue;
          }

          const eventKey = `${item.transactionHash}:${item.logIndex}`;
          if (session.emittedKeys.has(eventKey)) {
            continue;
          }

          session.emittedKeys.add(eventKey);
          if (session.emittedKeys.size > 500) {
            // Prune oldest elements
            const firstKey = session.emittedKeys.values().next().value;
            if (firstKey) session.emittedKeys.delete(firstKey);
          }

          const enrichData = item.additionalData as SwapEnrichmentData | undefined;
          const args = (item.arguments ?? {}) as Record<string, unknown>;
          const amount0In = enrichData?.amount0In ?? String(args.amount0In ?? "0");
          const amount1In = enrichData?.amount1In ?? String(args.amount1In ?? "0");
          const amount0Out = enrichData?.amount0Out ?? String(args.amount0Out ?? "0");
          const amount1Out = enrichData?.amount1Out ?? String(args.amount1Out ?? "0");

          let direction = enrichData?.direction ?? "unknown";
          if (direction === "unknown") {
            const a0In = BigInt(amount0In || "0");
            const a1In = BigInt(amount1In || "0");
            const a0Out = BigInt(amount0Out || "0");
            const a1Out = BigInt(amount1Out || "0");
            if (a0In > 0n && a1Out > 0n) direction = "sell";
            else if (a1In > 0n && a0Out > 0n) direction = "buy";
          }

          const payload: SwapLogPayload = {
            pairAddress: key,
            transactionHash: item.transactionHash,
            blockNumber: item.blockNumber.toString(),
            logIndex: item.logIndex,
            direction,
            amount0: amount0In !== "0" ? amount0In : amount0Out,
            amount1: amount1In !== "0" ? amount1In : amount1Out,
            effectivePrice: enrichData?.effectivePrice1Per0 ?? undefined,
            timestamp: enrichData?.enrichedAt ?? Date.now(),
            additionalData: (item.additionalData as Record<string, unknown>) ?? {},
          };

          syncEvents.emit("new_swap", payload);
        }
      }

      // Update last synced block in storage
      if (updateResult.toBlock) {
        await SubscriptionStore.updateStatus(key, "active", {
          lastSyncedBlock: Number(updateResult.toBlock),
        });
      }

      if (updateResult.rewind) {
        console.warn(
          `[Reorg Detected] Pair ${key}: rewound from #${updateResult.rewind.rewindFromBlock} to #${updateResult.rewind.nextBlock}, removed ${updateResult.rewind.deletedLogs} logs.`
        );
      }
    } catch (err) {
      console.error(`Error during realtime poll for pair ${key}:`, err);
    } finally {
      session.isUpdating = false;
    }
  };

  // Start interval loop
  session.timer = setInterval(pollTick, intervalMs);
  activePollers.set(key, session);

  syncEvents.emit("status_change", {
    pairAddress: key,
    status: "active",
  });

  return session;
}

/**
 * Stop real-time polling for a pair
 */
export async function stopRealtimePolling(pairAddress: string): Promise<void> {
  const key = getAddress(pairAddress as Address);
  const session = activePollers.get(key);

  if (session) {
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
    activePollers.delete(key);

    await SubscriptionStore.updateStatus(key, "inactive");

    syncEvents.emit("status_change", {
      pairAddress: key,
      status: "inactive",
    });
  }
}

/**
 * Check if a pair is currently polling
 */
export function isPairPolling(pairAddress: string): boolean {
  try {
    const key = getAddress(pairAddress as Address);
    return activePollers.has(key);
  } catch {
    return false;
  }
}

/**
 * Stop all active realtime pollers (useful for unmounting and test tear down)
 */
export function stopAllPolling(): void {
  for (const session of activePollers.values()) {
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }
  }
  activePollers.clear();
}
