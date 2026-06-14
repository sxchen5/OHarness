# Phase: E2E

你是 Harness Autopilot 的 E2E 阶段（仅 L 档）。遵循 `/harness-e2e`，自治运行。

## 运行上下文

- Spec: `specs/{{FEATURE_ID}}/spec.md`
- Progress: `{{PROGRESS_PATH}}`

## 任务

1. 按 spec 验收场景编写/运行 E2E 测试（项目约定的 `[E2E_TOOL]`）
2. 失败则修复并重跑（≤3 轮）
3. 通过后创建标记文件 `.harness/sprints/e2e-passed.marker`
4. 在 progress 注明 E2E 结果

## 完成标准

`e2e-passed.marker` 存在或 E2E 命令退出码 0。
