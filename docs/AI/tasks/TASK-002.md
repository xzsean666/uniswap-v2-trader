# TASK-002: 暗色科技感 UI 主题与 H5 布局框架规范化

## Objective
严格依据 `docs/design_refs/设置策略1_d1ff7c96.png` 的视觉规范，重构前端整体样式与通用交互组件体系。将应用统一为暗色科技感（Dark Cyberpunk / Tech H5 Web3）风格，提供移动端友好与桌面端适配的布局容器，以及可复用的核心控件库。

## Scope
- 调整 Tailwind 样式系统：配置深黑背景（`#0b0f17`）、荧光青/蓝绿色高光（`#00e5ff` / `#22d3ee`）、发光边框效果（`border border-cyan-500/30 shadow-[0_0_15px_rgba(0,229,255,0.07)]`）、胶囊型容器与渐变按钮样式。
- 构建基础通用控件库：
  - `SegmentedTabs`: 顶部药丸胶囊分段导航（如：`监听Swap` | `设置策略`）。
  - `SubTabs`: 二级文本导航（如：`反买反卖` | `AI自动交易` | `AI套利机器人`）。
  - `CyberCard`: 带科技感发光边框与暗色渐变底色的卡片容器。
  - `CyberSwitch`: 契合设计图的荧光青滑动开关组件。
  - `CyberStepper`: 带加减号微调按钮的数值输入框（如 `[- 100 +]`）。
  - `CyberButton`: 渐变色或荧光色科技按钮。
- 重构 `src/App.tsx` 页面框架：
  - 顶部栏：左侧菜单图标、中间钱包地址与测试网指示灯、右侧网络状态。
  - 主视口：基于当前选中的一级与二级 Tab 动态切换内容区域。
- 编写单元测试验证通用控件在 DOM 渲染、状态变更和样式类名拼接下的正确性。

## Allowed Files
- `src/components/**`
- `src/utils/**`
- `src/App.tsx`
- `src/index.css`
- `tailwind.config.js`
- `tests/unit/components/**`
- `docs/AI/tasks/TASK-002.md`
- `docs/AI/SESSION_STATE.md`

## Dependencies
- TASK-001 (已完成)

## Inputs and Outputs
- **输入**:
  - `docs/design_refs/设置策略1_d1ff7c96.png` 视觉样式标准
- **输出**:
  - `src/components/ui/CyberCard.tsx`
  - `src/components/ui/CyberSwitch.tsx`
  - `src/components/ui/CyberStepper.tsx`
  - `src/components/ui/SegmentedTabs.tsx`
  - `src/components/ui/SubTabs.tsx`
  - 更新后的 `src/App.tsx` 与 `tailwind.config.js`
  - 单元测试 `tests/unit/components/ui.test.ts`

## Acceptance Criteria
1. 全站视觉基调与 `设置策略1_d1ff7c96.png` 一致（纯暗色背景、青色高亮、荧光开关、胶囊导航）。
2. 通用组件（`CyberSwitch`, `CyberStepper`, `SegmentedTabs`）可受控响应交互。
3. 单元测试通过，`pnpm run typecheck` 0 错误，`pnpm run build` 成功。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`
- `pnpm run build`

## Risks and Assumptions
- 确保移动端小屏幕（如 360px 宽度）和桌面端均有良好展示效果。

## Status
DONE
