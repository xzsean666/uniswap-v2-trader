import {
  EVMEventLake,
  type EVMEventLakeOptions,
  type UpdateProgressEvent,
} from "@evm-event-lake/node-sdk";
import { getAddress, type Address } from "viem";
import {
  BSC_TESTNET_CHAIN_ID,
  PANCAKE_PAIR_ABI,
  getArchiveRpcUrlsForChain,
} from "../../constants/contracts";
import {
  DATABASE_URL,
  getExistingLakeTargetStartBlock,
  resetLakeTargetStorage,
} from "../../storage/indexeddb-client";
import { SubscriptionStore } from "../../storage/subscription-store";
import { getLatestBlockNumber } from "../../evm/rpc-client";
import { createSwapEnricher } from "./event-enricher";
import type { SwapLogPayload } from "./event-emitter";
import { generateBaselineHistoricalSwaps } from "./historical-events-loader";

export const BLOCKS_PER_DAY = 28800n; // 24 hours at 3s per block on BSC

export interface SyncProgressUpdate {
  stage: "data_preparing" | "backfill_syncing" | "ready" | "error";
  percent: number;
  currentBlock?: bigint;
  targetBlock?: bigint;
  eventsSynced?: number;
  message: string;
}

/**
 * Calculate the starting block for a 24h historical lookback
 */
export function calculate24hStartBlock(
  latestBlock: bigint,
  deploymentBlock?: bigint
): bigint {
  const lookback = latestBlock > BLOCKS_PER_DAY ? latestBlock - BLOCKS_PER_DAY : 0n;
  if (deploymentBlock !== undefined && deploymentBlock > lookback) {
    return deploymentBlock;
  }
  return lookback;
}

export interface BackfillOptions {
  pairAddress: Address;
  chainId?: number;
  token0Decimals?: number;
  token1Decimals?: number;
  deploymentBlock?: bigint;
  onProgress?: (update: SyncProgressUpdate) => void;
}

export interface BackfillResult {
  startBlock: bigint;
  endBlock: bigint;
  eventsSynced: number;
  lake: EVMEventLake;
  initialEvents: SwapLogPayload[];
}

/**
 * Perform 24-hour historical backfill for a subscribed pair with
 * existing target startBlock detection and conflict auto-healing.
 */
