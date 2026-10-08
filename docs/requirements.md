# 需求与验收标准

> 权威来源:本项目"要做什么 + 做到什么程度算完成"以本文件为准。
> 与会话记忆冲突时以此为准。变更需求 = 改这里,不要只在对话里说。

## R-007 macOS 安装包
- 最新交付:2026-09-23 重新打包包含 R-008 / R-009 的 arm64 版本,本机 `dist/release-20260923/marktext-mac-arm64-0.20.0-dev.dmg` 与同名 ZIP。15 项相关单测、打包应用启动/中文菜单/原生模块检查、codesign 深度严格校验与 DMG 校验通过;ad-hoc 签名,未公证。
- 描述:基于当前工作区(包含大文件优化)打包 Apple Silicon (arm64) macOS 版本;通过 SSH 在用户指定 Mac 的 work 目录下建立仓库。
- 验收标准:
  - [x] 在 mac A 的 work 目录下建立仓库,同步当前本地优化;路径 `/Users/nofear/work/marktext`。
  - [x] 成功生成 macOS 安装包并记录产物路径与目标架构:arm64;本机 `dist/marktext-mac-arm64-0.20.0-dev.dmg` 与同名 ZIP,远程 `/Users/nofear/work/marktext/dist/`。
- 交付记录:2026-09-22 在 mac A 上完成构建及打包应用启动检查,使用 ad-hoc 签名,未公证;大文件相关 6 项单元测试与 3 项编辑器 E2E 通过。类型检查遇到构建配置 Vite 7/8 插件类型冲突,详见 state.md。
- 状态:已交付。
- 更新:2026-09-23

## R-001 [需求名]
- 描述:[一句话说清要什么]
- 验收标准:
  - [ ] [可验证的完成条件 1]
  - [ ] [可验证的完成条件 2]
- 状态:进行中 / 已交付 / 已废弃
- 更新:[YYYY-MM-DD]

## R-002 [需求名]
- 描述:
- 验收标准:
  - [ ]
- 状态:
- 更新:

## R-003 代码测试强约束
- 描述:新增或修改代码功能时,必须同步编写并统一管理可自动化执行的测试用例;不允许交付无测试用例覆盖的功能。
- 验收标准:
  - [x] `AGENTS.md` 明确写入"写代码必须同时写测试用例"的硬性规则。
  - [x] 规则覆盖"不允许存在没有测试用例的功能"。
  - [x] 规则覆盖"测试用例统一管理"。
  - [x] 规则覆盖"测试用例要能自动化测试"。
- 状态:已交付
- 更新:2026-06-16

## R-004 MarkText 流畅度优化 Phase 1
- 描述:通过源码模式有限 viewport、选择状态 IPC 节流、WYSIWYG 派生数据延后更新,改善 MarkText 日常编辑流畅度。
- 验收标准:
  - [x] `pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts test/unit/specs/deferred-content-change.spec.ts test/unit/specs/selection-menu-state.spec.ts` 通过。
  - [x] `pnpm -C packages/desktop exec playwright test test/e2e/source-viewport.spec.ts test/e2e/selection-ipc-throttle.spec.ts test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/view-modes.spec.ts test/e2e/menu-sanity.spec.ts` 通过。
  - [x] `pnpm run typecheck` 通过。
- 状态:已交付
- 更新:2026-06-24

## R-005 Windows x64 可分发安装包
- 最新交付:2026-09-23 重新打包包含 R-008 / R-009 的 x64 版本,产物目录 `dist/release-20260923/`。打包应用启动/中文横向菜单/不透明背景/原生模块检查通过,ZIP 与已验证应用的 `app.asar` 哈希一致;未配置数字签名。
- 构建记录:使用 `pnpm run build:unpack` 后执行 electron-builder;本机无可用 VS 编译工具,沿用已恢复并通过运行验证的 Electron ABI 146 原生模块。
- 描述:基于当前本地 workspace 构建 Windows x64 NSIS 安装包,用于分发安装。
- 验收标准:
  - [x] `pnpm run build:win` 通过。
  - [x] 生成 `dist/marktext-win-x64-0.20.0-dev-setup.exe`。
  - [x] 记录安装包 SHA256。
- 交付记录:2026-08-29 已重新封装包含 R-006 大文件优化的 NSIS 安装包与 ZIP;安装包 SHA256 为 `96B21A454BEAD009D08D9F099454886ABDD522BEF42903FB3A1F442EC1C882B7`。
- 状态:已交付
- 更新:2026-09-23

## R-006 大文件快速打开
- 描述:优化 WYSIWYG 编辑器的大文件装载链路,使约 143K 的 Markdown 文件能够明显更快地打开,且不牺牲解析与引用定义正确性。
- 验收标准:
  - [x] 初次渲染同一文档版本时,引用定义收集及其全文状态拷贝最多执行一次,不随内容块数量重复。
  - [x] Markdown 块 token 按线性方式消费,不再对大 token 数组重复执行头部移除或插入。
  - [x] 约 143K 多段落样本的解析与装载基准相对修改前明显改善,并记录对比数据:2245ms → 172ms。
  - [x] 同块数引用定义变更、嵌套列表和普通小文档的自动化测试通过。
  - [x] `@muyajs/core` 相关单元测试与类型检查通过。
- 状态:已交付
- 更新:2026-08-29

## R-008 构建版本默认中文菜单
- 描述:修改项目源码,让构建版本默认使用简体中文菜单。
- 验收标准:
  - [x] 新安装和缺少语言字段的配置使用 `zh-CN`,不被系统语言覆盖。
  - [x] 主进程菜单与渲染进程默认语言均为简体中文,保留已保存的语言选择。
  - [x] 默认语言、中文菜单、配置升级及切换语言的自动化测试通过。
  - [x] 生产构建通过。
- 状态:已交付。
- 更新:2026-09-23

## R-009 顶部横向菜单
- 描述:将菜单改为类似 Typora 的顶部横向排列。
- 验收标准:
  - [x] Windows / Linux 自定义标题栏展开八个中文菜单分类,替代三横线入口;macOS 与原生标题栏继续使用系统横向菜单。
  - [x] 点击分类弹出对应现有子菜单,保留动作、快捷键和动态状态;支持键盘导航。
  - [x] 窄窗口下菜单与窗口控制按钮不重叠;自动化测试与生产构建通过。
- 补充验收(2026-09-23):横向菜单整行背景一致,浅色/深色主题下均不透出左侧导航栏底色。
- 状态:已交付(含背景隔离修复)。
- 更新:2026-09-23

## R-010 将当前项目代码提交至 GitHub
- 描述:将当前本地 MarkText 改动和配套测试提交到用户 GitHub 账号下的仓库。
- 验收标准:
  - [x] 在 `nofearluo-cmyk/marktext` 的独立分支保存当前源码与相关历史改动。
  - [x] 排除依赖、安装包和运行时缓存,远程 Git tree 与本地提交内容一致。
- 状态:已交付。
- 更新:2026-10-08
