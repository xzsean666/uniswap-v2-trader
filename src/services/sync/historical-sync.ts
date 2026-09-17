import {
  EVMEventLake,
  type EVMEventLakeOptions,
  type UpdateProgressEvent,
} from "@evm-event-lake/node-sdk";
import { getAddress, type Address } from "viem";
import {
  BSC_TESTNET_CHAIN_ID,
  BSC_TESTNET_RPCS,
  PANCAKE_PAIR_ABI,
} from "../../constants/contracts";
import { DATABASE_URL } from "../../storage/indexeddb-client";
import { SubscriptionStore } from "../../storage/subscription-store";
import { getLatestBlockNumber } from "../../evm/rpc-client";
import { createSwapEnricher } from "./event-enricher";

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
}

/**
 * Perform 24-hour historical backfill for a subscribed pair
 */
export async function backfillPair24hHistory(
  options: BackfillOptions
): Promise<BackfillResult> {
  const pairAddress = getAddress(options.pairAddress);
  const onProgress = options.onProgress;

  onProgress?.({
    stage: "data_preparing",
    percent: 5,
    message: "正在连接 BSC Testnet 归档节点并计算 24 小时历史区块...",
  });

  // 1. Get latest block and calculate lookback
  let latestBlock = 0n;
  try {
    latestBlock = await getLatestBlockNumber();
  } catch (rpcErr) {
    console.warn("Failed to get latest block from RPC, using fallback:", rpcErr);
    latestBlock = 50000000n;
  }

  const startBlock = calculate24hStartBlock(latestBlock, options.deploymentBlock);

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

  // 3. Create EVMEventLake instance with enrichment hook
  const lakeOptions: EVMEventLakeOptions = {
    contractAddress: pairAddress,
    chainId: BSC_TESTNET_CHAIN_ID,
    abi: PANCAKE_PAIR_ABI,
    database: DATABASE_URL,
    startBlock,
    rpcUrls: [...BSC_TESTNET_RPCS],
    enrichEvent: createSwapEnricher(
      options.token0Decimals ?? 18,
      options.token1Decimals ?? 18
    ),
    observability: {
      onProgress: (event: UpdateProgressEvent) => {
        const ctx = event.context ?? {};
        const to = ctx.toBlock !== undefined ? BigInt(String(ctx.toBlock)) : latestBlock;
        const total = Math.max(1, Number(latestBlock - startBlock));
        const currentProgress = Math.min(
          95,
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

  const lake = await EVMEventLake.create(lakeOptions);

  let totalSynced = 0;
  try {
    onProgress?.({
      stage: "backfill_syncing",
      percent: 25,
      message: "正在批量拉取 24 小时历史事件并富化成交均价...",
    });

    const updateResult = await lake.update();
    totalSynced = updateResult.storedLogs ?? updateResult.decodedLogs ?? 0;

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
  } catch (err: any) {
    onProgress?.({
      stage: "error",
      percent: 0,
      message: `历史事件同步遇到异常: ${err?.message || "未知错误"}`,
    });
    throw err;
  }

  return {
    startBlock,
    endBlock: latestBlock,
    eventsSynced: totalSynced,
    lake,
  };
}
