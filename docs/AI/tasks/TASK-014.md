# TASK-014: 链上交易调用分发器、钱包签名广播与全链路集成测试

## Objective
串联各模块，完成策略触发后的真实链上交易发起流程。通过已连接的 Web3 钱包（MetaMask/OKX/Rabby）请求用户对 PancakeSwap Router 合约或自定义代理合约的 Swap 方法进行授权（Approve）与交易签名广播，并完成全链路端到端验证与生产环境构建。

## Scope
- ERC-20 代币授权服务（`checkAndApprove`）：
  - 检查当前钱包针对 PancakeSwap Router 的 allowance。
  - 若额度不足，发起 `approve` 交易签名请求。
- 交易组装与分发器（`swapDispatcher`）：
  - 组装 `swapExactTokensForTokens`、`swapTokensForExactTokens` 或用户自定义合约代理方法参数。
  - 结合滑点保护计算最小获得数量（`amountOutMin`）及 Deadline。
  - 调用 `walletClient.sendTransaction` 或合约 `writeContract` 请求钱包签名广播。
  - 监听交易收据（Transaction Receipt）并弹出执行结果通知。
- 全链路集成测试与构建验证：
  - 验证端到端各环节状态转换。
  - 执行 `pnpm test`、`pnpm run typecheck`、`pnpm run build`。

## Allowed Files
- `src/services/trading/**`
- `src/components/notification/**`
- `tests/integration/**`
- `docs/AI/tasks/TASK-014.md`

## Dependencies
- TASK-003, TASK-013

## Inputs and Outputs
- **输入**:
  - 触发的交易指令（买入/卖出、数量、滑点）
  - 用户连接的 Web3 钱包客户端
- **输出**:
  - `src/services/trading/trade-dispatcher.ts` (交易分发与组装服务)
  - `src/services/trading/token-approval.ts` (代币授权管理)
  - `tests/integration/full-flow.test.ts` (全流程集成测试)

## Acceptance Criteria
1. 正确校验与发起代币授权及 Swap 交易签名。
2. 交易状态（Pending, Success, Failed）在 UI 上有明确提示与 Hash 链接。
3. 全链路测试与生产打包 100% 通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`
- `pnpm run build`

## Status
DONE
