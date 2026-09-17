# 数据底座 SDK 上下文与追踪记录 (SDK Context & Maintenance)

## 1. 底座仓库基础信息
- **仓库本地路径**: `/ssd0/git/EVMEventLake-Node-SDK`
- **GitHub 远端**: `https://github.com/xzsean666/EVMEventLake-Node-SDK.git`
- **包名称**: `@evm-event-lake/node-sdk`
- **当前接入 Git Commit Hash**: `1d92284e6d145c4e9a5f303dfab5d42785639be9`
- **当前发布版本**: `0.1.0`

## 2. 核心导出与使用规范

### 2.1 模块导入路径
1. **主模块导入**:
   ```typescript
   import {
     EVMEventLake,
     type EVMEventLakeOptions,
     type EventEnrichmentContext,
     type EventEnricher,
     type EventRecord,
     type SyncStatus,
   } from "@evm-event-lake/node-sdk";
   ```
2. **`evm-call` 导入 (用于日常链上 Multicall3 / Batch 聚合读取)**:
   ```typescript
   import {
     createEvmCallClient,
     MULTICALL3_ADDRESS,
     encodeAggregate3,
     decodeAggregate3Result,
     encodeErc20Read,
     decodeErc20Read,
   } from "@evm-event-lake/node-sdk/evm-call";
   ```

### 2.2 存储引擎规范
- 客户端 Web3 DApp 统一使用 `IndexedDB` 存储适配器：
  ```typescript
  const database = "indexeddb://uniswap_v2_trader";
  ```
- 数据将在浏览器本地的 IndexedDB 库 `uniswap_v2_trader` 中持久化存储，无需中心化后端。

### 2.3 `enrichEvent` 量化数据富化挂钩规范
- 在 `EVMEventLake.create(...)` 中传入异步 `enrichEvent` 回调：
  ```typescript
  async function enrichSwapEvent(context: EventEnrichmentContext) {
    // 利用 Archive 归档节点在 context.blockNumber 高度查询 Pair 储备量或计算成交均价
    return {
      blockNumber: context.blockNumber.toString(),
      txHash: context.transactionHash,
      // 储备量与价格量化指标
    };
  }
  ```
- 富化结果自动持久化至 `additional_data` 字段，供前端 24h 走势与策略分析快速检索。

### 2.4 数据保留与自动清理选项规范 (Data Retention & Pruning - 选项模式，默认关闭)
- **严格约束**: 自动清理**必须是可选配置，默认严禁开启** (`enabled: false`)。未显式开启时，SDK 保留全部历史日志，零删除。
- **配置接口**:
  ```typescript
  import type { DataRetentionOptions } from "@evm-event-lake/node-sdk";

  // 仅在用户或特定场景显式开启时生效：
  const retention: DataRetentionOptions = {
    enabled: true,        // 必须显式为 true 才会执行
    maxBlocks: 28800n,    // 保留最新区块数（如 24 小时数据），旧区块事件将被修剪
    maxEvents: 5000,      // 或者保留最大事件数量
    pruneOnUpdate: true,  // 每次 update 同步成功后是否自动触发修剪
  };
  ```
- **手动按需修剪**: 亦支持直接调用 `lake.prune({ maxBlocks: 28800n })`，执行原子化清理。

## 3. 底座修改与更新规范
如后续业务需求必须对 `/ssd0/git/EVMEventLake-Node-SDK` 进行功能扩展或修复：
1. 先在 `/ssd0/git/EVMEventLake-Node-SDK` 中进行修改，并通过其内置的 `pnpm run verify`（包含 format、lint、typecheck、test 与 build）。
2. 在该仓库提交并推送到 GitHub（务必使用 `xzsean666` 账号路由）。
3. 获取最新的 Git commit hash（`git rev-parse HEAD`）。
4. 在本仓库更新：
   - `package.json` 中的依赖声明与锁文件。
   - 本文档中的“当前接入 Git Commit Hash”记录与变更说明。

### 维护历史 (Changelog)
- **2026-09-17 (Commit `1d92284e6d145c4e9a5f303dfab5d42785639be9`)**:
  - 新增 `DataRetentionOptions` 配置与校验，默认禁用 (`enabled: false`)，完全由调用方作为选项传入。
  - 在 `IndexeddbStorageAdapter` 与 `SqlStorageAdapter` 中实现 `pruneEvents`，支持按 `beforeBlockNumber` 区间修剪和按 `maxEventsToKeep` 队列修剪。
  - `EVMEventLake` 支持 `prune()` 手动按需修剪，并在开启时于 `update()` 返回 `prunedLogs` 指标。
  - 导出 `evm-call` 及相关类型；全套测试 183 passed 验证通过。
