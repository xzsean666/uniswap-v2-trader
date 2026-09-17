# TASK-019: 专属打工小号(Keeper)独立Tab与强制依赖、反买反卖小号代发、策略LP下拉搜索选择器、监控大屏一排一LP与详细报告弹窗化重构

## 1. 任务背景与目标
根据用户最新指令与产品交互体验优化需求，进行策略板块与监控大屏的全方位深度重构：
1. **专属打工小号 (Keeper 托管) 独立为一级策略 Tab**:
   - 将 Keeper 打工小号从此前嵌套在反向交易面板中彻底剥离，提升为“设置策略”下的首个专属 Tab。
   - 建立严格的 Keeper 依赖门禁：策略面板的所有操作（反买、反卖、AI 自动交易、AI 套利）均强依赖打工小号就绪状态。
2. **反买、反卖强制由打工小号免密代发执行**:
   - 移除反向买卖向主钱包 MetaMask 弹窗签名的降级逻辑，反向买入与反向卖出 100% 由本地打工小号（Keeper）签名并直接通过 RPC 广播，产物资金 100% 强制回流主钱包，实现双钱包资产隔离。
3. **策略目标交易对重构为下拉 + 搜索 (PairDropdownSelector)**:
   - 废除原有的水平平铺标签（多币对时易杂乱），升级为具备实时符号搜索、LP 地址过滤、新地址一键导入识别与策略开闭状态徽标的下拉选择器。
4. **监控大屏重构为一排一个 LP 对**:
   - 解决此前 2 列并排在桌面/移动端过分拥挤的问题，将多币对大屏网格改为单列全宽（`flex flex-col space-y-3`），给每个币对的行情、监听状态、策略开闭、同步进度与操作按钮充分展示空间。
5. **详细报告弹窗化 (PairDetailModal)**:
   - 废除此前点击“详细工作台”离开大屏并全屏切换的体验，改为在当前大屏上轻量弹出弹窗模态框（Modal Dialog），内嵌 Pancake 标签、双边储备量、24h 走势图与专属交易流水，关闭即回到大屏原位。

---

## 2. 详细设计与实现方案

### 2.1 专属打工小号 (Keeper) 独立 Tab 与依赖门禁
- **`src/App.tsx`**:
  - 更新策略子 Tab 定义：`export type StrategySubTab = "keeper" | "reverse" | "auto" | "arbitrage";`。
  - SubTabs 增加 `{ id: "keeper", label: "专属打工小号" }`。
  - 选中 `keeper` 时渲染完整的 `KeeperCard` 资产托管面板（支持私钥生成、私钥导入、Gas 充值、链上 `setKeeper` 绑定、代币授权、私钥导出与安全移除）。
- **`src/components/keeper/KeeperDependencyGuard.tsx`**:
  - 创建通用的打工小号依赖守卫组件，挂载在 `ReverseTradePanel`、`AutoTradePanel` 和 `PriceGrowthPanel` 顶部：
    - 未配置小号时：展示醒目的警告卡片与“立即配置专属打工小号”跳转按钮，阻断策略执行并进行安全拦截提示。
    - 未完成链上绑定时：展示待绑定提示与快速跳转入口。
    - Gas 余额为 0 时：展示燃料不足警告与去充值入口。
    - 就绪状态：展示高科技感极简状态栏（打工小号地址、Gas 余额、链上绑定状态、管理小号外链）。

### 2.2 反买、反卖强制由打工小号代发执行
- **`src/views/strategy/ReverseTradePanel.tsx`**:
  - 在 `handleSimulateAndExecute` 中严格校验 Keeper 就绪状态（必须已生成小号、已链上绑定 `isBoundToCurrentProxy`、且 Gas 余额大于 0）。
  - 授权 Spender 固定为 Keeper 代理合约 `proxyAddress`。
  - 执行阶段彻底剔除向 MetaMask 弹窗签名的 `dispatchSwapTransaction`，一律由 `executeKeeperSwap` 毫秒级本地签名并直接代发，产物资金 100% 强制回流主钱包。

### 2.3 策略目标交易对下拉 + 搜索选择器
- **`src/components/pair-selector/PairDropdownSelector.tsx`**:
  - 触发栏显示：当前选中的币对符号（如 `ALPHA / BETA`）、合约地址与当前币对的实时量化策略开闭状态徽标（🟢 `已开启 (买跌5% | 卖涨5%)` / ⚪ `已关闭`）。
  - 展开菜单内置实时搜索框：支持根据代币符号（如 `USDT`, `ALPHA`）、组合对名称或 0x LP 合约地址动态模糊检索。
  - 智能识别新 LP：输入任意合法 40 位 16 进制 LP 地址即刻提供“一键导入并选择此新 LP”。
  - 推荐未订阅热门币对：便于快速发现与一键切换。

### 2.4 监控大屏单列全宽排版 (一排一个 LP)
- **`src/views/swap-monitor/SwapMonitorView.tsx`**:
  - 将自选监控网格改为 `flex flex-col space-y-3`（单排单个 LP）。
  - 重新编排单卡片信息流：顶部为币对符号、Pancake 标签与合约外链；中部横向舒展排列监听呼吸徽标、策略状态、即时汇率与抓取笔数；底部集成启动/停止监听、配置策略与“详细报告”入口。

### 2.5 详细报告模态弹窗 (PairDetailModal)
- **`src/views/swap-monitor/PairDetailModal.tsx`**:
  - 实现基于 `fixed inset-0 z-50` 的暗色半透明毛玻璃蒙层弹窗。
  - 支持 `ESC` 键与点击外部蒙层优雅关闭，右上角设有关闭 `✕` 按钮与底部“关闭报告”按钮。
  - 弹窗内集成目标币对的实时行情、监听控制、专属策略开闭卡片（支持点击跳转到策略配置该币对）、双边储备量 (`SwapInfoView`)、24h 价格走势折线图 (`PriceTrendView`) 及最近交易事件流 (`RecentEventsTable`)。
  - 彻底淘汰原有的全屏页面切换模式，保障用户始终驻留大屏看板。

---

## 3. 验证与测试结果

| 验证项 | 结果 | 说明 |
| :--- | :--- | :--- |
| **Vitest 单元测试** | ✅ **34 个测试套件 / 173 项测试全部通过** (1 个 Hardhat 外部节点用例按规则安全跳过) | 新增 `pair-dropdown-selector.test.ts`、`strategy-redesign.test.ts` 与 `swap-monitor-redesign.test.ts` |
| **TypeScript 类型检查** | ✅ **0 错误 (`tsc --noEmit`)** | 严格类型推导，清除全部无用变量与导入 |
| **生产打包构建** | ✅ **0 错误 (`pnpm build`)** | 耗时 6.91s 成功构建生产 bundle |
| **Playwright 真实浏览器 E2E** | ✅ **13 项端到端流程全部通过** | 真实验证大屏单列渲染、详细报告弹窗开启与关闭、打工小号生成与 0.005 BNB Gas 充值、链上 setKeeper 绑定、代币授权、下拉搜索切换 LP、风控拦截与打工小号免弹窗代发交易 |
| **最新渲染快照** | ✅ **已成功保存至 `docs/screenshots/`** | 包含 `04_pair_detail_modal_popup.png`、`05_keeper_dedicated_tab.png`、`11_pair_dropdown_selector.png` 等关键快照 |
