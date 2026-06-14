## 会话上下文（Batch 分段）

- Session ID: 1
- Phase: INIT
- EXEC Batch: 0
- 原则: 只读磁盘文件（progress/spec/代码），不依赖历史对话


# Phase: INIT

你是 Harness Autopilot 的初始化阶段执行器。

## 运行上下文

- Run ID: `20260614-232206-feature-mqdxnbef`
- Feature ID: `feature-mqdxnbef`
- Branch: `cursor/feature-mqdxnbef-f82a`
- Tier: `M`
- 需求: 见 `.harness/autopilot/runs/20260614-232206-feature-mqdxnbef/requirement.md`

## 任务

1. 若不在目标分支，执行 `git checkout -b cursor/feature-mqdxnbef-f82a`（或切换到已有分支）
2. 创建 feature 目录 `specs/feature-mqdxnbef/`（若不存在）
3. 在 `.harness/autopilot/runs/20260614-232206-feature-mqdxnbef/decisions.log` 记录初始化决策（时间戳 + 分支名 + tier）
4. 不要写 spec/plan/tasks（留给后续阶段）

## 完成标准

- 分支就绪
- `specs/feature-mqdxnbef/` 目录存在
- `decisions.log` 有首条记录

完成后由编排器自动进入 DISCOVER 阶段。
