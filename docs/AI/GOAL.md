# 项目总目标 (Project Goal)

## 1. 业务愿景
构建一个高性能、纯 Web3 架构的自动化量化交易与币对监控 DApp (`uniswap-v2-trader`)。应用在视觉上严格统一采用 `docs/design_refs/设置策略1_d1ff7c96.png` 的暗色科技感（Dark Cyberpunk / Tech H5 Web3）风格，专为 Uniswap V2 / PancakeSwap V2 协议量化交易员设计。

**去中心化与极简原则**:
- **不包含任何中心化用户中心或注册登录**。
- **不内置本地私钥生成或助记词派生存储功能**，纯粹依靠用户的外部 Web3 钱包（如 MetaMask / OKX / Rabby 等）进行连接与签名登录（`personal_sign`）。
- 专注于纯客户端模式下的币对订阅、区块事件数据底座同步、价格监控趋势与自动化/反向交易策略配置及执行。

## 2. 核心功能边界

### 2.1 必须包含的功能 (In Scope)
1. **统一的暗色科技风 H5 / Web3 UI 框架**:
   - 严格以 `docs/design_refs/设置策略1_d1ff7c96.png` 为视觉标准（深黑/墨蓝底色、高亮荧光青/蓝绿色 `#00e5ff` / `#22d3ee`、发光微边框卡片、胶囊型标签导航、步进微调器 Stepper、荧光色滑动开关 Switch）。
   - 适配移动端 H5 与桌面视口。
2. **Web3 钱包连接与签名鉴权**:
   - 依赖浏览器插件钱包 / 注入式提供者（`window.ethereum`）连接。
   - 网络探测与自动切换（BSC Testnet Chapel, Chain ID: `97`）。
   - 钱包签名登录（通过 EIP-191 `personal_sign` 签名消息完成鉴权识别，无任何第三方中心化服务端依赖）。
3. **币对（LP Pair）订阅与数据底座同步**:
   - 用户输入 LP Pair 地址即可一键加载并开启监听。
   - 首次订阅时，基于 BSC Testnet Archive 归档节点自动同步过去 1 天（24 小时，约 28,800 个区块）的 `Swap` 事件。
   - 结合 `@evm-event-lake/node-sdk` 的 `enrichEvent` 回调，在事件落库时获取该区块的储备量、兑换价格及量化指标，并持久化于本地 `IndexedDB`（`indexeddb://uniswap_v2_trader`）。
   - 同步过程中呈现友好的“数据准备中”进度与等待交互。
   - 历史同步完成后转入实时区块 Log 增量追踪。
4. **高可用只读查询底座 (`evm-call`)**:
   - 使用 `@evm-event-lake/node-sdk` 内置重导出的 `evm-call` 进行高并发只读查询。
   - 全面复用 Multicall3（`0xca11bde05977b3631167028862be2a173976ca11`）与 JSON-RPC batching 机制，合并代币余额、储备量与汇率查询。
5. **策略配置与执行引擎**:
   - **反买反卖 (Reverse Trade)**: 价格跌幅/涨幅反向买卖条件、单次交易随机上下限、价格下限、滑点保护、扣税比例。
   - **AI 自动交易**: 自动化买卖限价与触发策略。
   - **AI 套利 / 价格增长模式**: 每日涨幅目标、拉升时段与定投频率设置。
   - 防夹子（Anti-sandwich）保护与防貔貅（Anti-honeypot）检测开关。
   - 支持直连 PancakeSwap Router 发起交易签名，或调用用户自定义代理合约执行。

### 2.2 明确排除的功能 (Out of Scope)
- 严禁加入中心化用户系统（手机号、邮箱、密码、验证码等）。
- 严禁在应用内自建助记词生成、子钱包私钥派生与托管存储（无需助记词配置及子钱包归集）。
- 严禁加入中心化后台、多租户管理、推广返佣与付费订阅。

## 3. MVP 运行环境与目标网络
- **目标链**: 币安智能链测试网 (BSC Testnet / Chapel, Chain ID: `97`)
- **DEX 协议**: PancakeSwap V2
  - Factory: `0x6725F303b657a9451d8BA641348b6761A6CC7a17`
  - Router: `0xD99D1c33F9fC3444f8101754aBC46c52416550D1`
  - Multicall3: `0xca11bde05977b3631167028862be2a173976ca11`
- **归档与常规 RPC 节点池**:
  - `https://bsc-testnet-rpc.publicnode.com` (已验证支持 28,800+ 区块历史 Archive 深度回溯)
  - `https://bsc-testnet.drpc.org` (已验证支持 28,800+ 区块历史 Archive 深度回溯)
