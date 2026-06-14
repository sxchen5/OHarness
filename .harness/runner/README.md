# Harness Autopilot Runner

一条命令驱动的自治编排器：读懂存量 → 写 spec/harness 文档 → 执行 → 验证 → 提 PR。

## 快速开始

### IDE（推荐）

```text
/harness-autopilot "你的需求描述"
```

### CLI

```bash
# 初始化 run
node .harness/runner/autopilot.mjs init --requirement "宽带用户域名改造受理接口"

# 查看状态
node .harness/runner/autopilot.mjs status

# 检查当前阶段门禁
node .harness/runner/autopilot.mjs gate

# 渲染当前阶段 prompt
node .harness/runner/autopilot.mjs prompt

# 全自动（需安装 Cursor CLI agent）
node .harness/runner/autopilot.mjs run --requirement "需求描述"
```

### Webhook / CI

```bash
export WEBHOOK_REQUEST_SUMMARY="实现 JWT 登录接口"
node .harness/runner/autopilot.mjs run --requirement "$WEBHOOK_REQUEST_SUMMARY"
```

## 架构

```
.harness/runner/
├── autopilot.mjs       # 状态机主编排器
├── gates.mjs           # 程序化门禁（零 token）
├── session-launcher.sh # 按阶段拉起 Agent CLI
├── prompts/            # 每阶段独立 prompt
└── lib/                # config / state / tier-detect
```

## 状态机阶段

`INIT → DISCOVER → SPECIFY → PLAN_TASKS → SPRINT → EXEC → EVAL → [E2E] → CLOSE → PR → DONE`

L 档在 EVAL 后多一个 E2E 阶段。

## 分档（S/M/L）

| 档 | 触发关键词示例 | 工作流文件 |
|----|---------------|-----------|
| S | 修复、bug、字段 | `workflows/tier-S.yaml` |
| M | 默认 | `workflows/tier-M.yaml` |
| L | 改造、跨模块、迁移 | `workflows/tier-L.yaml` |

配置: `.harness/config/autopilot.yaml`

## Phase 2 / 3 能力

### Webhook 接入

`scripts/cursor-gitlab-webhook-code.sh` 默认调用 Autopilot（`HARNESS_AUTOPILOT=1`）。

### Batch 会话分段

EXEC 每批次完成后递增 `session_id`，写入 `sessions.log`。

### OpenSpec 适配

```bash
node .harness/runner/autopilot.mjs init --requirement "需求" --sdd-provider openspec --openspec-change my-change
node .harness/runner/autopilot.mjs sync-openspec --change my-change
```

### resume 恢复

```bash
node .harness/runner/autopilot.mjs resume
```

### VM 沙箱

```bash
HARNESS_SANDBOX=1 bash .harness/scripts/verify-l1.sh
```

### 度量自动写入

Run 结束时写入 `.harness/metrics/autopilot-<run_id>.json`。

### Constitution

权威文件：`.harness/constitution.md`

### Phase 4

- `learn-policy` — 策略学习
- `scope-generate` — monorepo scope
- `create-pr` — draft PR via gh
- 并行 `[P]` sub-agent EXEC

### Phase 5

- `learn-policy --write` — 写回 `autopilot-learned.yaml`
- `queue-add` / `queue-process` — 多 run 队列（Webhook `HARNESS_QUEUE=1`）
- `metrics-api.mjs` — 轻量本地度量 API（端口 4177）
- E2E 沙箱：`HARNESS_E2E_SANDBOX=1` + `e2e-sandbox.sh`
- 度量大屏：前端 Autopilot 视图 + `GET /api/harness-metrics/autopilot`

## 路线图

见 `.harness/autopilot/ROADMAP.md`

## 产出物

每次 run 在 `.harness/autopilot/runs/<run-id>/` 下：

- `state.json` — 状态机
- `requirement.md` — 原始需求
- `discovery.md` — 存量分析报告
- `decisions.log` — 自治决策记录
- `run-report.md` — 收官报告

同时在 `specs/<feature>/` 和 `.harness/sprints/` 生成标准 SpecKit + Harness 文档。

## in-process 模式

无 Cursor CLI 时，编排器进入 in-process 模式：每次 `run --in-process` 执行一个阶段，由当前 IDE Agent 按 prompt 完成工作后，再调用 `gate` + `advance`。

## L1 验证

```bash
bash .harness/scripts/verify-l1.sh
```

可在 `.harness/config/project-commands.yaml` 覆盖 test/build/lint 命令。
