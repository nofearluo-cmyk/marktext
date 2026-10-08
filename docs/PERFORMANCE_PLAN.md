# MarkText Performance Optimization Plan

> 基于对 Muya 遗留引擎、Muya TS 重写版、桌面壳层（Electron 主进程/渲染进程/IPC）的全面分析，以及 Electron 官方性能指南、ProseMirror 社区经验、NAPI-RS 等外部实践的调研。

## Current Baseline

MarkText 当前的性能特征：

| 维度 | 现状 | 核心瓶颈 |
|------|------|----------|
| 打字延迟 | 中低档文档可接受，长文档和代码块明显卡顿 | `innerHTML` 全量替换 + 击键时全局数据管线 |
| 大文件打开 | 加载几十 MB 文件明显延迟 | 全文读入内存 2-3 次，同步编解码 |
| 大文档编辑 | 300+ block 后输入响应下降 | O(n) 线性查找 + 每击键多路事件回调 |
| 内存占用 | 高（历史快照、状态深拷贝） | 遗留引擎深拷贝整个 block 树作为历史 |
| 启动速度 | 中等 | 同步初始化所有模块 |
| 长文档滚动 | 代码块行号渲染卡顿，全文档 DOM 在页 | 无视口裁剪，layout thrashing |

## Phase Structure

四个阶段按依赖关系排序——每阶段内部的项目可以并行推进。

```
Phase 1  ──→  Phase 2  ──→  Phase 3  ──→  Phase 4
(渲染管线)    (数据管线)    (大文档)     (平台/基础设施)
```

---

## Phase 1: Rendering Pipeline Quick Wins

**目标**: 将击键到像素的延迟降低 40–60%。集中修复渲染路径中最重的瓶颈，改动范围小，效益最大。

### 1.1 Inline Renderer: `innerHTML` → Virtual DOM Patch

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/inlineRenderer/index.ts:74` |
| **现状** | `domNode!.innerHTML = html` —— 每次击键销毁并重建段落内全部 DOM 子节点 |
| **改造方向** | 复用已有的 Snabbdom `patch()` 做增量 diff（`init/patch/h` 已导入但未用于渲染，当前仅用 `h`+`toHTML` 生成字符串再丢给 browser parser） |
| **预期效果** | 单段落编辑时 DOM 操作量降低 80%+，浏览器重排范围从整段缩小到变化的 token |
| **改造难点** | Snabbdom patch 需要 VNode 树对等——当前 `output()` 的输出是 flat token 列表包在一个 `<span>` 里；需要为每个 token 生成带 key 的 VNode 以便 diff 复用 |
| **验收方法** | Chrome Performance 录制：输入一个字符，`patch()` 的 DOM 操作时间从 ~2-5ms（innerHTML）降至 <1ms |
| **风险** | 低。Snabbdom 已经在项目依赖中，降级路径是回退到 `innerHTML` |

### 1.2 `collectReferenceDefinitions` 增量更新

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/inlineRenderer/index.ts:77-98` |
| **现状** | 每次 `patch()` 第一行就递归遍历整个文档 JSON 状态树来重建 `labels` Map |
| **改造方向** | 维护一个增量 `labels` Map：仅在文档结构变化（段落增删/引用定义变更）时重建，键盘输入（纯文本改动）时跳过 |
| **预期效果** | 长文档（500+ block）中每次击键节省 5-15ms 的树遍历 |
| **验收方法** | 在 500-block 文档末尾打字，确认 `collectReferenceDefinitions` 调用次数减少至仅在段落增删时触发 |
| **风险** | 低。需要确保引用定义变更的事件被正确监听（现有 `json-change` 事件已有 op 类型区分） |

### 1.3 LinkedList 操作去 Spread 化

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/block/base/linkedList/linkedList.ts:65-119` |
| **现状** | `find()`、`offset()`、`forEach()`、`map()`、`reduce()` 全部通过 `[...spread]` 分配中间数组 |
| **改造方向** | 直接用迭代器实现——`find()` 计数遍历、`forEach()` 逐个回调，零中间分配 |
| **预期效果** | 500-block 文档中每次 find/offset 调用减少 500 元素的数组分配和 GC 压力 |
| **验收方法** | Heap snapshot 对比：同等操作下中间数组分配归零 |
| **风险** | 低。纯内部实现替换，API 不变 |

---

## Phase 2: Data Pipeline – Keystroke to Store

**目标**: 切断击键事件到全局状态更新的过度耦合，降低每帧 CPU 预算消耗。

### 2.1 `json-change` 回调管线分层

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/renderer/src/components/editorWithTabs/editor.vue:1669-1694` |
| **现状** | 每次击键执行：`getMarkdown()` → `wordCount` → `getTOC()` → `getHistory()` → `listToTree()` → `deepEqual` 对比 |
| **改造方向** | 分两层——(a) 即时层：`getMarkdown()` + `isSaved` 标记更新，每击键执行；(b) debounce 层（~150ms）：TOC 生成 + 字数统计 + 导航树重建，在用户停止输入后批量更新 |
| **预期效果** | 持续输入时每帧计算量降低 60-70%，CPU budget 从 ~12-20ms 降至 ~3-5ms |
| **验收方法** | Performance 录制持续输入，确认 TOC/wordCount 回调频率降至 ~6-7 Hz |
| **风险** | 中。TOC 更新变为异步可能导致 UI 短暂不一致——目录侧边栏需要显示 loading/skeleton 状态 |

