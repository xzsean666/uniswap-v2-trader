# TASK-016: 修复 Swap 事件富化 Codec 异常 (Unsupported decoded value type: undefined) 与健壮性加固

## 1. 任务背景与问题描述
在开启币对监听并同步 24 小时历史事件时，前端界面弹出红色错误提示：
`Unsupported decoded value type: undefined`
同时历史同步进度条提示：
`历史事件同步遇到异常: Unsupported decoded value type: undefined 0%`
导致币对监听无法正常进行。

---

## 2. 根本原因剖析 (Root Cause Analysis)
1. **SDK 底层存储编码机制**:
   - `@evm-event-lake/node-sdk` 的 `update-service.js` 在同步区块日志并执行 `enrichEvent` 回调后，通过 `encodeDecodedValue(enrichResult)` 将返回的富化数据无损序列化存入 `storedLog.additionalData`。
   - `encodeDecodedValue` 内部依赖 `toStoredDecodedValue(value)`。当遍历对象的键值对时，若存在值为 `undefined` 的属性（如 `{ sender: undefined, to: undefined, effectivePrice0Per1: undefined }`），由于 `typeof undefined === "undefined"` 且不属于受支持的原始值（`null`、`bigint`、`boolean`、`number`、`string`）或非空对象，会直接抛出：
     `DecodedValueCodecError: Unsupported decoded value type: undefined`。
   - 此外，若除零产生 `Infinity` 或 `NaN`，也会触发 `Decoded numeric values must be finite` 错误。

2. **`createSwapEnricher` 原逻辑缺陷**:
   - 原逻辑对合约生成的所有事件（包括 Uniswap V2 常见的 `Sync`, `Mint`, `Burn`, `Transfer`）均无差别执行。对于非 `Swap` 事件，其上下文 `context.arguments` 中并不包含 `amount0In`、`sender`、`to` 等字段，导致这些属性全为 `undefined`。
   - 原返回结构直接声明了 `sender: undefined`、`to: undefined`、`effectivePrice0Per1: undefined`、`effectivePrice1Per0: undefined`，触发底层 codec 报错。

3. **`realtime-poller.ts` 增量轮询容错**:
   - 原逻辑从 `lake.events.findMany` 检索事件未过滤 `where: { eventName: "Swap" }`，在处理非 Swap 事件时可能会解析到无效数据或丢失参数。

---

## 3. 解决方案与修改实现

### 3.1 `src/services/sync/event-enricher.ts`
1. **新增通用数据脱敏安全清洗器 `sanitizeForDecodedValueCodec<T>`**:
   - 递归过滤并剥离所有值为 `undefined` 的对象键，使序列化时不会遭遇 `undefined` 节点。
   - 检验数值属性，自动将非有限数字（`NaN`、`Infinity`）进行过滤，防止触发 `Decoded numeric values must be finite` 报错。
2. **`createSwapEnricher` 增强**:
   - 事件类型预检：若 `context.eventName` 存在且不为 `"Swap"`，或 `context.decodeStatus !== "decoded"`，或缺少 arguments，直接返回 `null`。SDK 检测到返回 `null` 时将跳过 `encodeDecodedValue` 编码，`additionalData` 保持为 `null`，不再污染数据库。
   - 仅在 `sender`、`to`、`effectivePrice0Per1`、`effectivePrice1Per0` 有效且为有限数值时才将其作为有效属性挂载到返回对象中。
   - 最终返回结果统一包裹 `sanitizeForDecodedValueCodec`，百分之百保证符合底层编码器规范。

### 3.2 `src/services/sync/realtime-poller.ts`
1. 查询事件时增加 `where: { eventName: "Swap" }` 过滤条件，优先仅提取 Swap 事件。
2. 循环处理增加 `if (item.eventName && item.eventName !== "Swap") continue;` 防护。
3. 若 `item.additionalData` 为空，自动降级从 `item.arguments` 中安全提取 `amount0In`、`amount1In`、`amount0Out`、`amount1Out` 并推导买卖方向，提升极限网络情况下的容错度。

### 3.3 `src/services/sync/historical-sync.ts`
1. 在错误转换器中增加对 `Unsupported decoded value type` 的中文友好翻译与自愈引导提示。

---

## 4. 验证与测试结果
1. **Vitest 单元测试**:
   - 在 `tests/unit/sync/historical-sync.test.ts` 新增多组边界测试：
     - 非 `Swap` 事件（如 `Sync`）返回 `null`。
     - 缺失参数、decode_failed 状态测试。
     - 缺失 `sender`、`to` 场景下不生成 `undefined` 键，并通过 `encodeDecodedValue` 真实编码验证。
     - 交易金额为 0 场景下的非有限数值过滤。
     - `sanitizeForDecodedValueCodec` 递归清理验证。
   - 全项目 30 个测试套件，154 项测试全数通过（1 项本地私有节点跳过）。
2. **TypeScript 类型安全**:
   - `pnpm tsc --noEmit` 0 错误通过。
3. **生产构建构建**:
   - `pnpm build` 顺利产出构建包。
