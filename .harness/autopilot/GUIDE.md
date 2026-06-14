# Harness Autopilot 完整使用教程

> 一条命令（或一次 Webhook）完成：**读懂存量 → 写 spec/harness 文档 → 编码 → 验证 → 提 PR**。  
> 编排器用 Node 状态机记进度，每阶段独立 Agent 会话，不依赖对话记忆。

---

## 目录

1. [前置条件](#1-前置条件)
2. [拷贝到新 Git 项目](#2-拷贝到新-git-项目)
3. [项目初始化与配置](#3-项目初始化与配置)
4. [方式一：Cursor IDE Skill（推荐）](#4-方式一cursor-ide-skill推荐)
5. [方式二：CLI 全自动（需 Cursor CLI）](#5-方式二cli-全自动需-cursor-cli)
6. [方式三：CLI 分步 / in-process（无 CLI 时）](#6-方式三cli-分步--in-process无-cli-时)
7. [方式四：GitLab Webhook / 服务器任务](#7-方式四gitlab-webhook--服务器任务)
8. [方式五：队列模式（多需求串行）](#8-方式五队列模式多需求串行)
9. [方式六：OpenSpec 模式](#9-方式六openspec-模式)
10. [方式七：Cloud Agent / 远程 Agent](#10-方式七cloud-agent--远程-agent)
11. [恢复、策略学习与高级能力](#11-恢复策略学习与高级能力)
12. [度量大屏为何显示「暂无记录」](#12-度量大屏为何显示暂无记录)
13. [产出物与目录说明](#13-产出物与目录说明)
14. [常见问题](#14-常见问题)

---

## 1. 前置条件

| 依赖 | 用途 | 是否必须 |
|------|------|----------|
| **Git 仓库** | 分支、提交、PR | 必须 |
| **Node.js ≥ 18** | 运行 `autopilot.mjs` | 必须 |
| **Cursor IDE** 或任意能执行 shell 的环境 | 执行命令 / Agent | 必须 |
| **Cursor CLI `agent`** | `run` 全自动多阶段 | 可选（无则走 in-process） |
| **GitHub CLI `gh`** | 自动创建 draft PR | 可选（无则手动 PR） |
| **Docker** | L1/E2E 沙箱 | 可选 |
| **扫描协作平台** | 度量大屏 Autopilot 视图 | 可选 |

验证环境：

```bash
node -v          # v18+
git --version
command -v agent # 有则支持全自动 run
command -v gh    # 有则支持 create-pr
```

---

## 2. 拷贝到新 Git 项目

假设源仓库为 `AI-Webhooks`，目标为新项目 `my-app`：

```bash
cd /path/to/my-app

# 源仓库路径（按实际修改）
SRC=/path/to/AI-Webhooks
```

### 2.1 最小可运行集（只要 Autopilot）

拷贝以下目录/文件即可跑通流水线：

```bash
# Harness 编排内核（必需）
cp -r "$SRC/.harness" .

# Cursor 入口 Skill（IDE 用 /harness-autopilot）
mkdir -p .cursor/skills
cp -r "$SRC/.cursor/skills/harness-autopilot" .cursor/skills/

# Webhook 脚本（仅服务器 Webhook 场景需要）
mkdir -p scripts
cp "$SRC/scripts/cursor-gitlab-webhook-code.sh" scripts/
chmod +x scripts/cursor-gitlab-webhook-code.sh
cp -r "$SRC/.cursor/skills/gitlab-webhook-cursor-code" .cursor/skills/  # 可选
```

**`.harness` 最小子集说明**（若你想手工裁剪，至少保留）：

```
.harness/
├── constitution.md              # 项目宪法（Harness 权威）
├── config/
│   ├── autopilot.yaml           # 自治策略（必需）
│   └── project-commands.yaml    # L1 test/build/lint 覆盖（强烈建议）
├── workflows/
│   ├── tier-S.yaml
│   ├── tier-M.yaml
│   └── tier-L.yaml
├── runner/
│   ├── autopilot.mjs            # 主编排器
│   ├── gates.mjs
│   ├── session-launcher.sh
│   ├── prompts/                 # 各阶段 prompt（全部）
│   └── lib/                     # 全部 .mjs
├── scripts/
│   ├── verify-l1.sh
│   ├── verify-l1-inner.sh
│   ├── sandbox-run.sh           # 沙箱可选
│   └── e2e-sandbox.sh           # E2E 可选
├── sandbox/                       # 沙箱可选
│   ├── Dockerfile
│   └── Dockerfile.e2e
├── prompts/                       # executor/evaluator/corrector 等（必需）
│   ├── executor.md
│   ├── evaluator.md
│   ├── corrector.md
│   ├── generator.md
│   ├── planner.md
│   └── metrics.md
└── autopilot/
    ├── ROADMAP.md
    └── GUIDE.md                   # 本文件
```

运行时还会自动创建（无需预先拷贝）：

- `specs/<feature>/` — spec/plan/tasks
- `.harness/sprints/` — sprint 计划与 progress
- `.harness/autopilot/runs/<run-id>/` — 状态与报告
- `.harness/metrics/autopilot-*.json` — 度量（run 结束时）

### 2.2 推荐完整集（SpecKit 兼容 + 手动 Harness 回退）

在最小集基础上，建议再拷贝：

```bash
# SpecKit 模板与宪法副本（SPECIFY/PLAN 阶段对齐 speckit 约定）
cp -r "$SRC/.specify" .

# 其余 Harness skills（run 失败时手动单步）
for s in harness-exec harness-eval harness-fix harness-plan harness-start \
         harness-checkpoint harness-metrics harness-scope harness-e2e; do
  cp -r "$SRC/.cursor/skills/$s" .cursor/skills/
done

# SpecKit skills（仅需手动 speckit 时）
for s in speckit-specify speckit-plan speckit-tasks speckit-implement; do
  cp -r "$SRC/.cursor/skills/$s" .cursor/skills/
done
```

### 2.3 不需要拷贝到新业务仓库的内容

| 路径 | 说明 |
|------|------|
| `scan-platform-backend/`、`scan-platform-frontend/` | 度量大屏平台，独立部署 |
| `.harness/prompts/profiles/ran-baseband/` | 领域定制 profile，一般业务可删 |
| `.harness/metrics/autopilot-*.json` | 运行产物，应 gitignore |
| `.harness/autopilot/runs/` | 本地 run 状态，应 gitignore |

### 2.4 在新项目 `.gitignore` 追加

```gitignore
# Harness Autopilot 本地运行态（建议忽略）
.harness/autopilot/runs/
.harness/metrics/autopilot-*.json
.harness/metrics/latest-autopilot.json
.harness/config/learned-policy.json
.harness/config/autopilot-learned.yaml
.harness/queue/pending.jsonl
.harness/queue/status.json
.harness/sprints/e2e-passed.marker
```

保留 `.gitkeep`（若源仓库有）以便空目录可提交。

### 2.5 首次提交

```bash
git add .harness .cursor/skills/harness-autopilot scripts/
git add .specify   # 若拷贝了
git commit -m "chore: bootstrap Harness Autopilot"
git push
```

---

## 3. 项目初始化与配置

### 3.1 配置 L1 验证命令（重要）

编辑 `.harness/config/project-commands.yaml`，写入你项目的 test/build：

```yaml
test: "npm test"
build: "npm run build"
lint: "npm run lint"
```

若不配置，`verify-l1.sh` 会尝试自动探测（`package.json` scripts、`pom.xml` 等）。

### 3.2 调整自治策略

编辑 `.harness/config/autopilot.yaml` 常用项：

```yaml
tier_detection:
  default: M          # 默认中档

git:
  branch_prefix: "cursor"
  branch_suffix: "f82a"

pr:
  mode: draft
  base_branch: main

sdd:
  provider: speckit   # 或 openspec
```

### 3.3 自定义宪法

复制并修改 `.harness/constitution.md` 为你的团队原则。Autopilot 各阶段通过 `{{CONSTITUTION_PATH}}` 引用此文件。

---

## 4. 方式一：Cursor IDE Skill（推荐）

### 4.1 触发

在 Cursor 聊天框输入：

```text
/harness-autopilot 实现用户 JWT 登录接口，含单元测试
```

或自然语言（Skill 描述含触发词）：

```text
用 autopilot 自治开发：给订单模块增加取消接口
```

### 4.2 Agent 应执行的协议

Skill 文件：`.cursor/skills/harness-autopilot/SKILL.md`

核心循环：

```bash
# 0. 初始化
node .harness/runner/autopilot.mjs init --requirement "你的需求"

# 1. 直到 DONE
node .harness/runner/autopilot.mjs prompt --run <run_id>   # 读指令
# …按 prompt 改文件…
node .harness/runner/autopilot.mjs gate --run <run_id>     # 门禁
node .harness/runner/autopilot.mjs advance --run <run_id>  # 下一阶段
```

### 4.3 分档示例

```bash
# 小改动（S 档：无 E2E、精简 plan）
node .harness/runner/autopilot.mjs init --requirement "修复登录页按钮样式" --tier S

# 大改造（L 档：含 E2E）
node .harness/runner/autopilot.mjs init --requirement "订单模块微服务化改造" --tier L
```

---

## 5. 方式二：CLI 全自动（需 Cursor CLI）

安装 [Cursor CLI](https://cursor.com/docs/cli) 并确保 `agent` 在 PATH 中。

### 5.1 一条命令跑完全流程

```bash
cd /path/to/my-app

node .harness/runner/autopilot.mjs run \
  --requirement "实现 JWT 登录接口，含单元测试" \
  --create-pr
```

等价于自动：`init` → 各阶段 `prompt` + Agent 执行 + `gate` + `advance` → `DONE`。

### 5.2 常用参数

```bash
node .harness/runner/autopilot.mjs run \
  --requirement "需求描述" \
  --tier M \
  --sdd-provider speckit \
  --create-pr \
  --max-loops 50
```

### 5.3 仅检查门禁（不拉起 Agent）

```bash
node .harness/runner/autopilot.mjs gate --run <run_id>
node .harness/runner/autopilot.mjs advance --run <run_id>
```

### 5.4 查看状态

```bash
node .harness/runner/autopilot.mjs status
node .harness/runner/autopilot.mjs status --run <run_id>
node .harness/runner/autopilot.mjs list
```

---

## 6. 方式三：CLI 分步 / in-process（无 CLI 时）

未安装 `agent` 时，编排器进入 **in-process 模式**：由当前 IDE Agent（或你本人）按 prompt 执行。

### 6.1 每阶段执行一次

```bash
# 初始化
node .harness/runner/autopilot.mjs init --requirement "修复 XXX bug"

# 每个阶段：
node .harness/runner/autopilot.mjs run --in-process --run <run_id>
# → 打印当前阶段 PROMPT，你在 IDE 里完成工作

node .harness/runner/autopilot.mjs gate --run <run_id>
node .harness/runner/autopilot.mjs advance --run <run_id>

# 重复 run --in-process 直到 DONE
```

### 6.2 只渲染 prompt 不跑循环

```bash
node .harness/runner/autopilot.mjs prompt --run <run_id>
```

### 6.3 手动 init + 单步 advance

```bash
node .harness/runner/autopilot.mjs init --requirement "需求"
node .harness/runner/autopilot.mjs prompt
node .harness/runner/autopilot.mjs gate
node .harness/runner/autopilot.mjs advance
```

---

## 7. 方式四：GitLab Webhook / 服务器任务

适用于「仓库智能协作平台」或自建 Webhook 服务：POST 需求 → 服务器本地 clone → 自动开发。

### 7.1 拷贝脚本

确保目标仓库或 Webhook 服务机器上有：

- `scripts/cursor-gitlab-webhook-code.sh`
- 目标业务仓库已含 `.harness/runner/autopilot.mjs`

### 7.2 平台配置执行命令

```bash
/bin/bash /path/to/my-app/scripts/cursor-gitlab-webhook-code.sh
```

### 7.3 环境变量

| 变量 | 含义 | 默认 |
|------|------|------|
| `WEBHOOK_REQUEST_SUMMARY` | 需求说明 | — |
| `WEBHOOK_REPO_PATH` 或 `SCAN_REPO_PATH` | 本地仓库路径 | — |
| `WEBHOOK_BRANCH` | 检出分支 | — |
| `HARNESS_AUTOPILOT` | `1` Autopilot；`0` 旧版单次 agent | `1` |
| `HARNESS_TIER` | 强制 S/M/L | 自动 |
| `HARNESS_SDD_PROVIDER` | `speckit` \| `openspec` | `speckit` |
| `HARNESS_CREATE_PR` | 完成后创建 PR | `1` |
| `HARNESS_QUEUE` | `1` 队列模式 | `0` |
| `CURSOR_AGENT_BIN` | agent 路径 | `agent` |
| `CURSOR_AGENT_MODEL` | 模型 | — |

### 7.4 请求体示例

```json
{
  "branch": "main",
  "requirement": "实现 JWT 登录接口，含单元测试"
}
```

### 7.5 执行逻辑

脚本检测到 `autopilot.mjs` 且 `HARNESS_AUTOPILOT=1` 时执行：

```bash
node .harness/runner/autopilot.mjs run \
  --requirement "$WEBHOOK_REQUEST_SUMMARY" \
  --create-pr
```

### 7.6 回退旧模式（仅单次写代码，无 spec/harness）

```bash
export HARNESS_AUTOPILOT=0
bash scripts/cursor-gitlab-webhook-code.sh
```

---

## 8. 方式五：队列模式（多需求串行）

多个 Webhook 同时到达时，避免并发改同一仓库：

```bash
export HARNESS_QUEUE=1
export HARNESS_QUEUE_MAX=1
bash scripts/cursor-gitlab-webhook-code.sh
```

或手动：

```bash
node .harness/runner/autopilot.mjs queue-add --requirement "需求 A"
node .harness/runner/autopilot.mjs queue-add --requirement "需求 B"
node .harness/runner/autopilot.mjs queue-process --max 3
node .harness/runner/autopilot.mjs queue-status
```

队列文件：`.harness/queue/pending.jsonl`、`.harness/queue/status.json`。

---

## 9. 方式六：OpenSpec 模式

用 OpenSpec 管理变更提案，Harness 执行内核不变。

```bash
node .harness/runner/autopilot.mjs init \
  --requirement "增加深色模式" \
  --sdd-provider openspec \
  --openspec-change add-dark-mode

node .harness/runner/autopilot.mjs run --run <run_id> --create-pr
```

已有 OpenSpec change 时同步到 `specs/`：

```bash
node .harness/runner/autopilot.mjs sync-openspec --change add-dark-mode --run <run_id>
```

阶段流会增加 `OPSX_PROPOSE`（生成 `openspec/changes/<name>/`）。

---

## 10. 方式七：Cloud Agent / 远程 Agent

Cursor Cloud Agent、GitHub Actions、自建 Runner 均可：

```bash
cd "$REPO"
git fetch && git checkout main

node .harness/runner/autopilot.mjs run \
  --requirement "$REQUIREMENT" \
  --create-pr
```

CI 示例（GitHub Actions 片段）：

```yaml
- name: Harness Autopilot
  env:
    CURSOR_AGENT_BIN: agent
    HARNESS_CREATE_PR: "1"
  run: |
    node .harness/runner/autopilot.mjs run \
      --requirement "${{ github.event.issue.title }}" \
      --create-pr
```

---

## 11. 恢复、策略学习与高级能力

### 11.1 恢复中断/失败的 run

```bash
node .harness/runner/autopilot.mjs resume
node .harness/runner/autopilot.mjs resume --run <run_id>
```

### 11.2 策略学习（历史 run → 调参建议）

```bash
node .harness/runner/autopilot.mjs learn-policy
node .harness/runner/autopilot.mjs learn-policy --write   # 写回 autopilot-learned.yaml
```

### 11.3 Monorepo 边界

```bash
node .harness/runner/autopilot.mjs scope-generate --run <run_id>
# 配置：.harness/config/monorepo.yaml
```

### 11.4 单独创建 PR

```bash
node .harness/runner/autopilot.mjs create-pr --run <run_id>
# 需要 gh CLI 且已 push 分支
```

### 11.5 L1 VM 沙箱

```bash
HARNESS_SANDBOX=1 bash .harness/scripts/verify-l1.sh
```

### 11.6 E2E 沙箱（L 档）

```bash
HARNESS_E2E_SANDBOX=1 bash .harness/scripts/e2e-sandbox.sh
# 或门禁阶段自动触发（tier-L + HARNESS_E2E_SANDBOX=1）
```

### 11.7 本地度量 API

```bash
node .harness/runner/metrics-api.mjs --port 4177
# GET http://127.0.0.1:4177/api/autopilot/latest
# GET http://127.0.0.1:4177/api/autopilot/runs
```

---

## 12. 度量大屏为何显示「暂无记录」

大屏 **Autopilot 视图**读取的是业务仓库磁盘上的：

```
.harness/metrics/autopilot-<run_id>.json
.harness/metrics/latest-autopilot.json
```

### 12.1 常见原因

| 原因 | 解决办法 |
|------|----------|
| **从未跑完过一次 Autopilot** | 执行 `run` 或 Skill 直到 `phase: DONE` |
| **run 在中途失败** | `resume` 继续，或查看 `.harness/autopilot/runs/<id>/state.json` |
| **度量文件被 gitignore** | 正常；平台通过 **clone 本地镜像** 读文件，不依赖 git 提交 |
| **未选定单个 Git 仓库** | 大屏顶部选具体仓库，不要停留在「聚合」 |
| **平台未同步该仓库** | 大屏点刷新；确认「大屏指标配置」里部门已关联该 Git 项目 |
| **Autopilot 视图未启用** | 「大屏指标配置 → 启用视图」勾选 Autopilot（新版本 catalog 默认已启用） |

### 12.2 度量何时写入

| 触发方式 | 何时写入 `autopilot-*.json` |
|----------|------------------------------|
| `run` 全自动到 DONE | 自动 |
| Skill：`advance` 到 **DONE** | 自动（v1.1+） |
| Skill：`advance` 从 **CLOSE → PR** | 写入快照（run 未结束也可在大屏看到） |
| run **失败**（超过重试） | 自动写入 `status: failed` |
| 手动补写 | `node .harness/runner/autopilot.mjs finalize --run <id> [--done]` |

**常见误区**：`/harness-autopilot` 走 `init → prompt → gate → advance` 手动循环；旧版仅在 `run` 命令内写度量，若未 `advance` 到 DONE 则不会生成文件。CLOSE 阶段的 `sprint-*.json` ≠ `autopilot-*.json`。

本地验证：

```bash
# 跑一个最小 S 档需求
node .harness/runner/autopilot.mjs run --requirement "README 增加 badges" --tier S

# 检查文件
ls -la .harness/metrics/autopilot-*.json
cat .harness/metrics/latest-autopilot.json
```

### 12.3 平台侧配置要点

1. **Git 项目配置**：仓库 URL、本地 clone 路径（`workspaceKey`）
2. **部门关联**：度量大屏按部门筛选仓库
3. **启用视图**：`autopilot` 在 `harness-metrics-catalog.json` 中 `defaultEnabled: true`
4. 打开大屏 → 选择部门 → 选择 **单个仓库** → 侧栏 **Autopilot**

---

## 13. 产出物与目录说明

### 13.1 状态机阶段

```
INIT → DISCOVER → SPECIFY → PLAN_TASKS → SPRINT → EXEC → EVAL → [E2E] → CLOSE → PR → DONE
```

- **S 档**：精简路径，EVAL 后直达 CLOSE  
- **M 档**：默认  
- **L 档**：EVAL 后多 **E2E** 阶段  

### 13.2 每次 run 产出

| 路径 | 内容 |
|------|------|
| `.harness/autopilot/runs/<id>/state.json` | 状态机 |
| `.harness/autopilot/runs/<id>/requirement.md` | 原始需求 |
| `.harness/autopilot/runs/<id>/discovery.md` | 存量分析 |
| `.harness/autopilot/runs/<id>/decisions.log` | 自治决策 |
| `.harness/autopilot/runs/<id>/run-report.md` | 收官报告 |
| `specs/<feature>/spec.md` | 功能规格 |
| `specs/<feature>/plan.md` | 实现计划 |
| `specs/<feature>/tasks.md` | 任务清单 |
| `.harness/sprints/sprint-1.md` | Sprint 计划 |
| `.harness/sprints/sprint-1-progress.md` | 进度（gate 检查此文件） |
| `.harness/metrics/autopilot-<id>.json` | 度量（大屏读取） |

### 13.3 全部 CLI 命令速查

```bash
node .harness/runner/autopilot.mjs help

init            --requirement "..." [--tier S|M|L] [--sdd-provider speckit|openspec]
status          [--run <id>]
gate            [--run <id>]
advance         [--run <id>]
prompt          [--run <id>]
sync-openspec   --change <name> [--run <id>]
resume          [--run <id>]
learn-policy    [--write]
scope-generate  [--run <id>]
create-pr       [--run <id>]
finalize        [--run <id>] [--done]
queue-add       --requirement "..."
queue-process   [--max N]
queue-status
run             --requirement "..." [--in-process] [--create-pr] [--gate-only]
list
```

---

## 14. 常见问题

### Q: `gate` 在 EXEC 阶段一直失败？

- progress 里仍有 `- [ ]` 未完成任务 → 继续 EXEC，不要 advance  
- L1 失败 → 配置 `project-commands.yaml` 并本地跑 `bash .harness/scripts/verify-l1.sh`

### Q: `gh CLI not found`？

- 安装 [GitHub CLI](https://cli.github.com/) 并 `gh auth login`  
- 或手动 `git push` 后在网页创建 PR；`create-pr` 失败不阻断 DONE

### Q: 分支名中文乱码？

- Autopilot 使用 ASCII slug 生成分支名；需求可用中文

### Q: 与 `/speckit-*`、`/harness-*` 命令冲突吗？

- Autopilot **编排**这些能力；接入后优先走 Autopilot，失败再手动单步 skill

### Q: 新项目最小要改哪几个文件？

1. `.harness/config/project-commands.yaml` — test/build  
2. `.harness/constitution.md` — 团队原则（可选但推荐）  
3. `.harness/config/autopilot.yaml` — 分支前缀、PR 基线等  

---

## 相关文档

- 编排器速查：`.harness/runner/README.md`
- Skill 入口：`.cursor/skills/harness-autopilot/SKILL.md`
- Webhook Skill：`.cursor/skills/gitlab-webhook-cursor-code/SKILL.md`
- 路线图：`.harness/autopilot/ROADMAP.md`
- Harness 框架原文：`.harness/README.original.md`