### 2.2 遗留引擎：`getBlock()` O(n) → O(1)

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muyajs/lib/contentState/index.js:373-389` |
| **现状** | 递归深度优先遍历整个 block 树，每次回车键处理中被调用 20-30 次 |
| **改造方向** | 维护一个 `Map<key, block>` 索引，在 block 增删时同步更新 |
| **预期效果** | 500-block 文档中回车响应时间降低 30-40% |
| **验收方法** | 在长文档末尾按回车，对比 Performance 录制中 `getBlock` 累计耗时 |
| **风险** | 中。需要确保所有 block 增删删路径都维护索引（create、remove、replace、move） |

### 2.3 选择/格式变化 IPC Throttle

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/renderer/src/store/editor.ts:1452,1476`（发送侧）<br>`packages/desktop/src/main/menu/index.ts:474`（接收侧） |
| **现状** | 每次光标移动发送 `mt::editor-selection-changed` IPC，主进程收到后重建整个应用菜单状态 |
| **改造方向** | 渲染侧 throttle ~100ms（含尾调用），确保最快方向键导航也至少间隔两帧才发送一次 |
| **预期效果** | 快速导航时 IPC 频率从 ~30 Hz 降至 ≤10 Hz，主进程菜单重建压力同比降低 |
| **验收方法** | 按住右箭头键 3 秒，确认 IPC 发送次数 ≤30 |
| **风险** | 低。菜单项禁用状态最多延迟 100ms，用户无法感知 |

### 2.4 遗留引擎：历史存储深拷贝 → OT 操作

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muyajs/lib/contentState/history.js:32-87` |
| **现状** | `History.push()` 调用 `deepCopy(state)` 整个 block 树，UNDO_DEPTH=100 时最多保留 100 份完整副本 |
| **改造方向** | 直接切换到 muya TS 引擎（已内置 OT 操作存储）；或在遗留引擎中引入最小化 diff 存储 |
| **预期效果** | undo 栈内存从 O(n × stackSize) 降至 O(ops)，500-block 文档从 ~50MB 降至 ~5MB |
| **验收方法** | 编辑后 heap snapshot，undo stack 不包含完整文档副本 |
| **风险** | 高（如果自行实现 OT） / 低（如果切换至 muya TS——已通过 CommonMark/GFM conformance suite 验证） |

---

## Phase 3: Large Documents & Memory

**目标**: 让 10 万+ 字的大文档在编辑、滚动时保持 60fps。

### 3.1 代码块行号 Layout Thrashing 修复

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muyajs/lib/utils/resizeCodeLineNumber.js:27-57`（已知 issue #1648） |
| **现状** | 逐行 `set textContent → getBoundingClientRect → set height`，500 行代码引发 500 次强制重排 |
| **改造方向** | 批量写 → 单次读 → 批量写：先用一个 rAF 统一设置所有 sizer textContent，下一个 rAF 读取高度并批量应用 |
| **预期效果** | 代码块行号更新从 500×reflow 降至 2×reflow |
| **验收方法** | 打开含 500+ 行的代码块，确认 resize 函数中 `getBoundingClientRect` 调用次数 ≤ 2 |
| **风险** | 低。纯批量化重构，逻辑不变 |

