# 数据底座 SDK 上下文与追踪记录 (SDK Context & Maintenance)

## 1. 底座仓库基础信息
- **仓库本地路径**: `/ssd0/git/EVMEventLake-Node-SDK`
- **GitHub 远端**: `https://github.com/xzsean666/EVMEventLake-Node-SDK.git`
- **包名称**: `@evm-event-lake/node-sdk`
- **当前接入 Git Commit Hash**: `d614d8c12c9ac7bbe0a1bb08053258ea5a0c357d`
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

## 3. 底座修改与更新规范
如后续业务需求必须对 `/ssd0/git/EVMEventLake-Node-SDK` 进行功能扩展或修复：
1. 先在 `/ssd0/git/EVMEventLake-Node-SDK` 中进行修改，并通过其内置的 `pnpm run verify`（包含 format、lint、typecheck、test 与 build）。
2. 在该仓库提交并推送到 GitHub（务必使用 `xzsean666` 账号路由）。
3. 获取最新的 Git commit hash（`git rev-parse HEAD`）。
4. 在本仓库更新：
   - `package.json` 中的依赖声明与锁文件。
   - 本文档中的“当前接入 Git Commit Hash”记录与变更说明。
