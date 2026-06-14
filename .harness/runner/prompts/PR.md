# Phase: PR

你是 Harness Autopilot 的交付阶段。自治创建 Pull Request。

## 运行上下文

- Branch: `{{BRANCH}}`
- Run report: `{{RUN_DIR}}/run-report.md`
- Base branch: `main`（或 `HARNESS_BASE_BRANCH`）
- PR 模式: **draft**（默认）· 配置见 `.harness/config/autopilot.yaml` → `pr`

## 任务

### 方式 A — 编排器自动（优先）

```bash
node .harness/runner/autopilot.mjs create-pr --run {{RUN_ID}}
```

### 方式 B — 手工

1. `git status` — 确保所有改动已提交
2. `git push -u origin {{BRANCH}}`
3. `gh pr create --draft --base main --head {{BRANCH}}` \
   --title `[Autopilot] {{FEATURE_ID}}` \
   --body-file `{{RUN_DIR}}/run-report.md` \
   --label autopilot
4. 若配置了 `pr.required_reviewers`，追加 `--reviewer <user>`
5. 将 PR URL 写入 state.json 的 `pr_url`

## 原则

- 验证未通过时不创建 PR（`autonomy.pr: on-success`）
- PR 正文必须链接 specs 与 .harness 产出路径
- Draft PR 等待人工 review 后可 `gh pr ready`

## 完成标准

`pr_url` 已写入 state 或 gate 可检测到 PR 已创建。
