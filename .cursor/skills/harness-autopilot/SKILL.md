---
name: harness-autopilot
description: 一条命令启动 Harness Autopilot 自治流水线：读懂存量、写 spec/harness 文档、执行、验证、提 PR，全程无需人工干预。
triggers:
  - harness autopilot
  - autopilot
  - 自治开发
  - 一条命令
  - autonomous harness
  - cloud agent

---

# Harness Autopilot — 单命令自治流水线

**目标**: 用户只提供需求，你作为 Cloud Agent **全程自治**完成 SpecKit + Harness 全流程，最终落盘 spec 与 harness 文档，并提交 PR。

**禁止**: 中途停下来问用户确认、等待人工 approve、跳过文档产出。

## 用户输入

```text
$ARGUMENTS
```

## 执行协议（必须严格遵守）

### Step 0 — 初始化 run

在仓库根目录执行：

```bash
node .harness/runner/autopilot.mjs init --requirement "$ARGUMENTS"
```

可选参数：

```bash
# OpenSpec 模式
node .harness/runner/autopilot.mjs init \
  --requirement "$ARGUMENTS" \
  --sdd-provider openspec \
  --openspec-change my-change-name

# 强制分档
node .harness/runner/autopilot.mjs init --requirement "$ARGUMENTS" --tier S
```

记录返回的 `run_id`、`feature_id`、`branch`、`tier`、`sdd_provider`。

若 `$ARGUMENTS` 是文件路径（以 `@` 或 `.md` 结尾），改用：

```bash
node .harness/runner/autopilot.mjs init --requirement "$(cat <文件路径>)"
```

### Step 1 — 阶段循环（直到 DONE）

循环执行以下步骤，**不得中断等待用户**：

```
while phase != DONE:
  1. node .harness/runner/autopilot.mjs prompt --run <run_id>   # 获取当前阶段指令
  2. 按 prompt 完成当前阶段全部工作（读写磁盘文件，不靠对话记忆）
  3. node .harness/runner/autopilot.mjs gate --run <run_id>     # 程序化门禁
  4. 若 gate 通过 → node .harness/runner/autopilot.mjs advance --run <run_id>
  5. 若 gate 失败 → 自行修复后重试 gate（每阶段最多 3 轮）
  6. EXEC 阶段：若 gate 报告 tasks pending，继续执行本阶段，不要 advance
```

### Step 2 — 各阶段要点

| Phase | 你必须做的事 | 关键产出 |
|-------|-------------|---------|
| INIT | 建分支、`specs/<feature_id>/` 目录 | `decisions.log` |
| DISCOVER | 扫描存量代码库 | `discovery.md` (≥20行) |
| OPSX_PROPOSE | OpenSpec 模式：生成 change | `openspec/changes/<name>/` |
| SPECIFY | 写 spec，自治假设写 Clarifications | `specs/<id>/spec.md` |
| PLAN_TASKS | 写 plan + tasks（按 tier） | `plan.md`, `tasks.md` |
| SPRINT | 写 sprint 计划与 progress | `.harness/sprints/sprint-*.md` |
| EXEC | 按 harness-exec 执行批次任务 + verify-l1 | 代码 + 更新 progress |
| EVAL | L2 契约/场景验证 | progress 标 L2:✅ |
| E2E | 仅 L 档 | `e2e-passed.marker` |
| CLOSE | metrics + run-report | `metrics/*.json`, `run-report.md` |
| PR | push + 创建 PR | PR URL 写入 state |

阶段 prompt 模板位于 `.harness/runner/prompts/<PHASE>.md`。

### Step 3 — 自治决策规则

1. **歧义**: 参照 `discovery.md` + 存量代码 + `constitution.md` 做保守假设 → 写入 `spec.md § Clarifications` 和 `decisions.log`
2. **阻断任务**: 标记 `⚠️ BLOCKED`，继续无依赖任务（不中止整个 run）
3. **修正**: 每任务/fix 最多 3 轮，参照 `.harness/prompts/corrector.md`
4. **上下文**: 每阶段只读当前 phase 所需文件；EXEC 按 batch 分段，遵循 `.harness/prompts/executor.md`
5. **提交**: 每批次完成后 `git commit`；最终 `git push -u origin <branch>` 并创建 draft PR

