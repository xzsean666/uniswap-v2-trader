# 重要技术决策记录 (Architectural Decision Records)

## ADR-001: 纯客户端 Web3 DApp 架构与去中心化存储
- **状态**: Accepted
- **背景**: 蓝湖设计中包含了大量传统 Web2 SaaS 功能（用户中心、手机验证码、企业团队管理、分销返佣等）。而在真实量化场景下，交易员需要的是低延迟、私密、无需信任第三方的工具。
- **决策**:
  - 全面剔除中心化后端与用户数据库。
  - 核心持久化使用浏览器的 `IndexedDB`（通过 `@evm-event-lake/node-sdk` 的 `indexeddb://` 存储引擎）。

## ADR-002: 前端技术栈采用 Vite + React 19 + Tailwind CSS + shadcn 规范
- **状态**: Accepted
- **背景**: 项目为 H5 / Web3 DApp，需要高度契合设计规范，并具备极高响应速度。
- **决策**:
  - 构建工具: Vite。
  - UI 框架: React 19 + TypeScript。
  - 样式规范: Tailwind CSS + shadcn-ui 风格组件（使用 `clsx`, `tailwind-merge`, `lucide-react`）。

## ADR-003: 链上数据读取与事件同步双引擎架构
- **状态**: Accepted
- **决策**:
  - **实时状态读取**: 采用 `@evm-event-lake/node-sdk` 内置重导出的 `evm-call`。严格禁止单次发起孤立 RPC 请求，必须通过 Multicall3（BSC Testnet 地址 `0xca11bde05977b3631167028862be2a173976ca11`）或 JSON-RPC batching 进行合并调用。
  - **历史与增量事件**: 采用 `EVMEventLake` 引擎写入本地 `IndexedDB`。用户输入 Pair 后自动回溯过去 1 天（约 28,800 个区块）的 `Swap` 事件，配合 `enrichEvent` 回调从 BSC Archive 归档节点中计算落库量化数据。

## ADR-004: BSC 测试网与 Archive 归档节点选型
- **状态**: Accepted
- **决策**:
  - 默认 RPC 池优先使用已实测验证支持 28,800+ 区块状态深度回溯的归档节点：
    - `https://bsc-testnet-rpc.publicnode.com`
    - `https://bsc-testnet.drpc.org`
  - 内置自动测速与故障切换机制（Failover）。

## ADR-005: 数据底座 SDK 的引入与版本追踪策略
- **状态**: Accepted
- **决策**:
  - 在 `package.json` 中通过 git 引用声明 `@evm-event-lake/node-sdk`。
  - 在 `docs/AI/SDK_CONTEXT.md` 中单独记录 commit hash、功能接口说明及变更规范。每次底座发生修改时，同步更新 hash 与上下文记录。

## ADR-006: 纯钱包签名登录模式与零内置钱包存储原则
- **状态**: Accepted
- **背景**: 用户明确指示本项目不带内置钱包管理功能（如助记词派生、私钥导出、子钱包生成等），也不设中心化用户系统，完全依靠用户现有 Web3 插件钱包连接与签名登录。
- **决策**:
  - 彻底去除应用内的助记词配置、多子钱包派生及资金归集模块。
  - 使用 `window.ethereum` 请求连接用户钱包（MetaMask, OKX, Rabby 等）。
  - 登录校验采用标准 EIP-191 个人签名 (`personal_sign`) 模式。所有链上 Swap 操作均由用户钱包直接弹出授权或发往已配置的代理合约。

## ADR-007: 统一采用暗色科技风 (Dark Cyberpunk H5) 视觉规范
- **状态**: Accepted
- **背景**: 用户指定以 `docs/design_refs/设置策略1_d1ff7c96.png` 为全站统一风格基准。
- **决策**:
  - 风格基调: 深黑墨蓝背景（`#0b0f17`）、高饱和荧光青/蓝绿色调（`#00e5ff` / `#22d3ee`）、发光微边框圆角卡片（`border border-cyan-500/20`）。
  - 控件基准: 统一采用胶囊型分段导航栏（Segmented Tabs）、带微调加减按钮的数值输入器（Stepper）、高亮荧光色滑动开关（Switch）与渐变操作按钮。

