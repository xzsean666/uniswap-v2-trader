# TASK-009: "监听Swap" 交互视图与实时事件流看板

## Objective
依据暗色科技风设计规范（`设置策略1_d1ff7c96.png` 的基准色调与控件风格，结合 `监控操作 Swap` 和 `监听 swap1` 的业务逻辑），实现“监听Swap”主界面。提供 LP Pair 地址输入、开启/停止监听操作、自定义合约调用配置，以及最新 Swap 交易事件的实时滚动列表展示。

## Scope
- 页面表单区：
  - “输入 LP Pair 地址 [必填]” 输入框。
  - 操作按钮：“加载 swap 并监听”（亮青科技高亮）与“停止监听”。
  - “最新交易事件显示数量” 步进微调输入。
  - “使用自定义合约” 开关与下拉输入区（自定义合约地址、调用方法名 `swapExact...Tokens`、重要提示黄色小标）。
- 监听中状态交互：
  - 若处于 24h 历史回溯阶段，呈现科技感“数据准备中（已同步 X% / 当前区块 Y）”环形/进度指示。
  - 数据就绪后，呈现“● 监听中 (实时区块流)”。
- 实时交易事件流列表：
  - 列表展示每笔 Swap 的区块高度、交易哈希（带 BscScan 链接）、输入数量、输出数量、成交单价与时间戳。
- 编写该视图的组件测试。

## Allowed Files
- `src/views/swap-monitor/**`
- `src/components/**`
- `tests/unit/views/**`
- `docs/AI/tasks/TASK-009.md`

## Dependencies
- TASK-005, TASK-008

## Inputs and Outputs
- **输入**:
  - 用户输入的 Pair 地址与配置
  - 来自 TASK-008 的实时事件流
- **输出**:
  - `src/views/swap-monitor/SwapMonitorView.tsx` (监控主视图组件)
  - `src/views/swap-monitor/RecentEventsTable.tsx` (最新交易事件展示组件)
  - `src/views/swap-monitor/CustomContractPanel.tsx` (自定义合约配置组件)
  - `tests/unit/views/swap-monitor.test.ts` (单元测试)

## Acceptance Criteria
1. 输入合法 Pair 地址后能顺利触发加载、监听与停止。
2. 历史回溯阶段具有明确的数据准备中等待状态；实时阶段能将新交易以平滑动画呈现在事件列表中。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

