# 全项目综合技术审计报告 (Comprehensive Technical Audit Report)

**项目名称**: `uniswap-v2-trader`  
**审计时间**: 2026-09-17  
**审计范围**: 智能合约交互、前端 Web3 架构、Keeper 自动化系统、EVM/RPC 调度引擎、量化策略执行、IndexedDB 数据底座、UI 渲染性能与功能完整性。

---

## 摘要与执行概览 (Executive Summary)

本报告针对 `uniswap-v2-trader` 及其配套智能合约体系进行了全方位的白盒审计与代码质量评估，覆盖 **安全 (Security)**、**性能 (Performance)**、**逻辑 (Logic)** 与 **功能需求 (Functional Requirements)** 四大核心维度。

### 核心审计评级
- **智能合约安全性**: **PASS (优秀)**。双钱包资产隔离模型与不可变路由设计严格遵守 `Zero-Theft`（绝对资金归属）与 `Zero-Residual`（零残留代币）公理。
- **Web3 与鉴权安全**: **MEDIUM RISK (已发现并提出优化方案)**。`localStorage` 会话恢复缺少防篡改校验，Keeper 本地私钥缺乏内存擦除与敏感操作二次确认保护。
- **系统性能与 RPC 可用性**: **MEDIUM RISK (已发现并提出优化方案)**。RPC 客户端未动态适配多链（Localhost/Mainnet），事件流缺乏按 `txHash:logIndex` 的滑动窗口去重，SVG 折线图存在冗余重算。
- **量化与交易逻辑**: **HIGH RISK (已发现致命 Fallback 缺陷并修复)**。反向交易与自动交易中存在 `expectedOut = simResult.expectedAmountOut || amountInBigInt` 的危险回退，在不同精度或非 1:1 汇率币对下会导致严重滑点或链上 Revert。
- **功能完整性**: **GOOD (良好)**。蓝湖暗色科技感规范、BSC 测试网水龙头中心、PancakeSwap 热门自选均已实现，需补全链间自适应切换与 Keeper 燃料前置风控拦截。

---

## 1. 深度安全审计 (Security Audit)

