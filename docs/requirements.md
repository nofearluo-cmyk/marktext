# 需求与验收标准

> 权威来源:本项目"要做什么 + 做到什么程度算完成"以本文件为准。
> 与会话记忆冲突时以此为准。变更需求 = 改这里,不要只在对话里说。

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
  - [x] `pnpm -C packages/desktop exec vitest run test/unit/specs/trailing-throttle.spec.ts test/unit/specs/deferred-content-change.spec.ts` 通过。
  - [x] `pnpm -C packages/desktop exec playwright test test/e2e/source-viewport.spec.ts test/e2e/selection-ipc-throttle.spec.ts test/e2e/editor-derived-content.spec.ts test/e2e/editor-input.spec.ts test/e2e/view-modes.spec.ts test/e2e/menu-sanity.spec.ts` 通过。
  - [x] `pnpm run typecheck` 通过。
- 状态:已交付
- 更新:2026-06-24
