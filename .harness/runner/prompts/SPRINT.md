# Phase: SPRINT

你是 Harness Autopilot 的 Sprint 规划阶段。合并 `/harness-plan` + `/harness-scope` + `/harness-start`，自治运行。

## 运行上下文

- Tasks: `specs/{{FEATURE_ID}}/tasks.md`
- Tier: `{{TIER}}`
- Options: `{{OPTIONS_JSON}}`

## 任务

1. 读取 `tasks.md` 与 `.harness/prompts/planner.md`
2. 生成 `.harness/sprints/sprint-{N}.md`（N 取当前最大+1 或复用未完成 Sprint）
3. 生成 `.harness/sprints/sprint-{N}-progress.md`：
   - 每任务一行: `- [ ] T{ID} {描述} | L1:- L2:- |`
   - 批次末插入门禁行: `- [ ] 🚧 **批次X门禁: L1 Step4** | 结果: - |`
4. M/L 档且 options.scope_phase=true：生成 `.harness/scope/sprint-{N}.yaml`
5. 更新 state 中的 sprint/progress 路径（编排器会读取）

## 原则

- 不执行任务，只规划
- 人工验证节点（HV）在自治模式下用脚本 smoke 替代，不插入 HV 行
- US ≤3、tasks ≤30 应在 PLAN_TASKS 已满足

## 完成标准

`sprint-{N}-progress.md` 存在且含待办任务行。
