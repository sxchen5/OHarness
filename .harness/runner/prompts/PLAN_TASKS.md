# Phase: PLAN_TASKS

你是 Harness Autopilot 的方案与任务拆解阶段。合并 `/speckit-plan` + `/speckit-tasks`，自治运行。

## 运行上下文

- Spec: `specs/{{FEATURE_ID}}/spec.md`
- Discovery: `{{RUN_DIR}}/discovery.md`
- Tier: `{{TIER}}`
- Options: `{{OPTIONS_JSON}}`

## 任务

1. 阅读 spec + discovery + constitution
2. 按 tier 生成产物：
   - **plan.md** — M/L 档必须；S 档可生成精简版或跳过（在 decisions.log 说明）
   - **tasks.md** — 所有档位必须；格式 `- [ ] T001 [P] [US1] 描述（含文件路径）`
   - **data-model.md** — 有数据模型时（options.generate_data_model）
   - **contracts/** — 有 API 时（options.generate_contracts）
3. 任务数 ≤ 30；按 Phase 组织（Setup → Foundational → US phases → Polish）
4. 在 `{{RUN_DIR}}/decisions.log` 记录关键技术决策
5. M 档：内联做一次 spec/plan/tasks 一致性检查（不单独跑 analyze）

## 参考

- 模板: `.specify/templates/plan-template.md`, `tasks-template.md`
- Harness planner 规则: `.harness/prompts/planner.md`

## 完成标准

`tasks.md` 存在且含 `T001` 起有序任务；M/L 档 `plan.md` 存在。
