# 系统架构说明 (System Architecture)

## 1. 架构全景

```mermaid
flowchart TB
    subgraph UI_Layer [展现层 Presentation Layer (React 19 + Tailwind + Lucide)]
        TopNav[顶部导航栏: 钱包状态 / BSC网络切换 / EIP-191签名状态]
        TabsPrimary[顶层胶囊标签: 监听Swap / 设置策略]
        TabsStrategy[策略子标签: 反买反卖 / AI自动交易 / AI套利机器人]
        ViewMonitor[Swap 监控管理看板 & 24h 同步进度]
        ViewInfo[Swap 信息区 & 实时双代币储备量]
        ViewTrend[24h 价格走势图表 & 量化指标]
        ViewReverse[反买反卖策略控制面板 & 模拟预执行]
        ViewAuto[AI 自动交易限价与触发策略面板]
        ViewGrowth[AI 套利 / 价格增长模式面板]
    end

    subgraph State_Layer [状态与上下文管理 Context & State Layer]
        WalletCtx[WalletContext (外部钱包连接 / EIP-191 签名会话)]
        PairCtx[ActivePairContext (全局活跃币对 / 实时事件流 / 自定义合约代理)]
        NotifyCtx[NotificationContext (链上交易广播与区块确认 Toast 浮窗)]
        StrategyStore[StrategyStore (本地持久化策略参数)]
        SubStore[SubscriptionStore (IndexedDB 币对订阅表)]
    end

    subgraph Core_Engine [策略计算与交易调度 Engine Layer]
        ReverseEngine[反向交易触发评估与 Dry-Run 模拟器]
        ApprovalManager[ERC-20 动态 Spender 授权管理器]
        TradeDispatcher[Router / 代理合约交易拼装与广播器]
        ReorgDetector[区块日志重组检测与数据回滚器]
    end

    subgraph Data_Layer [数据底座与 EVM 调用 Layer]
        SDK_EventLake[EVMEventLake 实例 (IndexedDB 适配)]
        SDK_EnrichHook[enrichEvent 回调 (24h 成交均价与方向富化)]
        RealtimePoller[实时日志增量同步轮询器 (3s 周期 / 按时序广播)]
        SDK_EvmCall[evm-call 客户端]
        MulticallExecutor[Multicall3 批量调用聚合]
        BatchRpcPool[高可用多 RPC 故障切换与重试池]
    end

    subgraph Chain_Layer [区块链网络 BSC Testnet (Chain ID 97)]
        ArchiveRPC[BSC Archive 归档节点池 (publicnode / drpc)]
        PancakeContracts[PancakeSwap V2 Factory / Router / Pair 合约]
        Multicall3Contract[Multicall3 (0xca11...ca11)]
    end

    UI_Layer --> State_Layer
    State_Layer --> Core_Engine
    Core_Engine --> Data_Layer
    Data_Layer --> Chain_Layer

    SDK_EventLake --> ArchiveRPC
    SDK_EvmCall --> Multicall3Contract
    TradeDispatcher --> PancakeContracts
```

## 2. 核心模块分解

### 2.1 表现层 (Presentation Layer)
- **技术栈**: Vite 6 + React 19 + TypeScript + Tailwind CSS。
- **暗色科技风规范**: 严格遵循 `docs/design_refs/设置策略1_d1ff7c96.png` 视觉基准（深黑底色 `#0b0f17`、荧光青交互高亮 `#00e5ff`、发光微边框卡片、胶囊分段导航、带微调加减按钮的数值步进器 Stepper 与荧光色滑动开关 Switch）。
- **视口与视图组成**:
  - `SwapMonitorView`: LP 币对地址输入与解析、启动 24h 历史回溯与增量监听、自定义代理合约配置、实时交易事件流表格。
  - `SwapInfoView`: 双代币储备量实时卡片、钱包代币余额、即时买卖双向汇率展示（配备 400ms 防抖更新机制）。
  - `PriceTrendView`: 24 小时价格走势平滑折线图、最高/最低价、当前涨跌幅与有效采样点统计。
  - `ReverseTradePanel`: 价格跌幅反向买入、价格涨幅反向卖出、单次交易随机上下限、价格下限保护、滑点保护与扣税比例。支持链上 Dry-Run 模拟预执行与真实交易广播。
  - `AutoTradePanel`: AI 自动交易买入与卖出限价触发策略配置。
  - `PriceGrowthPanel`: AI 套利与价格增长模式，设置每日拉升目标、拉升时段与定投频率。

### 2.2 状态管理与上下文层 (State & Context Layer)
- **`WalletContext`**:
  - 纯 Web3 外部钱包（MetaMask, OKX, Rabby）连接，完全不自建私钥或助记词存储。
  - 网络探测与自动切换（BSC Testnet, Chain ID `97`）。
  - EIP-191 `personal_sign` 免 Gas 纯客户端免密签名登录鉴权，会话安全持久化。
- **`ActivePairContext`**:
  - 全局管理当前订阅的活跃币对、代币元数据（符号、精度、地址）、即时汇率与最新交易事件流。
  - 保证在“监听Swap”与“设置策略”（反买反卖/AI自动交易/价格增长）各标签页切换时状态无缝同步，消除割裂。
- **`NotificationContext`**:
  - 全局异步交易通知与状态气泡，提供 `approving` -> `broadcasting` -> `pending` -> `success` / `failed` 全生命周期用户反馈，支持直接跳转 BscScan 区块浏览器查验。

### 2.3 数据底座与 EVM 调用层 (Data Foundation & EVM Layer)
- **`@evm-event-lake/node-sdk`**:
  - 存储模式: 浏览器端使用 `indexeddb://uniswap_v2_trader`。
  - 首次订阅时，基于 BSC Testnet Archive 归档节点自动同步过去 24 小时（约 28,800 区块）的 `Swap` 事件。
  - 通过 `enrichEvent` 回调富化计算每笔交易的实际成交价格、买卖方向与时间戳。
  - 历史同步完成后无缝切换为 3 秒周期的实时增量区块轮询器，按时间正序推送至事件流。
- **`evm-call` 与高可用 RPC 池**:
  - 链上只读状态查询（代币元数据、Pair 储备量、代币授权额度等）全面复用 Multicall3 与 JSON-RPC batching 机制。
  - RPC 客户端具备自动多节点故障切换（Failover）与重试机制，保障在公共节点限流或波动时的超高可用性。

### 2.4 安全与策略执行引擎 (Security & Trading Engine)
- **零本地私钥风险**: 用户资金完全受外部钱包助记词保护，DApp 仅通过标准 `eth_sendTransaction` 请求钱包签名。
- **动态 Spender 授权**:
  - 直连交易模式下自动授权 PancakeSwap Router。
  - 启用自定义代理合约时自动将授权目标切换为用户指定的代理合约，杜绝权限错配导致的交易回滚。
- **多维度防夹与防割保护**:
  - **Dry-Run 静态模拟**: 在真实交易前，通过 PancakeSwap Router 的 `getAmountsOut` 进行静态调用模拟，验证链上流动性与防貔貅机制。
  - **多精度归一化计算**: 基于代币实际精度（decimals）计算成交对价，使用 BigInt 与 `formatUnits` 精准换算，防止浮点截断。
  - **价格下限 (Price Floor) 拦截**: 模拟输出对价低于设定的价格下限时立即终止交易。
  - **滑点与扣税动态补偿**: 滑点保护自动将代币扣税比例纳入容差计算，避免有税代币因滑点过紧产生链上 Revert。

