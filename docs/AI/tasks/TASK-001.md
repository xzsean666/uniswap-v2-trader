# TASK-001: 项目工程脚手架构建、AI工作文档体系与SDK底座集成

## Objective
建立 `uniswap-v2-trader` 项目的完整开发环境与规范化 AI 协作文档体系。配置 Vite + React 19 + TypeScript + Tailwind CSS + Viem + Vitest 构建体系，配置并验证底座 `@evm-event-lake/node-sdk` 的引入与基础类型/单元测试环境。

## Scope
- 创建规范的 `docs/AI` 工作文档体系与 `AGENTS.md`。
- 初始化 `package.json`，配置依赖：
  - React 19, React-DOM 19
  - TypeScript, Vite, `@vitejs/plugin-react`
  - Tailwind CSS, PostCSS, Autoprefixer, clsx, tailwind-merge, lucide-react
  - Viem, `@evm-event-lake/node-sdk`
  - Vitest, fake-indexeddb
- 配置 Vite 浏览器构建策略，处理 Rollup 对可选原生库（better-sqlite3, pg）的动态分析。
- 编写基础脚手架单元测试，验证测试体系与类型系统工作正常。

## Allowed Files
- `AGENTS.md`
- `docs/AI/**`
- `package.json`
- `pnpm-lock.yaml`
- `tsconfig.json`
- `tsconfig.node.json`
- `vite.config.ts`
- `vitest.config.ts`
- `tailwind.config.js`
- `postcss.config.js`
- `index.html`
- `src/**`
- `tests/**`

## Dependencies
None.

## Inputs and Outputs
- **输入**:
  - 用户业务目标、蓝湖 UI 设计规范、SDK 底座 `/ssd0/git/EVMEventLake-Node-SDK` (commit `d614d8c12c9ac7bbe0a1bb08053258ea5a0c357d`)
- **输出**:
  - 完整且可运行的 Vite + React + Tailwind 脚手架
  - 可通过的单元测试 `tests/unit/scaffold.test.ts`
  - 正确的构建产物 `dist/`

## Acceptance Criteria
1. `pnpm install` 成功，依赖解析正常。
2. `pnpm run typecheck` 无类型错误。
3. `pnpm test` 单元测试通过。
4. `pnpm run build` 打包成功无报错。
5. `docs/AI/SESSION_STATE.md` 更新至当前任务进度。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`
- `pnpm run build`

## Risks and Assumptions
- 假定使用 Node.js 24 和 pnpm 11。
- Vite 打包需配置 external 或 resolve 别名，避免 node 原生库 better-sqlite3 在前端构建时触发报错。

## Status
DONE
