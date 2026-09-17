# TASK-013: "反买反卖" (反向交易) 策略配置与模拟预执行引擎

## Objective
精确还原 `设置策略1_d1ff7c96.png` 中的“反买反卖”核心交易策略面板。支持配置基于价格波动（跌幅/涨幅至指定百分比）触发反向买入或反向卖出的量化规则，并在触发前利用链上静态调用（static call）模拟交易，确保滑点与税率安全。

## Scope
- 买入设置卡片（`↓ 买入设置`）:
  - 启动开关（带帮助提示 `启动 ?`）。
  - 自动买入、滑点保护、防夹子、防貔貅开关（荧光青色 Switch）。
  - 实时价格指示行（`⇄ USDT兑换ACP 实时价格: 0.99365 ACP`）。
  - 单次交易随机上限值 / 下限值调节。
  - 价格下限（`1 USDT 至少兑换 0.5888 ACP`）。
  - 反向触发条件：`↓ USDT价格跌幅至 [5 %]`、`↑ USDT价格涨幅至 [3 %]`（带独立开关）。
  - 设置扣税比例（`1.5 %`）。
  - “应用设置”科技渐变操作按钮。
- 卖出设置卡片（`↑ 卖出设置`）:
  - 镜像对称的卖出反向配置项。
- 模拟预执行逻辑（Dry Run）:
  - 策略条件满足时，先在前端利用 `evm-call` 或 Viem `simulateContract` 测算交易预计输出与税费，若产生异常（如貔貅或滑点超限）则发出警报并放弃执行。
- 编写反向策略计算与模拟逻辑的单元测试。

## Allowed Files
- `src/views/strategy/**`
- `src/strategies/**`
- `tests/unit/strategies/**`
- `docs/AI/tasks/TASK-013.md`

## Dependencies
- TASK-012

## Inputs and Outputs
- **输入**:
  - 用户配置的反买反卖参数与最新实时价格
- **输出**:
  - `src/views/strategy/ReverseTradePanel.tsx` (反买反卖主界面)
  - `src/strategies/reverse-trade-engine.ts` (反向策略判断与模拟引擎)
  - `tests/unit/strategies/reverse-trade.test.ts` (单元测试)

## Acceptance Criteria
1. UI 布局与控件细节 100% 对应 `设置策略1_d1ff7c96.png`。
2. 跌幅/涨幅与数量区间计算准确，模拟检测机制正常。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE
