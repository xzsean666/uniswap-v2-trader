# TASK-015: 自动化托管交易代理合约与前端专属 Keeper 模块对接

## Objective
在用户完成 `uniswap-v2-trader-contract` 代理合约的编写、测试与部署后，将代理合约 ABI 及链上部署地址对接至本前端 DApp，实现“主钱包（本金隔离） + 前端专属 Keeper（打工小号/Gas燃料号）”的 24/7 免弹窗自动化交易闭环。

> **注意 (Prerequisite)**: 本任务为外部依赖任务。必须在用户开发并成功部署 `uniswap-v2-trader-contract` 到 BSC Testnet（Chain ID 97）并提供合约地址及 ABI 后方可开始执行。

## Scope
1. **Keeper 钱包生成与安全导出模块 (`KeeperManager`)**:
   - 在前端界面提供一键生成本地专属打工小号（Keeper EOA）功能（基于 `ethers/viem` 本地随机生成，存入浏览器安全持久化存储）。
   - 提供【导出私钥】与【复制地址】功能，并附带清晰的明文风险安全提示，方便用户随时备份或跨端导入。
   - 实时监控 Keeper 钱包的 BNB 余额（Gas 燃料余量），当余额低于预警水位（例如 `< 0.003 BNB`）时，界面高亮提醒并提供一键充值引导。
2. **主钱包前置绑定与代理授权流程**:
   - 引导用户主钱包调用代理合约的 `setKeeper(keeperAddress)` 方法，登记该打工小号为专属操作员。
   - 引导用户主钱包对参与交易的代币（如 USDT）向代理合约执行 `approve` 授权（替换原先对 PancakeSwap Router 的直接授权）。
3. **自动化静默交易执行引擎 (`AutomatedKeeperExecutor`)**:
   - 当监控到市场行情命中策略条件（如反买反卖触发点、限价触发点）时，自动使用本地 Keeper 私钥构造并直接向 BSC 节点广播调用代理合约的 `executeSwap` 或 `executeSwapSupportingFeeOnTransferTokens` 方法。
   - 彻底省去 MetaMask 弹窗流程，实现纯前端挂机状态下的零感毫秒级自动成交。
   - 交易产出代币强制回流至主钱包，保证资产绝对安全。
4. **状态反馈与交易记录追溯**:
   - 弹出 Toast 广播通知与 BscScan 交易哈希链接。
   - 扣减与更新本地 Gas 燃料消耗记录，更新事件流。

## Allowed Files
- `src/contracts/**` (导入代理合约 ABI 与配置)
- `src/services/trading/**` (交易分发与 Keeper 自动化执行器)
- `src/context/WalletContext.tsx` 或新建 `src/context/KeeperContext.tsx`
- `src/views/strategy/**` (接入 Keeper 状态展示卡片与挂机开关)
- `src/components/keeper/**` (Keeper 生成、导出与充值组件)
- `tests/**`
- `docs/AI/tasks/TASK-015.md`

## Dependencies
- 外部依赖: `uniswap-v2-trader-contract` 在 BSC Testnet 成功部署并提供 ABI 及合约地址
- TASK-014

## Inputs and Outputs
- **输入**:
  - 代理合约地址与 ABI（来自 `uniswap-v2-trader-contract`）
  - 用户主钱包连接状态与策略配置参数
- **输出**:
  - `src/contracts/proxy-trader.ts` (代理合约 ABI 与配置)
  - `src/services/trading/keeper-manager.ts` (Keeper 密钥生成、持久化与导出)
  - `src/services/trading/keeper-executor.ts` (无弹窗静默交易执行器)
  - 前端 Keeper 状态管理卡片与操作面板
  - 针对 Keeper 生成、绑定与交易执行的单元及集成测试

## Acceptance Criteria
1. 前端可一键生成、导出私钥、导入已有的 Keeper 钱包，并准确展示 BNB 余额与低 Gas 警告。
2. 主钱包可成功发起 `setKeeper` 绑定交易及代币 `approve`。
3. 行情触发时，Keeper 钱包可静默使用本地私钥签名并广播交易至代理合约，交易成功回流代币至主钱包，无需任何用户弹窗。
4. 所有新增测试 PASS，`pnpm run typecheck` 与 `pnpm run build` 0 错误。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`
- `pnpm run build`

## Status
PENDING_EXTERNAL_DEPENDENCY (等待代理合约开发与部署完成)
