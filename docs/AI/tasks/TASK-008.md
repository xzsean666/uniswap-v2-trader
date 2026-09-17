# TASK-008: 实时区块日志增量同步引擎与重组检测

## Objective
在 24 小时历史回溯完成后，将币对监听状态平滑转入实时增量追踪模式。定期轮询最新区块上的新产生 `Swap` 事件，将其持久化至 IndexedDB，并在触发轻微链重组（Reorg）时利用底座回滚机制保持数据一致性。

## Scope
- 基于 `EVMEventLake.update()` 建立周期性同步调度器（支持可配置的轮询间隔，如 3 ~ 6 秒，匹配 BSC 3秒的出块节奏）。
- 实现监听生命周期控制：支持针对指定 Pair 开启实时监听、暂停监听、恢复监听以及完全注销。
- 监听并分发新入库事件：向应用层发布 `onNewSwapEvent` 事件广播，驱动 UI 列表与交易策略实时更新。
- 编写增量同步调度器的单元测试。

## Allowed Files
- `src/services/sync/**`
- `tests/unit/sync/**`
- `docs/AI/tasks/TASK-008.md`

## Dependencies
- TASK-007

## Inputs and Outputs
- **输入**:
  - 已完成历史数据准备的 `EVMEventLake` 实例
- **输出**:
  - `src/services/sync/realtime-poller.ts` (实时增量同步调度器)
  - `src/services/sync/event-emitter.ts` (新事件分发中心)
  - `tests/unit/sync/realtime-poller.test.ts` (单元测试)

## Acceptance Criteria
1. 历史数据准备完成后，轮询器自动接管并定期调用 `update()`。
2. 新产生的 Swap 事件能即时触发事件订阅回调。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