### Step 4 — 门禁与验证

- L1: `bash .harness/scripts/verify-l1.sh`
- L2: 按 `.harness/prompts/evaluator.md` Level 2
- 程序化判定: `node .harness/runner/autopilot.mjs gate --run <run_id>`

**不要**用 LLM 自评代替 gate 脚本结果。

### Step 5 — 完成报告

run 结束后输出：

1. Run ID 与 PR URL
2. 产出文档路径清单（spec + harness）
3. `run-report.md` 摘要
4. 若有 BLOCKED 项，列出及原因

## 配置

- 自治策略: `.harness/config/autopilot.yaml`
- 分档工作流: `.harness/workflows/tier-{S,M,L}.yaml`
- 项目命令覆盖: `.harness/config/project-commands.yaml`

## 与现有命令的关系

Autopilot **编排**现有能力，不替代：

- Spec 阶段对齐 `/speckit-specify`、`/speckit-plan`、`/speckit-tasks`
- 执行阶段对齐 `/harness-exec`、`/harness-eval`、`/harness-fix`
- 收官对齐 `/harness-checkpoint`、`/harness-metrics`

接入 Autopilot 后，**不要**再单独调用上述命令，除非自治 run 失败需手动恢复。

## 恢复中断的 run

```bash
node .harness/runner/autopilot.mjs resume              # 最近失败/中断
node .harness/runner/autopilot.mjs resume --run <id> # 指定 run
```

## VM 沙箱（L1）

```bash
HARNESS_SANDBOX=1 bash .harness/scripts/verify-l1.sh
```

## 项目宪法

权威路径：`.harness/constitution.md`（各阶段 prompt 通过 `{{CONSTITUTION_PATH}}` 引用）

## OpenSpec 模式

```bash
node .harness/runner/autopilot.mjs init \
  --requirement "需求" \
  --sdd-provider openspec \
  --openspec-change add-dark-mode

# 已有 change 时手动同步
node .harness/runner/autopilot.mjs sync-openspec --change add-dark-mode
```

OpenSpec change 自动映射为 `specs/<feature>/`，Harness 执行内核不变。

## Phase 4 能力

### 策略学习

```bash
node .harness/runner/autopilot.mjs learn-policy
# 写入 .harness/config/learned-policy.json，init/run 自动应用
```

### Monorepo scope

```bash
node .harness/runner/autopilot.mjs scope-generate --run <id>
# 配置: .harness/config/monorepo.yaml
```

### PR（draft + reviewers）

```bash
node .harness/runner/autopilot.mjs create-pr --run <id>
# 配置: autopilot.yaml → pr.mode / pr.required_reviewers
```

### 并行 sub-agent EXEC

`[P]` 任务在 EXEC 阶段自动多进程并行（需 Cursor CLI）。

## Phase 5 能力

### 策略写回 YAML

```bash
node .harness/runner/autopilot.mjs learn-policy --write
# 写入 autopilot-learned.yaml，config 加载时自动合并
```

### 多 run 队列

```bash
node .harness/runner/autopilot.mjs queue-add --requirement "需求 B"
node .harness/runner/autopilot.mjs queue-process --max 3
# Webhook: HARNESS_QUEUE=1
```

### 度量 API / 大屏

```bash
node .harness/runner/metrics-api.mjs --port 4177
# 平台大屏 → Autopilot 视图（需选定单个 Git 仓库）
```

### E2E 沙箱

```bash
HARNESS_E2E_SANDBOX=1 bash .harness/scripts/e2e-sandbox.sh
```

## 参考

- 编排器文档: `.harness/runner/README.md`
- Harness 框架: `.harness/README.original.md`
