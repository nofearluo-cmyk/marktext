# 当前状态

> 权威来源:项目当前进展、在做什么、还剩什么以本文件为准。
> 每轮开工先读,收尾必回写。这是跨会话的真相,不要凭记忆复述。
>
> 最后更新:2026-10-08 / GitHub 代码提交完成

## 进行中
- [ ] [任务] — 关联 R-00X — 进展:[做到哪了] — 下一步:[具体动作]

## 待办 (backlog)
- [ ] [任务] — 关联 R-00X — 备注:[依赖 / 优先级]
- [ ] MarkText 流畅度优化 Phase 2 — 关联 R-004 — 备注:评估文件流式读取、macOS watcher 原生事件、getState 深拷贝削减

## 已完成 (最近)
- [x] GitHub 提交 — 关联 R-010 — 2026-10-08 — 已推送至 `https://github.com/nofearluo-cmyk/marktext/tree/codex/chinese-menu-performance`;远程源码提交 `1fbbd5d31444eb1218fe05c633d6cda22dd21855` 与本地 HEAD 完全一致,保留原有提交历史。`origin` 保留官方仓库,新增 `github` 指向个人 Fork;依赖、安装包及运行时缓存未纳入提交。
- 验证:R-010 提交前桌面聚焦单测 26 项、Muya 大文件单测 6 项及 `pnpm run typecheck` 通过;提交差异空白检查通过。下一步:本轮无进行中事项,性能 Phase 2 仍在 backlog。
- [x] 最新中文菜单版双平台安装包 — 关联 R-005 / R-007 / R-008 / R-009 — 2026-09-23 — 目录:`dist/release-20260923/`;Windows x64 NSIS 安装包和 ZIP,macOS arm64 DMG 和 ZIP。包含中文默认语言、横向菜单与导航栏背景隔离修复。旧安装包保留。
- 验证:Windows/macOS 打包后应用启动、测试文档显示、中文菜单、ced/keytar/native-keymap 加载全部通过;Windows 横向菜单与不透明背景检查通过,ZIP 内 app.asar 与验证过的应用一致;Mac codesign --verify --deep --strict、hdiutil verify 通过。Mac 15 项相关单测通过;键盘单测增加监听挂载后 1ms 等待,消除 Vue 同毫秒冒泡事件过滤导致的跨平台测试偶发失败,Windows 复测通过。两端同步源码快照 1642 文件校验一致。
- SHA256:Windows EXE `c61c9c439b1a05ab2797b707b07402c47ded91674794e839907c640b02b99443`;Windows ZIP `090114dc4f905dc2a1184d2c9c268cd3755d5c755aba3f24cc9440c8748bc7b2`;Mac DMG `b03a2f2a972c4d31c1d296c20af624cf0f6e58d0b212785f13b862fe8189b22d`;Mac ZIP `42ae677b0f04f9d012d16e18949ee6f8a5427cc0de65768e0add5a93fcd4fc2c`。校验清单:`dist/release-20260923/SHA256SUMS.txt`。
- 构建说明:Windows 沿用已验证的 ABI 146 原生模块;Mac 将 Windows CRLF 权限 plist 用 plutil 转成标准 XML 副本后传给 electron-builder 完成 ad-hoc 签名,源码权限内容未改。Windows 未签名,Mac 未公证。构建/验证脚本及截图见产物目录 build-info,Mac 远程日志:`/Users/nofear/work/.marktext-transfer-20260923/`。下一步:可安装使用,本轮无进行中事项。

- [x] 菜单与导航栏背景隔离 — 关联 R-009 — 2026-09-23 — 自定义横向菜单设置 `--editorBgColor` 不透明背景,阻止侧栏灰底透出顶部菜单;不改变侧栏内容位置。
- 验证:新增 E2E 修复前因菜单透明失败、修复后通过;菜单 E2E 共 4 项通过(包含浅色/深色主题和 550/1000 像素布局);生产构建、定向 ESLint 无错误。截图:`packages/desktop/test-results/horizontal-menu-background.png`。下一步:按需打包,本轮无进行中事项。

