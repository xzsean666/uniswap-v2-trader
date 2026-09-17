# 代理交易合约上下文与本地联调手册 (Contract Context & Local Integration)

## 1. 合约仓库基础信息
- **仓库本地路径**: `/ssd0/git/uniswap-v2-trader-contract`
- **GitHub 远端**: `https://github.com/xzsean666/uniswap-v2-trader-contract.git`
- **指定 GitHub 账号**: `xzsean666` (根据全局路由规范)
- **技术栈**: Solidity `>=0.8.20` + Hardhat + viem + OpenZeppelin Contracts v5 + TypeScript SDK (`@uniswap-v2-trader/sdk`)

---

## 2. 核心架构与安全公理 (Architecture & Security Invariants)

### 2.1 双钱包资产隔离模型 (Dual-Wallet Asset-Isolated Pattern)
```
+-------------------------------------------------------------------------+
|                              用户主钱包 (Master EOA)                     |
|  - 拥有本金资产 (USDT / BNB / 代币)                                      |
|  - 调用 setKeeper(keeper) 授权打工小号操作权                              |
|  - 调用 approve(proxyTrader, amount) 授予代币额度                        |
|  - 强制作为交易产物的唯一接收者 (to = user)                              |
+-------------------------------------------------------------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
               v                                           v
+-----------------------------+             +-----------------------------+
|    打工小号 (Keeper EOA)     |             |    UniswapV2ProxyTrader     |
| - 仅存放微量 Gas 燃料 (BNB)  |             |  - immutable router 锁定    |
| - 浏览器本地私钥静默免弹窗签名| ----------> |  - 校验 keepers[user] 权限   |
| - 无任何资金转移/提现权限   | (executeSwap) |  - safeTransferFrom 拉取代币 |
+-----------------------------+             |  - 兑换产物 100% 回流 user   |
                                            +-----------------------------+
                                                           |
                                                           v
                                            +-----------------------------+
                                            |   DEX Router (PancakeSwap)  |
                                            +-----------------------------+
```

### 2.2 核心链上安全公理
1. **Zero-Theft Invariant (绝对资金归属公理)**:
   - 任何交易产物（TokenB / WBNB）在 Router 兑换时的 `to` 参数强制写死为 `user`，代理合约不留存任何代币（`Zero-Residual`）。
   - Keeper 私钥即便彻底泄露，黑客也无法转移或窃取用户一分钱资产。
2. **Immutable Router Invariant (路由防钓鱼公理)**:
   - DEX Router 地址在部署时通过构造函数初始化为 `immutable`，严禁由 Keeper 动态传入未经验证的 Router 地址。
3. **Fee-On-Transfer Delta Invariant (扣税代币差量公理)**:
   - 支持转账扣税代币（Fee-on-transfer），通过 `balanceAfter - balanceBefore` 计算实际到账金额后再向 Router 发起兑换，并在 `executeSwapSupportingFeeOnTransferTokens` 中严格核验用户实际净收入不低于 `amountOutMin`。
4. **CEI & 重入防护**:
   - 严格遵循 Checks-Effects-Interactions 范式，核心方法全量挂载 OpenZeppelin `nonReentrant`。

---

## 3. 合约方法与 ABI 规范 (Contract Interface)

### 3.1 核心方法清单
| 方法名 | 访问控制 | 作用说明 |
| :--- | :--- | :--- |
| `setKeeper(address keeper)` | 任意用户 (Master EOA) | 设置调用者的专属打工小号。禁止为零地址、自身地址或合约自身。触发 `KeeperUpdated` 事件。 |
| `removeKeeper()` | 任意用户 (Master EOA) | 撤销调用者的打工小号绑定。触发 `KeeperRemoved` 事件。 |
| `keepers(address user)` | View (公共只读) | 查询指定主钱包当前绑定的 Keeper 地址。 |
| `router()` | View (公共只读) | 查询当前绑定的不可变 DEX 路由合约地址。 |
| `executeSwap(address user, address[] calldata path, uint256 amountIn, uint256 amountOutMin, uint256 deadline)` | 仅授权 Keeper (`msg.sender == keepers[user]`) | 为指定主钱包静默执行标准代币兑换，产物全额回流给 `user`。 |
| `executeSwapSupportingFeeOnTransferTokens(address user, address[] calldata path, uint256 amountIn, uint256 amountOutMin, uint256 deadline)` | 仅授权 Keeper (`msg.sender == keepers[user]`) | 为指定主钱包静默执行支持扣税代币的兑换，产物全额回流给 `user`。 |