## ADR-008: 全局安全、性能与跨视图币对状态同步强化
- **状态**: Accepted
- **背景**: 在系统全面审计中，识别出四项关键工程改进点：
  1. **构建包体与性能**: Vite 默认产物超过 500kB 触发 Rollup 告警；批量 RPC 请求缺失故障转移；高频日志事件易引发 RPC 洪峰。
  2. **状态割裂**: “监听Swap”与“设置策略”视图在标签页切换时私有状态丢失，策略面板无法获取真实币对元数据与精度。
  3. **安全与数值精度**: 策略交易硬编码 18 精度在应对 6 精度或 8 精度代币（如 USDC/WBTC）时会发生严重数值截断；代理合约交易未正确匹配 Spender 授权；有税代币滑点容差计算未动态覆盖扣税。
- **决策**:
  - **性能强化**:
    - 配置 Vite `rollupOptions.output.manualChunks` 拆分 `vendor-react`、`vendor-viem`、`vendor-icons` 与 `vendor-lake`，主 bundle 压缩至约 115kB。
    - 为 `requestJsonRpcBatch` 补全同等的多 RPC 故障切换与重试机制。
    - 在 `SwapInfoView` 中对 `new_swap` 刷新增加 400ms 防抖。
    - 轮询器增量事件采用时间正序发射，确保前端列表渲染按倒序正确呈现最新事件。
  - **跨视图状态统一**:
    - 引入全局 `ActivePairContext`，在顶级维护当前活跃币对、代币元数据、代理合约配置及事件流，实现全站标签切换零损耗。
  - **安全与交易强化**:
    - 策略执行全面升级为动态代币精度（`decimalsIn` / `decimalsOut`），并通过 `formatUnits` 进行大数归一化，杜绝 JS Number 溢出。
    - 动态 Spender 授权：直连交易授权 PancakeSwap Router，代理模式授权用户自定义代理合约。
    - 动态滑点计算自动将代币税率（`taxRate`）计入容差空间，彻底防止有税代币链上执行 Revert。

## ADR-009: 全系统深度安全防篡改、多链 RPC 动态容灾与交易逻辑加固
- **状态**: Accepted
- **背景**: 2026-09-17 深度全项目审计中识别出以下关键风险：
  1. **本地会话防篡改风险**: `WalletContext` 读取 localStorage 中的 AuthSession 未重新验证签名真伪，且未联动校验活跃插件钱包的 `eth_accounts`。
  2. **Keeper 私钥内存与操作安全**: 私钥明文存储缺乏清除覆盖（zero-fill memory wipe），导出私钥缺乏显式安全警示。
  3. **多链 RPC 路由错位**: RPC 客户端硬编码 BSC Testnet，导致切换主网 (56) 或本地节点 (31337) 时状态查询依然发送至测试网。
  4. **交易致命回退缺陷**: 反向交易预估输出在缺失时回退为 `amountInBigInt`，在非 1:1 汇率或多精度代币兑换时会导致严重滑点穿仓或链上 Revert。
  5. **事件流与 SVG 性能**: 轮询器缺少基于 `txHash:logIndex` 的滑动窗口去重；折线图 SVG 缺乏 `useMemo` 导致频繁重算。
- **决策**:
  - **安全加固**:
    - 引入 `validateSessionTamperProof`，在会话恢复时进行密码学签名真伪校验；同步核验 provider `eth_accounts`，账户变更立即自失效旧会话。
    - 强化私钥格式规范化（校验非零私钥 `normalizePrivateKey`），并在小号清除时执行内存置零擦除。
    - 代币授权增加 `Spender` 零地址前置拦截。
  - **多链 RPC 动态容灾**:
    - 扩展 `contracts.ts` 与 `rpc-client.ts`，支持 BSC Testnet (97)、BSC Mainnet (56) 与 Localhost (31337) 的自动化 RPC 池解析与多端点指数退避 Failover。
  - **交易与量化逻辑严格化**:
    - 彻底移除 `expectedOut = simResult.expectedAmountOut || amountInBigInt` 危险回退，改为强制校验 `expectedAmountOut > 0n`，不足或无效时前置终止交易并向用户预警。
    - 价格下限拦截提示引入动态自适应精度格式化，解决低单价代币截断显示为 0.0000 的体验问题。
    - 为自动交易引擎互斥锁（`isInFlightRef`）增加 60 秒看门狗（Watchdog），防止异常网络中断引发死锁。
  - **前端渲染与事件优化**:
    - 在 `realtime-poller` 与 `ActivePairContext` 引入双层滑动窗口事件去重（LRU Set），消除重复日志广播与 React Key 警告。
    - `CyberTrendChart` SVG 计算逻辑全面挂载 `useMemo`，消灭高频渲染掉帧。