- [x] 顶部横向菜单 — 关联 R-009 / D-004 — 2026-09-23 — 自定义标题栏显示八个中文分类按钮,点击展开对应原生子菜单;支持方向键、Home/End、向下键展开,保留用户选择的语言、快捷键和动态菜单状态。
- 验证:R-009 与 R-008 聚焦单元测试 15 项、菜单 E2E 3 项通过;1000/550 像素宽度布局不遮挡窗口按钮;`pnpm run typecheck`、生产构建、定向 ESLint(无错误)通过。截图:`packages/desktop/test-results/horizontal-menu.png`。全量桌面单测 489/491 通过,两项图片路径测试在 Windows 上因 POSIX 路径断言失败,不涉及菜单模块。
- 环境:R-009 桌面启动缺失 `ced/build/Release/ced.node`,已从现有 Windows ZIP 恢复同 ABI 146 的模块后完成 E2E;本机缺少可用 Visual Studio,原生模块重新编译仍不可用。下一步:按需重新打包安装包;本轮未生成安装包,无 R-009 进行中事项。

- [x] 构建版本默认简体中文菜单 — 关联 R-008 / D-003 — 2026-09-23 — 默认配置、主进程与渲染进程语言改为 `zh-CN`,移除首次启动的系统语言覆盖,保留已有语言偏好。
- 验证:R-008 两份单元测试共 9 项通过;涉及 TypeScript 文件定向 ESLint 无错误(5 个非空断言 warning);`pnpm run build` 通过。未重新生成安装包。下一步:按需打包 Windows / macOS;当前无 R-008 进行中事项。

- [x] Apple Silicon macOS 安装包 — 关联 R-007 / R-006 — 2026-09-22 — mac A `/Users/nofear/work/marktext`,分支 `codex/mac-arm64`,HEAD `8e373b664868bb433941791b50d6d7a49c86e9fa` 加本地未提交优化;隔离工具目录 `/Users/nofear/work/.marktext-build-tools`,Node 22.21.1/pnpm 10.33.4。`pnpm run build:mac:arm64` 成功,产物已复制到本机 `dist/marktext-mac-arm64-0.20.0-dev.dmg` 与同名 ZIP;远程亦保留在仓库 dist。DMG SHA256:`0AD234A5988C871E8D00FBB99F54904AF05552BB05830BAE7976E1992C8024E8`;ZIP SHA256:`8CF348A9945EAED21FFE7C0CF4182037D0A82D69DED52D87357D1FF7757989DE`;本机和远程哈希一致。ad-hoc 签名,未 Apple 公证。
- 验证:R-007 大文件相关 6 项单元测试、editor-input 3 项 E2E 通过;打包后应用启动并显示测试文档,ced/keytar/native-keymap 加载成功,进程架构 arm64 且 isPackaged=true;codesign 深度严格校验与 hdiutil verify 通过。日志保留于本机 `dist/mac-transfer/` 与远程 `/Users/nofear/work/.marktext-transfer-20260922/`。下一步:按需修复下述构建配置类型冲突;Phase 2 仍待评估。
- [x] 核查近期性能优化改动 — 关联 R-004 / R-006 — 2026-09-22 — 已确认 Phase 1 在 6 月 24 日提交;R-006 的引用定义缓存、token 栈式消费与行内节点聚合优化仍在本地未提交工作区,配套两份新增测试亦未跟踪。本轮仅核查代码与历史记录,未重跑性能基准或测试;下一步仍为 Phase 2 评估。
- [x] 重新构建大文件性能优化版 Windows x64 分发包 — 关联 R-005 / R-006 — 2026-08-29 — 已生成 NSIS 安装包与 ZIP,并验证 ZIP 内 `app.asar` 与最新生产渲染包哈希一致、原生模块可加载
- [x] 大文件快速打开优化 — 关联 R-006 — 2026-08-29 — 143K/2100 段样本从 2245ms 降至 172ms,全文状态读取从 2101 次降为常数级; 753 项非网络单元测试、类型检查、定向 lint 与桌面生产构建通过
- [x] 构建 Windows x64 可分发安装包 — 关联 R-005 — 2026-06-24 — 产物:`dist/marktext-win-x64-0.20.0-dev-setup.exe`
- [x] MarkText 流畅度优化 Phase 1: 源码模式有限 viewport、选择 IPC 节流、WYSIWYG 派生数据延迟计算 — 关联 R-004 — 2026-06-24
- [x] 写入 MarkText 流畅度优化 Phase 1 可执行计划 — 关联 R-004 — 2026-06-24 — 文档:`docs/superpowers/plans/2026-06-24-marktext-smoothness-phase1.md`
- [x] 评估 MarkText 性能优化空间,确认已有性能路线图与源码热点基本吻合 — 关联 R-004 — 2026-06-24
- [x] 为 `AGENTS.md` 增加代码必须配套自动化测试的严控规则 — 关联 R-003 — 2026-06-16
- [x] [任务] — 关联 R-00X — [YYYY-MM-DD]