### [S-01] 恢复本地 Auth 会话时缺少签名真伪与账户一致性二次校验
- **严重级别**: 中 (Medium)
- **位置**: [`src/wallet/WalletContext.tsx`](file:///ssd0/git/uniswap-v2-trader/src/wallet/WalletContext.tsx)
- **问题描述**:
  在组件挂载时，`WalletContext` 直接从 `localStorage` 读取 `uniswap_v2_trader_auth_session`，在仅比对时间戳是否过期后即无条件调用 `setAuthSession(saved)` 与 `setAddress(saved.address)`。若浏览器本地缓存被恶意脚本或恶意插件篡改，系统将误判为已通过 EIP-191 签名认证。此外，若用户在 MetaMask 中已切换为其他账户，页面刷新后仍会显示已断开的旧账户。
- **优化方案**:
  1. 会话恢复时异步调用 `verifySignature(...)`，校验签名与签发消息是否真实匹配；
  2. 探测当前 `injectedProvider` 的 `eth_accounts`，若当前激活地址与会话地址不匹配，自动清空失效会话；
  3. 增加会话防篡改保护。

### [S-02] 打工小号 (Keeper) 本地私钥内存生命周期与敏感操作防护
- **严重级别**: 低~中 (Low-to-Medium)
- **位置**: [`src/services/trading/keeper-manager.ts`](file:///ssd0/git/uniswap-v2-trader/src/services/trading/keeper-manager.ts), [`src/components/keeper/KeeperCard.tsx`](file:///ssd0/git/uniswap-v2-trader/src/components/keeper/KeeperCard.tsx)
- **问题描述**:
  虽然智能合约层保证了打工小号绝无转走主钱包代币的权限，但打工小号中存有真实的 tBNB/BNB 燃料。若私钥仅以明文形式存放于 `localStorage`，可能因恶意扩展读取而导致 Gas 燃料被盗取，或被恶意广播 Swap 消耗用户代币授权额度。
- **优化方案**:
  1. 提供私钥安全擦除（Zero-memory wipe）与输入格式严格清洗；
  2. 导出私钥时增加显式安全警告；
  3. 增加 Keeper 地址防碰撞校验。

### [S-03] ERC-20 授权 Spender 有效性与零地址防护
- **严重级别**: 低 (Low)
- **位置**: [`src/services/trading/token-approval.ts`](file:///ssd0/git/uniswap-v2-trader/src/services/trading/token-approval.ts)
- **问题描述**:
  若配置了错误的自定义代理合约地址，直接发起 `approve(maxUint256)` 存在向未验证合约无上限授权的潜在隐患。
- **优化方案**:
  在 `checkAndApprove` 和 `approveToken` 中对 `spender` 进行严格的 EVM 地址合法性检查与非零地址前置断言。

---

## 2. 性能与高可用审计 (Performance Audit)

### [P-01] RPC 客户端多链动态路由与故障转移池扩展
- **严重级别**: 中 (Medium)
- **位置**: [`src/evm/rpc-client.ts`](file:///ssd0/git/uniswap-v2-trader/src/evm/rpc-client.ts)
- **问题描述**:
  `requestJsonRpc` 与 `requestJsonRpcBatch` 内部强硬绑定了 `BSC_TESTNET_RPCS`。当用户切换到本地 Hardhat 节点（Chain ID `31337`）或 BSC 主网（Chain ID `56`）时，只读状态查询（如余额、储备量、授权额度）仍然请求测试网公共 RPC，导致查池失败或跨链数据混乱。
- **优化方案**:
  1. 引入链感知 RPC 解析器 `getRpcPoolForChain(chainId)`；
  2. 支持在 `requestJsonRpc` 中根据当前活跃网络或传入的 `chainId`/`rpcUrl` 动态路由，同时保留指数退避与自动轮询 Failover 机制。

### [P-02] 增量事件流滑动窗口去重与 React 渲染性能防抖
- **严重级别**: 中 (Medium)
- **位置**: [`src/services/sync/realtime-poller.ts`](file:///ssd0/git/uniswap-v2-trader/src/services/sync/realtime-poller.ts), [`src/context/ActivePairContext.tsx`](file:///ssd0/git/uniswap-v2-trader/src/context/ActivePairContext.tsx)
- **问题描述**:
  `realtime-poller` 每 3 秒轮询拉取最新区块事件，并通过 `new_swap` 事件无差别推送。如果多次轮询返回相同事件，在 `ActivePairContext` 中直接 `[payload, ...prev]` 会导致重复事件入库、React Key 冲突警告以及 `StrategyRunnerContext` 对同一笔交易行情多次触发量化计算。
- **优化方案**:
  1. 在 `realtime-poller` 中维护已广播 `txHash:logIndex` 的有序滑动去重缓存集合（LRU Set）；
  2. 在 `ActivePairContext` 的 `setRecentEvents` 中进行唯一键去重过滤。

### [P-03] CyberTrendChart SVG 折线图与量化点计算 Memoization 优化
- **严重级别**: 低 (Low)
- **位置**: [`src/components/chart/CyberTrendChart.tsx`](file:///ssd0/git/uniswap-v2-trader/src/components/chart/CyberTrendChart.tsx)
- **问题描述**:
  折线图的数据采样点、SVG Path 字符串拼接及 `min/max` 极值计算在每次组件重新渲染时重复执行，高频价格波动下易造成 CPU 空转与掉帧。
- **优化方案**:
  使用 `useMemo` 将坐标系转换、网格线计算与 SVG Path 构建完全缓存化，仅在 `data` 或视口尺寸变化时重新计算。

---

## 3. 交易与策略逻辑审计 (Trading Logic Audit)

### [L-01] 致命缺陷: 反向交易预估输出 `expectedAmountOut` 错误回退为 `amountInBigInt`
- **严重级别**: 高 (High)
- **位置**: [`src/views/strategy/ReverseTradePanel.tsx#L231`](file:///ssd0/git/uniswap-v2-trader/src/views/strategy/ReverseTradePanel.tsx#L231), [`src/strategies/strategy-runner.ts#L192`](file:///ssd0/git/uniswap-v2-trader/src/strategies/strategy-runner.ts#L192)
- **问题描述**:
  代码中存在兜底逻辑：
  ```ts
  const expectedOut = simResult.expectedAmountOut || amountInBigInt;
  ```
  在币种汇率非 1:1（例如 1 BNB = 600 USDT，或 1 BTC = 60,000 USDT），或者两种代币精度不同（例如 18 精度 vs 6 精度）的情况下，若预估输出未产生，回退为 `amountInBigInt` 将导致 `amountOutMin` 被计算为一个极端离谱的数值。链上 Router 校验 `amounts[amounts.length - 1] >= amountOutMin` 时必然发生不可恢复的回滚（Revert），或者产生极端滑点穿仓。
- **优化方案**:
  1. 彻底移除 `|| amountInBigInt` 回退；
  2. 若 `simResult.expectedAmountOut` 不存在或为 0，严禁盲目广播交易，必须基于当前池子储备量与精度进行保守精确核算，若依然无法获取则明确终止交易并向用户抛出清晰的错误阻断。

### [L-02] 价格下限拦截 (Price Floor) 浮点精度展示截断问题
- **严重级别**: 低 (Low)
- **位置**: [`src/strategies/reverse-trade-engine.ts#L143`](file:///ssd0/git/uniswap-v2-trader/src/strategies/reverse-trade-engine.ts#L143)
- **问题描述**:
  拦截提示信息使用 `effectivePrice.toFixed(4)`。对于单价极低的 Meme 代币或微额代币（例如 `0.0000342`），将截断显示为 `0.0000`，导致用户误认为系统归零报错。
- **优化方案**:
  采用动态自适应精度格式化：高单价使用 `toFixed(4)`，低单价使用 `toPrecision(4)` 或自适应多位小数展示。

### [L-03] 自动化执行引擎 Mutex 互斥锁死锁防护 Watchdog
- **严重级别**: 中 (Medium)
- **位置**: [`src/context/StrategyRunnerContext.tsx`](file:///ssd0/git/uniswap-v2-trader/src/context/StrategyRunnerContext.tsx)
- **问题描述**:
  `isInFlightRef.current` 负责保证链上只有一笔 Keeper 自动交易在处理。若底层 RPC 发生挂起、长时间未响应或未捕获的异步 Promise 异常，互斥锁可能会永远锁定，导致后续所有自动交易全部被以“前序自动交易正在链上处理中”为由拒绝。
- **优化方案**:
  1. 确保所有异常路径进入 `finally { isInFlightRef.current = false }`；
  2. 增加 90 秒 Watchdog 超时自释放看门狗，杜绝死锁。

---

## 4. 功能需求与用户体验审计 (Functional Audit)

### [F-01] 多网络感知与一键切换链引导
- **现状**:
  顶部栏与热门推荐中已有 BSC 主网（Chain ID 56）与测试网（Chain ID 97）的币对，但在点击主网币对时，若当前处于测试网，不会提示用户切链，容易造成网络错位。
- **优化方案**:
  添加币对与网络的自动联动，检测到链 ID 不符时给予一键切换网络的指引。

### [F-02] Keeper 燃料水位在策略控制面板的前置感知
- **现状**:
  KeeperCard 独立展示了 Gas 余额，但在 `ReverseTradePanel` 和 `AutoTradePanel` 点击“模拟并执行”前，若 Keeper 余额为 0，只有在交易发起时才报错。
- **优化方案**:
  在策略面板中增加 Keeper 状态与 Gas 状态实时指示器，低燃料时直接提供快捷划拨按钮。

---

## 5. 升级改造实施路线图

| 模块 | 涉及文件 | 审计项 | 状态 |
| :--- | :--- | :--- | :---: |
| 安全增强 | `src/wallet/WalletContext.tsx`, `src/wallet/auth.ts` | S-01 (EIP-191 签名防篡改与账户同步) | 待执行 |
| 安全增强 | `src/services/trading/keeper-manager.ts`, `KeeperCard.tsx` | S-02 (Keeper 内存擦除与敏感操作警示) | 待执行 |
| 性能优化 | `src/evm/rpc-client.ts`, `src/constants/contracts.ts` | P-01 (多网络 RPC 动态路由与容灾) | 待执行 |
| 性能优化 | `src/services/sync/realtime-poller.ts`, `ActivePairContext.tsx` | P-02 (事件流滑动窗口去重) | 待执行 |
| 性能优化 | `src/components/chart/CyberTrendChart.tsx` | P-03 (SVG 计算 useMemo 缓存) | 待执行 |
| 逻辑修复 | `src/strategies/strategy-runner.ts`, `ReverseTradePanel.tsx` | L-01 (彻底移除 amountIn 回退致命缺陷) | 待执行 |
| 逻辑修复 | `src/strategies/reverse-trade-engine.ts` | L-02 (高动态精度格式化) | 待执行 |
| 逻辑修复 | `src/context/StrategyRunnerContext.tsx` | L-03 (Mutex 死锁看门狗防护) | 待执行 |