### 3.2 视口感知段落渲染

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/block/scrollPage/` + `packages/muyajs/lib/contentState/` |
| **现状** | 全文档所有 block 的 DOM 都在 contenteditable 区域中，无裁剪 |
| **改造方向** | 对屏幕外（超出视口 ± 2 屏缓冲区）的段落设置 `content-visibility: auto` 或 `display: none`，让其 DOM 子树不参与布局和绘制 |
| **预期效果** | 10 万字符文档的内存占用降低 50-70%，滚动帧率从 ~30fps 提升至 ~60fps |
| **验收方法** | Performance 录制长文档滚动；确认屏幕外段落的布局/绘制时间为 0 |
| **风险** | 高。`contenteditable` + `content-visibility` 的交互在 Chromium 中有已知边缘情况——需要在 `display: none`（ProseMirror 社区最终方案）和 `content-visibility: auto` 之间实测选择。且需要确保选区跨越视口边界时，被隐藏的段落能被正确恢复 |

### 3.3 文件流式读取

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/main/filesystem/markdown.ts:91-160` |
| **现状** | `fsPromises.readFile()` 全量读入 Buffer → `iconv.decode()` 全量解码 → 正则全文行尾检测——每个文件在内存中存 2-3 份副本 |
| **改造方向** | (a) 编码检测仅读前 512 字节 → (b) 流式解码 → (c) 行尾转换 inline 做，不存中间字符串 → (d) 将结果 split 为行数组传给编辑器 |
| **预期效果** | 50MB 文件打开峰值内存从 ~150MB 降至 ~55MB，加载时间降低 20-30% |
| **验收方法** | 打开 50MB markdown 文件，Chrome DevTools Memory 录制确认峰值分配 |
| **风险** | 中。`iconv-lite` 的流式 API 与当前代码路径不同，需要验证各种编码（GBK、Shift-JIS 等）下行为一致 |

### 3.4 `getState()` deep-clone 策略优化

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/state/index.ts:207-209` |
| **现状** | 每次 `getState()` 调用都 `deepClone(this._state)`——json-change 事件、history 记录、引用定义收集、markdown 导出各触发一次 |
| **改造方向** | (a) 引入 copy-on-write：`getState()` 返回冻结引用，仅在调用方实际写入时 clone；(b) 对只读消费者（如 `collectReferenceDefinitions`）不 clone |
| **预期效果** | 击键路径中的 deep-clone 次数从 3-4 次降至 0-1 次 |
| **验收方法** | Performance 录制中 `deepClone` 调用次数对比 |
| **风险** | 中。需要审计所有 `getState()` 调用方，确认哪些会修改返回值 |

### 3.5 CodeMirror `viewportMargin: Infinity` → 有限值

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/renderer/src/components/editorWithTabs/sourceCode.vue:308` |
| **现状** | `viewportMargin: Infinity` 强制 CodeMirror 5 渲染整个文件的全部行 |
| **改造方向** | 改为 `viewportMargin: 1000`（可视区域 + 1000 行缓冲） |
| **预期效果** | 5,000+ 行文件的源码模式 DOM 节点数从 ~5,000 降至 ~150 |
| **验收方法** | 打开 5,000 行文件，DevTools Elements 面板确认 DOM 行节点数 |
| **风险** | 低。标准 CodeMirror 配置变更，Google 搜索仍然可用 |

---

## Phase 4: Platform & Infrastructure

**目标**: 降低闲置功耗、提升启动速度、优化平台特定行为。

### 4.1 macOS 文件监视切换为原生 FSEvents

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/main/filesystem/watcher.ts:192` |
| **现状** | `usePolling = isOsx ? true : ...`——macOS 无条件使用轮询 |
| **改造方向** | 默认 `usePolling: false`，仅在检测到云存储目录或其他已知有问题的路径时回退 |
| **预期效果** | macOS 文件监视 CPU 从 ~2-5% 降至 ~0.1% |
| **验收方法** | Activity Monitor 观察空闲状态下 MarkText 的 CPU 使用率 |
| **风险** | 中。FSEvents 在某些边缘情况（网络挂载、某些云同步目录）可能丢失事件。需要在代码中保持回退机制 |

### 4.2 浮动工具延迟创建 + 隐藏时移除 DOM

| 属性 | 内容 |
|------|------|
| **文件** | `packages/muya/src/ui/baseFloat/index.ts:46-74` |
| **现状** | 所有 UI 浮动工具在编辑器初始化时就创建 DOM 并挂载到 body，每个带有活跃的 ResizeObserver |
| **改造方向** | 首次 `show()` 时创建 DOM，`hide()` 时从 DOM 树移除并断开 ResizeObserver |
| **预期效果** | 编辑器初始化后闲置状态下的 DOM 节点和 ResizeObserver 回调减少约 80% |
| **验收方法** | DevTools Elements + Performance 观察：编辑器初始加载后，body 下不应存在隐藏的浮层 DOM |
| **风险** | 中。频繁 show/hide 的 DOM 创建/销毁开销需与始终存在的布局开销权衡——对于高频浮层（如 inline 格式栏）保持常驻可能更优 |

### 4.3 启动延迟加载

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/main/index.ts:96` + `Accessor` 构造链 |
| **现状** | 主进程同步初始化所有模块（偏好设置、菜单、窗口管理器、拼写检查器等） |
| **改造方向** | 参考 VSCode 模式：先显示空白窗口和骨架屏 → 异步加载偏好设置 → 初始化编辑器 → 加载上次会话 |
| **预期效果** | 冷启动到可交互时间缩短 30-50% |
| **验收方法** | 用 `pnpm run perf:inspect-brk` 录制启动 profile，对比优化前后 first-paint 时间 |
| **风险** | 中。需要处理窗口已显示但偏好未就绪的中间状态 |

