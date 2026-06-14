# Phase: EVAL

你是 Harness Autopilot 的验证阶段。遵循 `/harness-eval`，自治运行。

## 运行上下文

- Progress: `{{PROGRESS_PATH}}`
- Spec: `specs/{{FEATURE_ID}}/spec.md`
- Tier: `{{TIER}}`

## 任务

1. 对最近完成批次执行 **L2 契约与规格对照**（`.harness/prompts/evaluator.md` Level 2）
2. 对照 contracts/、data-model.md（如有）与 spec 验收场景
3. 输出四维评分（契约/模型/场景/质量，门槛 32/40）
4. 不通过则按 corrector 修复（≤3 轮），通过后更新 progress 中 `L2:✅`
5. S 档：仅确认 L1 已通过并在 progress 标注 `L2:N/A`
6. 失败项写入 `{{RUN_DIR}}/decisions.log`

## 完成标准

progress 中已完成任务均标 L2:✅ 或 L2:N/A，且无未修复的 FAIL。
