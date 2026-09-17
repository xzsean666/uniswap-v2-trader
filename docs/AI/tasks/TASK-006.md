# TASK-006: EVMEventLake IndexedDB 存储适配器与订阅状态表初始化

## Objective
在浏览器客户端建立以 IndexedDB 为依托的本地去中心化数据底座。集成 `@evm-event-lake/node-sdk` 的 IndexedDB 存储引擎（`indexeddb://uniswap_v2_trader`），并定义币对订阅状态元数据管理层，用于持久化追踪用户开启监听的币对配置。

## Scope
- 验证 `@evm-event-lake/node-sdk` 中 `createStorageAdapter({ kind: "indexeddb", databaseName: "uniswap_v2_trader" })` 在浏览器与测试环境（`fake-indexeddb`）下的行为。
- 设计并实现币对订阅管理器 `SubscriptionStore`：
  - 存储用户订阅的 Pair 地址、添加时间、监听开关状态（active/inactive）、最后同步区块、自定义代理合约配置等。
  - 支持持久化到 IndexedDB 独立 Store（如 `pair_subscriptions`）或 LocalStorage 缓存。
- 编写订阅管理器的增删改查服务及对应单元测试。

## Allowed Files
- `src/storage/**`
- `tests/unit/storage/**`
- `docs/AI/tasks/TASK-006.md`

## Dependencies
- TASK-001

## Inputs and Outputs
- **输入**:
  - `database: "indexeddb://uniswap_v2_trader"` 配置
- **输出**:
  - `src/storage/indexeddb-client.ts` (底座存储连接单例)
  - `src/storage/subscription-store.ts` (币对订阅状态存储库)
  - `tests/unit/storage/subscription-store.test.ts` (单元测试)

## Acceptance Criteria
1. IndexedDB 存储底座在客户端环境中初始化正常。
2. 币对订阅记录能成功增删改查，页面刷新后订阅状态依然保持。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

