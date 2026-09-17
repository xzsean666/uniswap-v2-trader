# TASK-007: 24小时历史事件回溯抓取与 Archive 节点数据富化引擎

## Objective
实现用户订阅币对后，自动回溯过去 1 天（约 28,800 个区块）的 `Swap` 事件。利用 BSC Testnet Archive 归档节点配合 `@evm-event-lake/node-sdk` 的 `enrichEvent` 回调函数，在事件落库时富化该区块的储备量与价格量化数据，并在 UI 上呈现“数据准备中...”的等待进度状态。

## Scope
- 计算起始回溯区块：通过 RPC 获取当前最新区块 `latestBlock`，计算 `startBlock = latestBlock - 28800n`（若不足则从区块 0 或 Pair 部署块开始）。
- 实例化 `EVMEventLake`：
  - `database: "indexeddb://uniswap_v2_trader"`
  - `contractAddress: pairAddress`
  - `abi: pancakePairAbi` (重点关注 `Swap` 事件)
  - `startBlock`: 回溯计算起始块
  - `rpcUrls`: 配置已验证的 Archive 节点池（`bsc-testnet-rpc.publicnode.com`, `bsc-testnet.drpc.org`）
  - `enrichEvent`: 自定义异步富化函数，利用 Archive 节点查询该区块高度下 Pair 的历史状态，计算成交均价并写入 `additional_data`。
- 进度感知：利用 `observability.onProgress` 捕获同步事件，向上层抛出进度百分比与阶段状态（`data_preparing`, `backfill_syncing`, `ready`）。
- 编写单元测试验证回溯计算逻辑、enrichEvent 挂钩与进度通知。

## Allowed Files
- `src/services/sync/**`
- `tests/unit/sync/**`
- `docs/AI/tasks/TASK-007.md`

## Dependencies
- TASK-004, TASK-006

## Inputs and Outputs
- **输入**:
  - 待订阅的 LP Pair 地址
  - Archive 节点池
- **输出**:
  - `src/services/sync/historical-sync.ts` (历史回溯同步服务)
  - `src/services/sync/event-enricher.ts` (Swap 事件归档富化挂钩)
  - `tests/unit/sync/historical-sync.test.ts` (单元测试)

## Acceptance Criteria
1. 正确计算 24 小时前区块并启动 `EVMEventLake` 历史抓取。
2. `enrichEvent` 能在入库时填充区块价格等量化指标至 `additional_data`。
3. 历史同步期间准确向 UI 报告同步进度与“数据准备中”状态。
4. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