### 3.2 部署记录 (Deployments)
| 网络 | Chain ID | 合约地址 | 对应 Router |
| :--- | :---: | :--- | :--- |
| **Hardhat Localhost** | `31337` | `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512` | `0x5fbdb2315678afecb367f032d93f642f64180aa3` (MockRouter) |
| **BSC Testnet** | `97` | `0x3c43ac2680e9a4fc387a31ea47f9a88eee8b1b13` | `0xD99D1c33F9fC3444f8101754aBC46c52416550D1` (PancakeSwap V2 Router) |
| **BSC Mainnet** | `56` | 待生产部署 | `0x10ED43C718714eb63d5aA57B78B54704E256024E` |

---

## 4. 本地联调与集成测试操作指南 (Local Integration Guide)

### 4.1 一键自动化联调脚本 (One-Click Scripts)
前端工程内已内置开箱即用的全自动与交互式联调脚本，免去手动操作多终端的繁琐步骤：

1. **全自动端到端联调测试 (推荐)**:
   ```bash
   pnpm test:local
   # 等价于: ./scripts/test-local-integration.sh
   ```
   - **自动检测与托管**: 探测本地 `8545` 端口，如未启动则自动在后台拉起 Hardhat 节点。
   - **全自动部署**: 自动编译并向本地链部署 `MockRouter` 与 `UniswapV2ProxyTrader`。
   - **真实链上断言**: 自动运行 `tests/integration/live-local-node.test.ts`，验证主钱包、打工小号生成、Gas 转账、链上绑定、代币授权、免弹窗静默兑换及资金强制回流主钱包。
   - **退出自清理**: 测试通过后自动释放进程与端口。

2. **一键启动本地交互开发节点 (用于浏览器/MetaMask联调)**:
   ```bash
   pnpm node:local
   # 等价于: ./scripts/start-local-node.sh
   ```
   - 启动 Hardhat 本地节点，自动部署代理合约。
   - 终端清晰打印 RPC 节点、代理合约地址，以及已充值 10000 ETH 的测试主钱包私钥（可直接导入 MetaMask）。
   - 按 `Ctrl + C` 可随时安全退出。

---

### 4.2 手动逐步联调指南 (Manual Step-by-Step)

若需要分步调试，可按以下流程操作：

#### 步骤 1: 启动本地 Hardhat 节点
打开终端，进入合约仓库并启动节点：
```bash
cd /ssd0/git/uniswap-v2-trader-contract
pnpm hardhat node
```
- 本地 RPC 节点地址: `http://127.0.0.1:8545`
- 链 ID: `31337`
- 默认提供 20 个已充值 10000 ETH 的测试账号。

### 步骤 2: 部署代理合约与 Mock 路由至本地网络
在另一终端窗口执行部署脚本：
```bash
cd /ssd0/git/uniswap-v2-trader-contract
pnpm hardhat run scripts/deploy.ts --network localhost
```
脚本会自动部署 `MockRouter` 并部署 `UniswapV2ProxyTrader`，合约地址记录在 `deployments/31337.json`：
```json
{
  "network": "hardhat",
  "chainId": 31337,
  "contractAddress": "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
  "routerAddress": "0x5fbdb2315678afecb367f032d93f642f64180aa3",
  "deployer": "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
}
```

### 步骤 3: 运行合约全量验证
```bash
cd /ssd0/git/uniswap-v2-trader-contract
pnpm test
```
将自动执行编译、SDK 构建与 26 个针对资金安全、滑点保护、扣税计算与 SDK 客户端的单元测试。

### 步骤 4: 前端 DApp 本地联调模式接入
1. **网络连接**:
   - 在前端 DApp 中，当连接链 ID 为 `31337` 时，RPC 自动切换至 `http://127.0.0.1:8545`；当链 ID 为 `97` 时连接 BSC Testnet 公共节点池。
2. **代理合约解析**:
   - `DEFAULT_PROXY_TRADER_ADDRESS[31337]` = `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`
   - 用户也可以在前端界面自定义输入已部署的合约地址。
3. **联调流程验证**:
   - 主钱包连接后，生成专属 Keeper（私钥存于浏览器本地）。
   - 点击“绑定 Keeper 到代理合约”，主钱包发起 `setKeeper` 交易。
   - 主钱包为交易代币向代理合约发起 `approve` 授权。
   - 触发反向交易或自动交易，由前端 Keeper 使用其本地私钥直接调用 `executeSwap`，零钱包弹窗完成交易。
