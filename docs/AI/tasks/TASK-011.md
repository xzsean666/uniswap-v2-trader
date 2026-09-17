# TASK-011: 24小时价格趋势折线图与量化指标分析组件

## Objective
基于本地 IndexedDB 中由 `EVMEventLake` 与 `enrichEvent` 采集的过去 24 小时富化事件数据，构建暗色科技风格的 24 小时价格趋势折线走势图，呈现价格监控器核心数据点（买入价格、数据点数、更新时间、刷新间隔与价格曲线）。

## Scope
- 从 IndexedDB 中按时间序列查询过去 24 小时（按区块高度升序）的 Swap 成交价与区块时间。
- 聚合绘制高响应度暗色 Canvas / SVG 趋势图表：
  - 荧光绿/青色趋势折线（带微弱发光阴影与面积渐变填充）。
  - X 轴时间刻度（如 00:00, 04:00, 08:00, 12:00, 16:00, 20:00）。
  - Y 轴价格刻度与鼠标悬浮 Tooltip（显示具体区块、时间、成交价）。
- 顶部指标卡：买入价格、24h 数据点数（如 217 个）、最后更新时间、更新间隔。
- 编写数据聚合与趋势计算的单元测试。

## Allowed Files
- `src/views/price-trend/**`
- `src/components/chart/**`
- `tests/unit/views/**`
- `docs/AI/tasks/TASK-011.md`

## Dependencies
- TASK-007, TASK-010

## Inputs and Outputs
- **输入**:
  - 本地 IndexedDB 历史与增量富化事件
- **输出**:
  - `src/views/price-trend/PriceTrendView.tsx` (价格走势视图)
  - `src/components/chart/CyberTrendChart.tsx` (暗色折线图组件)
  - `tests/unit/views/price-trend.test.ts` (单元测试)

## Acceptance Criteria
1. 图表能够在暗色背景下清晰流畅绘制 24 小时价格波动轨迹。
2. 数据点数与价格指标与本地 IndexedDB 真实存储一致。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

