---
name: gitlab-webhook-cursor-scan
description: 在 GitLab WebHook 触发的服务器任务中，用 Cursor CLI（agent 打印模式）对本地镜像仓库做非交互扫描；与仓库智能协作平台的 WEBHOOK_* 环境变量配合使用。
---

# GitLab WebHook + Cursor 扫描

## 何时使用

- 代码已通过 CI 或镜像同步到服务器上的 **本地目录**（与仓库智能协作平台 `project_info.local_code_path` 一致）。
- 希望在收到 push WebHook 后，用 **Cursor CLI 非交互模式**（`agent -p ... --output-format text`）做一次安全/质量类审查，并把终端输出写入平台的 `scan_task_log.exec_result`。

## 是否需要单独 Skill

- **Skills 不会“被 WebHook 直接调用”**：仓库智能协作平台只执行你在 `agent_command` 里配置的 Shell；Skill 是给 Cursor Agent 的**说明与规范**，应放在**被扫描的代码仓库**（或本机 `~/.cursor/skills/`）里，这样 `agent` 运行时才能加载到对应上下文。
- 本仓库提供 **Skill（本文件）** + **可执行包装脚本** `scripts/cursor-gitlab-webhook-scan.sh`：推荐在平台里配置命令调用该脚本；把本 Skill 复制到业务仓库的 `.cursor/skills/gitlab-webhook-cursor-scan/SKILL.md`（或安装为全局 Skill），以便 agent 按统一口径扫描。

## 仓库智能协作平台侧配置建议

1. **本地代码路径**：填服务器上该 GitLab 项目的 clone 路径（需事先 `git clone` 并配置 `origin`）。
2. **agent_command 示例**（脚本路径按实际部署调整）：

```bash
/bin/bash /opt/scan-platform/scripts/cursor-gitlab-webhook-scan.sh
```

或使用仓库内相对路径（若部署时把整个平台仓库放在固定目录）：

```bash
/bin/bash /path/to/AI-Webhooks/scripts/cursor-gitlab-webhook-scan.sh
```

3. **可选环境变量**（在 systemd、Docker 或启动脚本里为 **Java 进程**设置即可，子 Shell 会继承；也可在 `agent_command` 前写 `export`）：
   - `CURSOR_AGENT_MODEL`：例如 `gpt-5.2`
   - `CURSOR_SCAN_PROMPT`：覆盖默认英文审查提示
   - `CURSOR_AGENT_BIN`：若 `agent` 不在默认 PATH，填绝对路径

## 平台自动注入的环境变量

子进程会收到（无需在命令里写死）：

| 变量 | 含义 |
|------|------|
| `WEBHOOK_REPO_PATH` | 与 `local_code_path` 相同 |
| `WEBHOOK_BRANCH` | push 分支名 |
| `WEBHOOK_COMMIT` | `after` commit SHA |
| `WEBHOOK_PROJECT_NAME` | 平台项目名 |
| `WEBHOOK_GITLAB_PROJECT_ID` | GitLab project id |
| `WEBHOOK_COMMIT_USER` | 提交人标识 |
| `WEBHOOK_GIT_URL` | 项目配置的 git URL（可选） |
| `WEBHOOK_REQUEST_SUMMARY` | 从 Webhook 请求体解析的需求说明（注入 Agent 提示词） |

命令里仍可使用占位符 `{{path}}` `{{branch}}` `{{commit}}` `{{summary}}`（同 `{{requestSummary}}`），与上述变量含义一致。

## Cursor CLI 参考

非交互示例：

```bash
agent -p "review these changes for security issues" --output-format text
```

安装与更多参数见官方文档：[Cursor CLI](https://cursor.com/docs/cli/overview)。
