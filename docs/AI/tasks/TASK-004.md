# TASK-004: BSC Testnet Multicall3 与 PancakeSwap V2 RPC 客户端

## Objective
利用 `@evm-event-lake/node-sdk` 内置的 `evm-call` 基础设施，构建面向 BSC Testnet (Chapel, 97) 的高可用 RPC 客户端与 Multicall3 批量调用层。支持多节点健康检测、自动故障降级以及对 Multicall3 合约（`0xca11bde05977b3631167028862be2a173976ca11`）的批量调用聚合。

## Scope
- 配置 BSC Testnet 标准合约常量：
  - Multicall3: `0xca11bde05977b3631167028862be2a173976ca11`
  - PancakeSwap V2 Factory: `0x6725F303b657a9451d8BA641348b6761A6CC7a17`
  - PancakeSwap V2 Router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
  - WBNB: `0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd`
- 构建 RPC 节点池管理器：默认主节点 `https://bsc-testnet-rpc.publicnode.com`，备用归档节点 `https://bsc-testnet.drpc.org`。
- 封装通用的 `multicall` 执行器：接收多个合约调用的 target、allowFailure、callData，一次性调用 Multicall3 的 `aggregate3`，并安全解码返回值。
- 封装 JSON-RPC 批量调用通道，为不支持 Multicall 的原生查询提供合并。
- 编写单元测试与对 Mock RPC 的批量调用验证。

## Allowed Files
- `src/evm/**`
- `src/constants/**`
- `tests/unit/evm/**`
- `docs/AI/tasks/TASK-004.md`

## Dependencies
- TASK-001

## Inputs and Outputs
- **输入**:
  - BSC Testnet RPC 列表与 Multicall3 ABI / 地址
- **输出**:
  - `src/constants/contracts.ts` (合约常量定义)
  - `src/evm/rpc-client.ts` (基于 evm-call 的 RPC 客户端)
  - `src/evm/multicall.ts` (Multicall3 批量调用聚合器)
  - `tests/unit/evm/multicall.test.ts` (单元测试)

## Acceptance Criteria
1. 通过 `multicall` 一次网络请求获取多个合约读结果。
2. 遇到节点不可用时能够自动重试或切换候选节点。
3. 单元测试全部通过，`pnpm run typecheck` 0 错误。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

