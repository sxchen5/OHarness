---
name: gitlab-webhook-cursor-code
description: 在 GitLab WebHook 触发的服务器任务中，用 Harness Autopilot 或 Cursor CLI 根据需求说明自动完成 spec+harness 文档、代码、测试与 PR；与 WEBHOOK_REQUEST_SUMMARY 环境变量配合使用。
---

# GitLab WebHook + Harness Autopilot

## 何时使用

- Webhook POST 需求说明 → 服务器本地仓库 **全自动执行** Harness Autopilot 流水线
- 默认产出：spec 文档、harness sprint 文档、代码、验证、PR

## 平台侧配置

```bash
/bin/bash /path/to/AI-Webhooks/scripts/cursor-gitlab-webhook-code.sh
```

### 环境变量

| 变量 | 含义 | 默认 |
|------|------|------|
| `WEBHOOK_REQUEST_SUMMARY` | 需求说明（必填） | — |
| `WEBHOOK_REPO_PATH` | 本地 clone 路径 | — |
| `WEBHOOK_BRANCH` | 目标分支 | — |
| `HARNESS_AUTOPILOT` | `1` 走 Autopilot；`0` 回退旧版单次 agent | `1` |
| `HARNESS_TIER` | 强制 S/M/L | 自动检测 |
| `HARNESS_SDD_PROVIDER` | `speckit` \| `openspec` | `speckit` |
| `HARNESS_OPENSPEC_CHANGE` | OpenSpec change 名 | 自动 slug |
| `HARNESS_CREATE_PR` | 完成后创建 PR | `1` |
| `HARNESS_QUEUE` | `1` 先入队再串行处理（多 Webhook 防并发） | `0` |
| `HARNESS_QUEUE_MAX` | 单次 `queue-process` 处理条数 | `1` |
| `CURSOR_AGENT_BIN` | agent 可执行文件 | `agent` |
| `CURSOR_AGENT_MODEL` | 模型 | — |

## Webhook 请求体

与原先相同，优先级：`request_summary` > `requirement` > `task` > …

```json
{
  "branch": "main",
  "requirement": "实现 JWT 登录接口，含单元测试"
}
```

## Autopilot 执行流程

脚本检测到 `.harness/runner/autopilot.mjs` 且 `HARNESS_AUTOPILOT=1` 时：

```bash
# 默认：直接 run
node .harness/runner/autopilot.mjs run --requirement "$WEBHOOK_REQUEST_SUMMARY" --create-pr

# HARNESS_QUEUE=1：先入队再 queue-process
```

完整阶段：`INIT → DISCOVER → SPECIFY → … → PR → DONE`

## 回退模式

设 `HARNESS_AUTOPILOT=0` 恢复旧版单次 `agent --print -f` 行为。

## 参考

- Autopilot 文档: `.harness/runner/README.md`
- 路线图: `.harness/autopilot/ROADMAP.md`
