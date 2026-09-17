# TASK-012: "AI自动交易" 与 "价格增长模式" 策略配置引擎

## Objective
依据 `设置策略1_d1ff7c96.png` 与相关策略设计稿，实现“AI自动交易”与“价格增长模式”的前端策略参数配置、校验与本地持久化引擎。

## Scope
- **AI 自动交易配置面板**:
  - 买入/卖出独立启停开关与状态指示。
  - 防夹子（Anti-sandwich）开关、防貔貅（Anti-honeypot）检测开关、滑点保护开关。
  - 单次交易随机上限值 / 下限值步进微调器（`CyberStepper`）。
  - 触发价格上限 / 价格下限阈值设置。
  - 扣税比例设置（%）。
- **价格增长模式 (Price Growth Strategy) 面板**:
  - 启停开关与运行状态（当前基准价、目标价格、运行状态）。
  - 每日涨幅百分比目标（默认 5%）。
  - 执行时长（如 12 小时）与执行间隔（如 30 分钟）。
  - 每日 0 点自动获取基准价格并重新计算目标价格。
- 策略持久化：将所有参数持久化保存在 IndexedDB 或 LocalStorage 中。
- 编写参数校验、边界处理及持久化单元测试。

## Allowed Files
- `src/views/strategy/**`
- `src/strategies/**`
- `tests/unit/strategies/**`
- `docs/AI/tasks/TASK-012.md`

## Dependencies
- TASK-002, TASK-010

## Inputs and Outputs
- **输入**:
  - 用户配置的策略参数
- **输出**:
  - `src/strategies/auto-trade-types.ts` (策略类型定义)
  - `src/strategies/strategy-store.ts` (策略持久化存储)
  - `src/views/strategy/AutoTradePanel.tsx` (AI 自动交易视图)
  - `src/views/strategy/PriceGrowthPanel.tsx` (价格增长模式视图)
  - `tests/unit/strategies/strategy-config.test.ts` (单元测试)

## Acceptance Criteria
1. 表单各开关与 Stepper 步进调节流畅受控，UI 风格严格契合 `设置策略1_d1ff7c96.png`。
2. 页面刷新后策略参数完整保留。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

