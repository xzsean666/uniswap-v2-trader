# AGENTS.md

## 项目简介
`uniswap-v2-trader` 是一个基于 Uniswap V2 / PancakeSwap V2 协议的自动化量化交易 Web3 DApp。项目参考蓝湖设计规范构建，去除了繁冗的 SaaS 多用户、注册登录及分销返佣等功能，专注纯客户端 Web3 模式下的币对订阅、区块事件数据底座同步、价格监控趋势与自动化/反向交易策略执行。

---

## 事实来源 (Single Source of Truth)
本仓库遵循规范化的 AI 代理协作开发协议，以下文件为项目事实来源：
- 项目总目标：[docs/AI/GOAL.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/GOAL.md)
- 任务索引：[docs/AI/TASK_INDEX.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/TASK_INDEX.md)
- 当前会话状态：[docs/AI/SESSION_STATE.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/SESSION_STATE.md)
- 架构设计：[docs/AI/ARCHITECTURE.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/ARCHITECTURE.md)
- 重要决策：[docs/AI/DECISIONS.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/DECISIONS.md)
- SDK 底座维护记录：[docs/AI/SDK_CONTEXT.md](file:///ssd0/git/uniswap-v2-trader/docs/AI/SDK_CONTEXT.md)
- 具体任务详情：`docs/AI/tasks/TASK-xxx.md`

---

## GitHub CLI 与 Git 认证路由规范
根据全局规则，当前仓库位于 `/ssd0/git` 体系下：
- **指定 GitHub 账号**: `xzsean666`
- **执行规范**: 在执行任何涉及 GitHub 鉴权的操作（如 `gh` 命令、`git push` 等）前，必须确认活跃账号为 `xzsean666`：
  ```bash
  gh auth switch --user xzsean666
  ```

---

## 工程约束与代码规范
1. **单任务执行原则**: 每个开发 session 默认只处理一个已明确依赖满足的 Task，禁止扩大范围或一次性跨任务编码。
2. **修改前计划**: 修改业务代码前必须输出计划模板（包含 Request Type、Goal、Files、Acceptance Criteria、Verification 等）。
3. **数据底座使用**:
   - 必须使用 `@evm-event-lake/node-sdk` 作为核心数据引擎。
   - 网页端/客户端必须使用 `IndexedDB` 存储适配器（`indexeddb://uniswap_v2_trader`）。
   - EVM 只读查询优先通过 `evm-call` 进行 `multicall`（Multicall3）或 JSON-RPC batching。
   - 历史回溯与量化指标富化必须通过 `enrichEvent` 并利用 BSC Archive 节点完成。
4. **测试与可验证性**: 没有实际运行过的测试不得声称通过，所有关键逻辑必须提供 Vitest 单元测试或可复现的验证脚本。
5. **Session 恢复与交接**: 每次会话结束时必须更新 `docs/AI/SESSION_STATE.md` 并输出标准交接格式。
