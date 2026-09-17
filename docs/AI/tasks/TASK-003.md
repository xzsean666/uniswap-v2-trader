# TASK-003: Web3 钱包连接与 EIP-191 签名登录鉴权模块

## Objective
实现标准纯 Web3 钱包连接与签名鉴权机制。使用户无需输入账号密码或在客户端存储私钥，直接通过浏览器注入式钱包（`window.ethereum`，如 MetaMask / OKX / Rabby）连接，自动校验并引导切换至 BSC Testnet（Chain ID: 97），并通过 EIP-191 签名完成免密登录状态确立。

## Scope
- 检测并抽象 `window.ethereum` EIP-1193 钱包提供者。
- 实现钱包连接逻辑：获取主账户地址、网络 Chain ID。
- 实现网络检测与自动切换：若非 BSC Testnet (97)，发起 `wallet_switchEthereumChain`，若未添加则发起 `wallet_addEthereumChain`（RPC: `https://bsc-testnet-rpc.publicnode.com`）。
- 实现 EIP-191 消息签名登录（`personal_sign`），确立客户端当前认证会话。
- 监听账户变更（`accountsChanged`）与网络变更（`chainChanged`），并提供断开连接能力。
- 编写钱包连接状态 React Hook (`useWallet`) 与对应单元测试。

## Allowed Files
- `src/wallet/**`
- `src/hooks/**`
- `tests/unit/wallet/**`
- `docs/AI/tasks/TASK-003.md`

## Dependencies
- TASK-002

## Inputs and Outputs
- **输入**:
  - `window.ethereum` 提供者
  - BSC Testnet 参数（Chain ID: 97, Name: "BSC Testnet", RPC: `https://bsc-testnet-rpc.publicnode.com`, Explorer: `https://testnet.bscscan.com`）
- **输出**:
  - `src/wallet/ethereum.ts` (EIP-1193 适配封装)
  - `src/wallet/auth.ts` (签名消息生成与校验)
  - `src/hooks/useWallet.ts` (React Context & Hook)
  - `tests/unit/wallet/wallet.test.ts` (单元测试)

## Acceptance Criteria
1. 成功模拟或真实触发钱包连接与地址格式化展示（如 `0x8Fd3...4A2b`）。
2. 支持链 ID 校验，非 97 时提供切换指示。
3. 签名流程符合 EIP-191 标准，断开连接可完全清除登录状态。
4. 单元测试覆盖率正常，`pnpm run typecheck` 0 错误。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

