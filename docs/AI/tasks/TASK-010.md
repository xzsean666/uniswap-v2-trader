# TASK-010: "Swap 信息区" 代币储备与即时汇率卡片

## Objective
依据暗色科技风规范，还原“Swap 信息区”界面。展示当前所监听币对的 Token A 与 Token B 符号、储备量、用户已连接钱包内的代币余额，以及双向即时价格比例，支持最新 Swap 交易消息推送。

## Scope
- Token A 与 Token B 数据双卡片：
  - Token 名称、Symbol（如 USDT / ACP 或 WBNB）。
  - Pair 储备量池（Reserves）。
  - 当前连接钱包的代币余额（通过 `evm-call` multicall 一并刷新）。
  - 当前对价（如 `1 USDT = 0.99365 ACP` 与 `1 ACP = 1.00639 USDT`）。
- 实时刷新与手动强制刷新按钮：
  - 点击刷新可重新执行 Multicall3 读取。
  - 当监听到新 Swap 事件时自动平滑更新数字。
- 编写该组件的单元测试与格式化校验。

## Allowed Files
- `src/views/swap-info/**`
- `tests/unit/views/**`
- `docs/AI/tasks/TASK-010.md`

## Dependencies
- TASK-005, TASK-008

## Inputs and Outputs
- **输入**:
  - 当前监听的 Pair 状态及用户钱包地址
- **输出**:
  - `src/views/swap-info/SwapInfoView.tsx` (信息区视图)
  - `src/views/swap-info/TokenReserveCard.tsx` (单币种卡片)
  - `tests/unit/views/swap-info.test.ts` (单元测试)

## Acceptance Criteria
1. 正确渲染两币种卡片并以青色高亮当前价格。
2. 储备量与钱包余额显示准确无精度溢出。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

