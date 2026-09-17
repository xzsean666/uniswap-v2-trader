# 任务索引表 (Task Index)

| 任务 ID | 任务名称 | 状态 | 依赖 | 预计耗时 | 说明 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **TASK-001** | 项目工程脚手架构建、AI工作文档体系与SDK底座集成 | **DONE** | 无 | 45m | Vite + React 19 + TypeScript + Tailwind + Viem + Vitest 搭建与 SDK 依赖声明 |
| **TASK-002** | 暗色科技感 UI 主题与 H5 布局框架规范化 | **DONE** | TASK-001 | 50m | 严格对标 `设置策略1_d1ff7c96.png`，构建暗色科技风主题系统与核心通用控件 (Stepper, Switch, SegmentedTabs) |
| **TASK-003** | Web3 钱包连接与 EIP-191 签名登录鉴权模块 | **DONE** | TASK-002 | 45m | 纯 Web3 插件钱包连接（MetaMask/OKX/Rabby）、BSC测试网检测与切换、签名登录认证与状态维护 |
| **TASK-004** | BSC Testnet Multicall3 与 PancakeSwap V2 RPC 客户端 | **DONE** | TASK-001 | 50m | 封装 `evm-call` 高可用客户端，配置 Archive 归档节点池与 Multicall3 批量调用通道 |
| **TASK-005** | LP Pair 校验与代币储备量/汇率批量读取器 | **DONE** | TASK-004 | 50m | 输入 Pair 地址自动校验合法性，通过 Multicall3 一并发起 Token0/Token1 符号、精度、储备量及汇率计算 |
| **TASK-006** | EVMEventLake IndexedDB 存储适配器与订阅状态表初始化 | **DONE** | TASK-001 | 50m | 初始化客户端 `indexeddb://uniswap_v2_trader` 存储底座，定义币对订阅状态与事件元数据表 |
| **TASK-007** | 24小时历史事件回溯抓取与 Archive 节点数据富化引擎 | **DONE** | TASK-004, TASK-006 | 75m | 订阅币对后自动回溯 24h（28,800 区块）Swap 事件，调用 `enrichEvent` 经 Archive 节点计算历史储备并持久化，提供“数据准备中”等待进度 |
| **TASK-008** | 实时区块日志增量同步引擎与重组检测 | **DONE** | TASK-007 | 60m | 实时追踪最新区块 Swap 事件，增量入库 IndexedDB，去重及轻量重组回滚保护 |
| **TASK-009** | "监听Swap" 交互视图与实时事件流看板 | **DONE** | TASK-005, TASK-008 | 60m | 实现“监听Swap”主界面：LP Pair 输入、开启/停止监听按钮、自定义合约代理配置及实时交易事件滚动列表 |
| **TASK-010** | "Swap 信息区" 代币储备与即时汇率卡片 | **DONE** | TASK-005, TASK-008 | 50m | 实现“Swap 信息区”界面：Token A / Token B 储备量、余额与实时兑换价格卡片，支持自动定时与事件驱动刷新 |
| **TASK-011** | 24小时价格趋势折线图与量化指标分析组件 | **DONE** | TASK-007, TASK-010 | 60m | 基于 IndexedDB 富化历史数据绘制高清晰暗色 24h 价格走势图，呈现价格波动、买入参考价与数据点数 |
| **TASK-012** | "AI自动交易" 与 "价格增长模式" 策略配置引擎 | **DONE** | TASK-002, TASK-010 | 65m | 还原设计稿“自动交易设置”：限价单、滑点保护、防夹子防貔貅开关，以及“价格增长模式”每日目标与定投间隔配置 |
| **TASK-013** | "反买反卖" (反向交易) 策略配置与模拟预执行引擎 | **DONE** | TASK-012 | 60m | 还原设计稿“反买反卖”界面：价格跌幅/涨幅反向触发条件、随机数量上下限、扣税比例以及静态调用模拟校验 |
| **TASK-014** | 链上交易调用分发器、钱包签名广播与全链路集成测试 | **DONE** | TASK-003, TASK-013 | 75m | 策略触发后通过钱包发起 PancakeSwap Router 或自定义代理合约交易签名与广播，执行全链路端到端验证与构建 |
| **TASK-015** | 自动化托管交易代理合约与前端专属 Keeper 模块对接 | **PENDING** | TASK-014, 外部依赖(代理合约) | 70m | 接入 `uniswap-v2-trader-contract` 代理合约，实现本地打工小号(Keeper)生成/导出、主钱包绑定与零弹窗自动化静默交易 |
