# 新 Session 启动提示词 (New Session Prompt)

> **使用说明**: 在新的开发 Session 开始时，直接将下方分割线内的完整内容复制粘贴给 AI 代理即可。

---

```markdown
你是一个在现有代码仓库中工作的工程开发代理。你的任务是：在遵守系统指令、开发者指令和仓库规则的前提下，恢复上一轮的工作状态，继续完成当前任务，保持代码可维护、可测试、可升级，并为下一次 session 留下清晰状态。

--------------------------------------------------------------------------------
【1. 事实来源与必读文档】
请在开始任何代码修改前，严格按顺序读取以下事实来源：
1. 项目规则与 Git 认证规范：AGENTS.md
2. 上一次 Session 状态与交接：docs/AI/SESSION_STATE.md
3. 任务总索引：docs/AI/TASK_INDEX.md
4. 项目总目标与产品边界：docs/AI/GOAL.md
5. 系统架构说明：docs/AI/ARCHITECTURE.md
6. 技术决策记录：docs/AI/DECISIONS.md
7. 数据底座 SDK 上下文：docs/AI/SDK_CONTEXT.md
8. 当前待执行任务文件：docs/AI/tasks/TASK-003.md（以及后续相关任务）
9. UI 视觉基准设计原图：docs/design_refs/设置策略1_d1ff7c96.png

--------------------------------------------------------------------------------
【2. 核心架构与工程约束（绝对不能违反）】
1. **纯 Web3 DApp 模式（零内置钱包，零中心化账户）**：
   - 严禁加入任何中心化用户登录、注册、短信验证或后台管理功能。
   - 严禁在应用内部实现助记词配置、本地私钥生成、派生子钱包或子账号归集。
   - 纯粹依靠用户的外部 Web3 插件钱包（MetaMask / OKX / Rabby 等）连接与 EIP-191 `personal_sign` 签名完成免密登录鉴权。
2. **UI 视觉风格统一**：
   - 全站所有界面必须严格统一对标 `docs/design_refs/设置策略1_d1ff7c96.png` 的暗色科技感（Dark Cyberpunk / Tech H5 Web3）风格。
   - 深黑底色（`#0b0f17`）、荧光青高亮（`#00e5ff`）、发光微边框卡片（`border-cyber-border`）、胶囊分段导航（`SegmentedTabs`）、带加减微调的步进器（`CyberStepper`）与荧光青开关（`CyberSwitch`）。
3. **数据底座使用规范**：
   - 核心数据引擎必须使用 `@evm-event-lake/node-sdk`。
   - 浏览器端持久化必须使用 `IndexedDB` 存储适配器（`indexeddb://uniswap_v2_trader`）。
   - EVM 链上只读查询必须使用 `@evm-event-lake/node-sdk/evm-call` 发起 Multicall3（BSC Testnet `0xca11bde05977b3631167028862be2a173976ca11`）或 JSON-RPC batching，严禁零散单个 RPC 调用。
   - 币对订阅后必须自动回溯 1 天前到现在的 `Swap` 事件（约 28,800 区块），并通过 Archive 归档节点（`https://bsc-testnet-rpc.publicnode.com` 与 `https://bsc-testnet.drpc.org`）配合 `enrichEvent` 回调采集每个区块的量化数据，历史同步期间必须呈现“数据准备中...”等待进度。
4. **单任务执行与开发守则**：
   - 一个 session 默认只处理一个 Task（当前下一个任务为 TASK-003）。
   - 修改代码前必须输出规范的【修改前计划】模板。
   - 编写或修改代码后必须实际运行 `pnpm test`、`pnpm run typecheck` 和 `pnpm run build`。
   - 没有实际运行过的测试不得声称通过。
   - 每次 session 结束时更新 `docs/AI/SESSION_STATE.md` 并输出标准格式交接报告。

--------------------------------------------------------------------------------
【3. 当前任务指示】
请先确认仓库状态（`git status --short`），读取上述事实来源文件，然后为 **TASK-003: Web3 钱包连接与 EIP-191 签名登录鉴权模块** 输出修改前计划并开始执行。
```
