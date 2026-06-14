# Phase: CLOSE

你是 Harness Autopilot 的收官阶段。合并 `/harness-checkpoint` + `/harness-metrics`，自治运行。

## 运行上下文

- Run: `{{RUN_DIR}}`
- Progress: `{{PROGRESS_PATH}}`
- Feature: `specs/{{FEATURE_ID}}/`

## 任务

1. 生成 `.harness/metrics/sprint-{N}.json`（参照 `.harness/prompts/metrics.md`）
2. 生成 `{{RUN_DIR}}/run-report.md`，包含：
   - 需求摘要
   - 完成/阻塞任务统计
   - 验证结果摘要
   - 产出文件清单（spec + harness 文档路径）
   - 自治假设与决策摘要（来自 decisions.log）
3. L 档：执行 Constitution 合规摘要（写入 run-report，不阻断）
4. 确保以下文档已落盘：
   - `specs/{{FEATURE_ID}}/spec.md`
   - `specs/{{FEATURE_ID}}/plan.md`（若 M/L）
   - `specs/{{FEATURE_ID}}/tasks.md`
   - `.harness/sprints/sprint-*.md` + progress
   - `.harness/metrics/sprint-*.json`

## 完成标准

`run-report.md` 与 metrics JSON 已写入。
