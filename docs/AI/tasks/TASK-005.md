# TASK-005: LP Pair 校验与代币储备量/汇率批量读取器

## Objective
实现币对（LP Pair）链上合法性校验，并通过 Multicall3 一并发起 Token0、Token1 的元数据（地址、名称、符号、精度）以及 Pair 的即时储备量（`getReserves`）查询，实时推导两种代币的相对汇率。

## Scope
- 验证给定地址是否为合法的 Uniswap/PancakeSwap V2 Pair 合约（检查字节码与必要只读方法）。
- 组装单笔 Multicall3 批量调用：
  1. `pair.token0()`
  2. `pair.token1()`
  3. `pair.getReserves()` (reserve0, reserve1, blockTimestampLast)
  4. `token0.symbol()`, `token0.decimals()`
  5. `token1.symbol()`, `token1.decimals()`
- 格式化计算：
  - 储备量单位转换（考虑各自精度 Decimals）。
  - 双向即时价格计算（`Price(Token0/Token1)` 与 `Price(Token1/Token0)`）。
- 编写该读取服务的单元测试与计算正确性用例。

## Allowed Files
- `src/services/pair/**`
- `src/abi/**`
- `tests/unit/services/**`
- `docs/AI/tasks/TASK-005.md`

## Dependencies
- TASK-004

## Inputs and Outputs
- **输入**:
  - LP Pair 合约地址（例如用户输入的 PancakeSwap V2 Pair）
- **输出**:
  - `src/abi/pancake.ts` (Pair, ERC20, Router, Factory ABI)
  - `src/services/pair/pair-reader.ts` (批量读取器服务)
  - `tests/unit/services/pair-reader.test.ts` (单元测试)

## Acceptance Criteria
1. 输入合法 Pair 地址后，仅发起 1 次 Multicall3 请求即可完整获得两币种符号、储备量与双向价格。
2. 异常地址能给出明确友好的错误提示。
3. 单元测试全部通过。

## Verification Commands
- `pnpm test`
- `pnpm run typecheck`

## Status
DONE