## 阻塞 / 待确认
- [遗留问题] R-007 — `pnpm run typecheck` 在 `packages/desktop/electron.vite.config.ts:94` 报 TS2769:plugin-vue 关联 Vite 8 与 electron-vite 使用的 Vite 7 插件类型不兼容。本轮未修改应用代码/依赖版本;生产构建与运行验证通过,但不宣称全量类型检查通过。日志:`dist/mac-transfer/typecheck.log`。
- [已解除] R-007 SSH 认证阻塞 — 按全局 AGENTS.md 使用 nofear 与本机 Ed25519 密钥登录成功,远程仓库已创建。
- [问题] — 卡在:[原因] — 需要:[谁 / 什么来解]

## 任务更新 2026-06-24
- [x] MarkText Smoothness Phase 1 Task 3 — 关联 R-004 — 已完成: WYSIWYG `json-change` 即时路径仅更新 markdown/cursor/synthetic history/save-dirty 状态, wordCount/TOC/blocks 延后到用户空闲约 150ms 后更新; 已新增单元测试与 E2E 覆盖; 验证通过: `pnpm -C packages/desktop exec vitest run test/unit/specs/deferred-content-change.spec.ts`, `pnpm -C packages/desktop exec playwright test test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/tabs.spec.ts`, `pnpm run typecheck`。
- [x] MarkText Smoothness Phase 1 final verification — 关联 R-004 — 已完成:聚焦 Vitest、聚焦 Playwright、`pnpm run typecheck`、`pnpm run lint` 通过; lint 仍有 77 个既有 warning。
- [x] MarkText Smoothness Phase 1 review follow-up — 关联 R-004 — 已完成:修复 source-mode 进入时 pending selection 菜单 IPC 失效问题,新增 `selection-menu-state.spec.ts`; 清理 `docs/requirements.md` 尾随空白。重复 derived 计算风险保留到 Phase 2 评估。
- [x] Windows x64 installer build — 关联 R-005 — 已完成:`pnpm run build:win` 成功,生成 NSIS 安装包和 zip; 安装包 SHA256: `42BA5EFC27A74E64FCAA12F03037BF63484A7180659A6DC3A2025137F84213B1`; 本地构建未配置数字签名证书。
- [x] Large document loading — 关联 R-006 — 已完成:引用定义按 JSONState revision 缓存,Markdown token 改为栈式线性消费,行内 VNode 聚合移除累积 spread; 新增 143K 装载、同块数引用定义更新、嵌套列表与大 token 流自动化覆盖。
- [x] Windows x64 performance build — 关联 R-005 / R-006 — 产物:`dist/marktext-win-x64-0.20.0-dev-setup.exe` 与 `dist/marktext-win-x64-0.20.0-dev.zip`; 安装包 SHA256:`96B21A454BEAD009D08D9F099454886ABDD522BEF42903FB3A1F442EC1C882B7`; ZIP SHA256:`E423466F1A4A099BF2731E3838E45C82EA35E5F068E51535329D6626010FC90F`; 未配置数字签名证书。
- 验证备注:R-006 全量 Muya 测试中 753 项通过; `parityExportHtml.spec.ts` 的 1 项离线导出测试因当前环境无法访问网络而超时,与本次改动无关; Electron E2E 因当前 Windows 网络栈无法启动 DevTools 调试端口而未运行。
- 下一步: 评估 Phase 2 backlog:文件流式读取、macOS watcher 原生事件、getState 深拷贝削减。
