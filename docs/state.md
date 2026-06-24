# 当前状态

> 权威来源:项目当前进展、在做什么、还剩什么以本文件为准。
> 每轮开工先读,收尾必回写。这是跨会话的真相,不要凭记忆复述。
>
> 最后更新:2026-06-24 / MarkText Smoothness Phase 1 final verification

## 进行中
- [ ] [任务] — 关联 R-00X — 进展:[做到哪了] — 下一步:[具体动作]

## 待办 (backlog)
- [ ] [任务] — 关联 R-00X — 备注:[依赖 / 优先级]
- [ ] MarkText 流畅度优化 Phase 2 — 关联 R-004 — 备注:评估文件流式读取、macOS watcher 原生事件、getState 深拷贝削减

## 已完成 (最近)
- [x] MarkText 流畅度优化 Phase 1: 源码模式有限 viewport、选择 IPC 节流、WYSIWYG 派生数据延迟计算 — 关联 R-004 — 2026-06-24
- [x] 写入 MarkText 流畅度优化 Phase 1 可执行计划 — 关联 R-004 — 2026-06-24 — 文档:`docs/superpowers/plans/2026-06-24-marktext-smoothness-phase1.md`
- [x] 评估 MarkText 性能优化空间,确认已有性能路线图与源码热点基本吻合 — 关联 R-004 — 2026-06-24
- [x] 为 `AGENTS.md` 增加代码必须配套自动化测试的严控规则 — 关联 R-003 — 2026-06-16
- [x] [任务] — 关联 R-00X — [YYYY-MM-DD]

## 阻塞 / 待确认
- [待确认] 性能优化优先目标未量化 — 卡在:尚未确认优先改善打字延迟、大文件打开、长文档滚动、启动速度中的哪一类 — 需要:确认首批优化范围与验收指标
- [问题] — 卡在:[原因] — 需要:[谁 / 什么来解]

## 任务更新 2026-06-24
- [x] MarkText Smoothness Phase 1 Task 3 — 关联 R-004 — 已完成: WYSIWYG `json-change` 即时路径仅更新 markdown/cursor/synthetic history/save-dirty 状态, wordCount/TOC/blocks 延后到用户空闲约 150ms 后更新; 已新增单元测试与 E2E 覆盖; 验证通过: `pnpm -C packages/desktop exec vitest run test/unit/specs/deferred-content-change.spec.ts`, `pnpm -C packages/desktop exec playwright test test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/tabs.spec.ts`, `pnpm run typecheck`。
- [x] MarkText Smoothness Phase 1 final verification — 关联 R-004 — 已完成:聚焦 Vitest、聚焦 Playwright、`pnpm run typecheck`、`pnpm run lint` 通过; lint 仍有 77 个既有 warning。
- 下一步: 评估 Phase 2 backlog:文件流式读取、macOS watcher 原生事件、getState 深拷贝削减。