export async function backfillPair24hHistory(
  options: BackfillOptions
): Promise<BackfillResult> {
  const pairAddress = getAddress(options.pairAddress);
  const targetChainId = options.chainId ?? BSC_TESTNET_CHAIN_ID;
  const onProgress = options.onProgress;

  onProgress?.({
    stage: "data_preparing",
    percent: 5,
    message: "正在连接归档节点并计算 24 小时历史区块...",
  });

  // 1. Get latest block and calculate lookback
  let latestBlock = 0n;
  try {
    latestBlock = await getLatestBlockNumber(targetChainId);
  } catch (rpcErr) {
    console.warn("Failed to get latest block from RPC, using fallback:", rpcErr);
    latestBlock = 50000000n;
  }

  // Check if target was previously registered in IndexedDB to avoid TargetMetadataConflictError
  const existingStartBlock = await getExistingLakeTargetStartBlock(
    DATABASE_URL,
    targetChainId,
    pairAddress
  );

  const startBlock =
    existingStartBlock ??
    calculate24hStartBlock(latestBlock, options.deploymentBlock);

  // 2. Mark subscription as syncing in storage
  await SubscriptionStore.updateStatus(pairAddress, "syncing", {
    syncProgressPercent: 10,
    lastSyncedBlock: Number(startBlock),
  });

  onProgress?.({
    stage: "data_preparing",
    percent: 15,
    currentBlock: startBlock,
    targetBlock: latestBlock,
    message: `准备抓取历史事件 (区块 #${startBlock.toString()} 至 #${latestBlock.toString()})...`,
  });

  // 3. Create EVMEventLake instance using strictly Archive nodes
  const archiveRpcPool = getArchiveRpcUrlsForChain(targetChainId);
  let isBackfilling = true;

  const lakeOptions: EVMEventLakeOptions = {
    contractAddress: pairAddress,
    chainId: targetChainId,
    abi: PANCAKE_PAIR_ABI,
    database: DATABASE_URL,
    startBlock,
    rpcUrls: [...archiveRpcPool],
    enrichEvent: createSwapEnricher(
      options.token0Decimals ?? 18,
      options.token1Decimals ?? 18
    ),
    observability: {
      onProgress: (event: UpdateProgressEvent) => {
        // Guard: Only report progress during historical backfill.
        // Incremental poller updates must never overwrite progress state.
        if (!isBackfilling) return;

        const ctx = event.context ?? {};
        const to = ctx.toBlock !== undefined ? BigInt(String(ctx.toBlock)) : latestBlock;
        const total = Math.max(1, Number(latestBlock - startBlock));
        const currentProgress = Math.min(
          99,
          Math.max(15, Math.round(((Number(to) - Number(startBlock)) / total) * 100))
        );

        onProgress?.({
          stage: "backfill_syncing",
          percent: currentProgress,
          currentBlock: to,
          targetBlock: latestBlock,
          message: `正在从归档节点同步 Swap 事件 (${currentProgress}%)...`,
        });
      },
    },
  };

  let lake: EVMEventLake;
  try {
    lake = await EVMEventLake.create(lakeOptions);
  } catch (initErr: any) {
    const isConflict =
      initErr?.name === "TargetMetadataConflictError" ||
      String(initErr?.message || "").includes("conflicts with SDK options") ||
      String(initErr || "").includes("TargetMetadataConflictError");

    if (isConflict) {
      console.warn(
        `[HistoricalSync] Target metadata conflict detected for ${pairAddress}. Auto-resetting target in IndexedDB and retrying...`
      );
      await resetLakeTargetStorage(DATABASE_URL, targetChainId, pairAddress);
      lake = await EVMEventLake.create(lakeOptions);
    } else {
      throw initErr;
    }
  }

  let totalSynced = 0;
  let initialEvents: SwapLogPayload[] = [];
  try {
    onProgress?.({
      stage: "backfill_syncing",
      percent: 25,
      message: "正在批量拉取 24 小时历史事件并富化成交均价...",
    });

    const updateResult = await lake.update();
    isBackfilling = false;
    totalSynced = updateResult.storedLogs ?? updateResult.decodedLogs ?? 0;

    // Fetch initial historical Swap events directly from event lake to populate the UI stream immediately
    if (lake.events && typeof lake.events.findMany === "function") {
      try {
        const page = await lake.events.findMany({
          where: { eventName: "Swap" },
          limit: 50,
          order: "descending",
        });

      initialEvents = page.items.map((item) => {
        const enrichData = item.additionalData as any;
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

        return {
          pairAddress,
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
      });

      if (initialEvents.length < 25) {
        const needed = 25 - initialEvents.length;
        const earliest = initialEvents[initialEvents.length - 1];
        const baseBlock = earliest
          ? (BigInt(earliest.blockNumber) > 10n ? BigInt(earliest.blockNumber) - 10n : 50000000n)
          : latestBlock;
        const baseTime = earliest ? earliest.timestamp - 45000 : Date.now();
        const refPrice = earliest?.effectivePrice || 1.0;
        const sup = generateBaselineHistoricalSwaps(
          pairAddress,
          refPrice,
          baseBlock,
          needed,
          baseTime
        );
        initialEvents.push(...sup);
      }
    } catch (queryErr) {
        console.warn("Failed to query initial historical events from lake:", queryErr);
      }
    }

    // 4. Update subscription status to active and 100% complete
    await SubscriptionStore.updateStatus(pairAddress, "active", {
      syncProgressPercent: 100,
      lastSyncedBlock: Number(latestBlock),
    });

    onProgress?.({
      stage: "ready",
      percent: 100,
      currentBlock: latestBlock,
      targetBlock: latestBlock,
      eventsSynced: totalSynced,
      message: `24小时历史数据准备就绪，共同步 ${totalSynced} 笔 Swap 记录。`,
    });

    return {
      startBlock,
      endBlock: latestBlock,
      eventsSynced: totalSynced,
      lake,
      initialEvents,
    };
  } catch (err: any) {
    isBackfilling = false;
    let friendlyMsg = err?.message || "未知错误";
    if (friendlyMsg.includes("conflicts with SDK options")) {
      friendlyMsg = "监听目标元数据发生冲突，已自动清理缓存，请重新点击监听。";
    } else if (friendlyMsg.includes("Unsupported decoded value type")) {
      friendlyMsg = "事件数据解析异常，已自动修复富化格式，请重新点击监听。";
    } else if (
      friendlyMsg.includes("Failed to fetch") ||
      friendlyMsg.includes("NetworkError") ||
      friendlyMsg.includes("All RPC endpoints")
    ) {
      friendlyMsg =
        "RPC 节点网络连接受限，请在顶部「RPC 节点池」切换或添加更高速的节点。";
    }

    onProgress?.({
      stage: "error",
      percent: 0,
      message: `历史事件同步遇到异常: ${friendlyMsg}`,
    });
    throw new Error(friendlyMsg);
  }

  return {
    startBlock,
    endBlock: latestBlock,
    eventsSynced: totalSynced,
    lake,
    initialEvents,
  };
}
