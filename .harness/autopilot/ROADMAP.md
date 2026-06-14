# Harness Autopilot 路线图

## 已完成 · Phase 1–3

见 git history。核心：单命令自治、Webhook、OpenSpec、沙箱、resume、Constitution 外置。

## 已完成 · Phase 4

| 项 | 说明 | 命令/文件 |
|----|------|----------|
| 策略学习 | 历史 metrics → learned-policy.json | `learn-policy` |
| 多仓库编排 | monorepo scope 自动生成 | `scope-generate`, `monorepo.yaml` |
| PR 审批层 | draft PR + reviewers + labels | `create-pr`, `pr:` 配置 |
| 真实并行 EXEC | 多进程 sub-agent `[P]` 任务 | `parallel-runner.mjs` |

## 已完成 · Phase 5

| 项 | 说明 | 命令/文件 |
|----|------|----------|
| 度量看板 API | 后端 + 前端 Autopilot 视图 | `GET /api/harness-metrics/autopilot` |
| 轻量 Node API | 本地直读 metrics | `metrics-api.mjs` |
| 策略自动写回 | `--write` → autopilot-learned.yaml | `learn-policy --write` |
| 多 run 队列 | Webhook 串行化 | `queue-add`, `queue-process`, `HARNESS_QUEUE=1` |
| E2E 沙箱扩展 | Playwright in Docker | `e2e-sandbox.sh`, `HARNESS_E2E_SANDBOX=1` |

## 常用命令

```bash
node .harness/runner/autopilot.mjs learn-policy --write
node .harness/runner/autopilot.mjs queue-add --requirement "需求"
node .harness/runner/autopilot.mjs queue-process --max 3
node .harness/runner/autopilot.mjs scope-generate --run <id>
node .harness/runner/autopilot.mjs create-pr --run <id>
HARNESS_SANDBOX=1 bash .harness/scripts/verify-l1.sh
HARNESS_E2E_SANDBOX=1 bash .harness/scripts/e2e-sandbox.sh
node .harness/runner/metrics-api.mjs --port 4177
```