### 4.4 electron-store 写入合并

| 属性 | 内容 |
|------|------|
| **文件** | `packages/desktop/src/main/preferences/index.ts:103` |
| **现状** | 每次单键偏好修改触发一次独立的同步 JSON 文件写入；`electron-store` 不支持事务或异步 I/O |
| **改造方向** | 在内存中积累变更，用 1 秒 debounce 批量写入；或在合适时机（窗口关闭、应用退出）统一 flush |
| **预期效果** | 连续偏好变更（如批量导入设置）不再卡顿 |
| **验收方法** | 导入一套主题/偏好设置，确认文件写入次数 ≤ 3 次（而非每次 key 一次） |
| **风险** | 低。已有 `debouncedSendBufferedState` 供参考 |

---

## Measurement Methodology

### 基线采集（Phase 0，优化前必做）

每一项优化开始前，记录以下基线数据：

```
# 1. 启动性能
pnpm run perf:inspect-brk
# → chrome://inspect 录制从 launch 到可交互的完整 timeline

# 2. 渲染性能（开发模式）
pnpm run dev
# → F12 → Performance tab → 录制以下场景各 10 秒：
#   a. 在 1000 行文档末尾持续输入字符
#   b. 在含 500 行代码块的文档中编辑
#   c. 快速方向键导航
#   d. 滚动长文档

# 3. 内存占用
# → Memory tab → Heap snapshot：分别在以下时机拍摄
#   启动后、打开 10MB 文件后、编辑 100 次操作后
```

### 每次优化的验证流程

```
1. 改代码前 → 录制 Performance trace（场景 a-d）
2. 改代码   → 最小化变更
3. 改代码后 → 录制 Performance trace（相同场景）
4. 对比     → 确认关键指标改善、无回归
5. 回归测试 → pnpm test + pnpm typecheck（确保不破坏功能）
```

---

## Risk Summary

| 风险等级 | 项数 | 项目 |
|----------|------|------|
| 高 | 1 | 视口感知段落渲染（contenteditable 交互边缘情况） |
| 中 | 7 | json-change 分层、getBlock 索引、getState COW、流式读取、macOS FSEvents、浮动工具延迟创建、启动延迟加载 |
| 低 | 6 | innerHTML→VDOM、collectReferenceDefs 增量、LinkedList 去 spread、IPC throttle、代码块 layout thrashing、CodeMirror viewportMargin、electron-store 合并 |

---

## Estimated Effort

| 阶段 | 优化项数 | 预估人天 | 依赖 |
|------|----------|----------|------|
| Phase 1 | 3 | 5-8 | 无 |
| Phase 2 | 4 | 8-12 | Phase 1 完成后可并行 |
| Phase 3 | 5 | 10-18 | Phase 2 完成（数据管线稳定后再做视口裁剪） |
| Phase 4 | 4 | 5-8 | 可与 Phase 3 并行 |
| **合计** | **16** | **28-46** | |

---

## Migration Lever: Muya TS Rewrite

值得注意的是，muya TS 重写版（`packages/muya/`）已经天然解决了遗留引擎（`packages/muyajs/`）的几个 P0/P1 问题：

| 遗留引擎问题 | muya TS 版状态 |
|-------------|---------------|
| `getBlock()` O(n) 遍历 | ✅ 路径式查找，LinkedList O(1) |
| 历史深拷贝整个状态 | ✅ OT 操作存储（仅操作 diff） |
| `requestIdleCallback` 缺失 | ✅ rAF 批量化操作 |
| Prism 语言全部同步加载 | ✅ 动态 import 按需加载 |
| 图表渲染器全量加载 | ✅ Mermaid/PlantUML/Vega-Lite 动态 import |

桌面应用端（`packages/desktop/`）全面切换到 `@muyajs/core`（muya TS 引擎）是解决遗留性能问题的直接路径。当前切换的阻塞项是 conformance 测试兼容性和少数 alias 调用点的迁移——这些属于功能验证而非性能优化范畴，但应作为性能计划的 **隐含前置条件** 或并行推进。
