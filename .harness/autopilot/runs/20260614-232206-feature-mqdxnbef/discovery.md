# Discovery — 贪吃蛇网页游戏

## 1. 项目结构

OHarness 是一个 **Harness Autopilot / SpecKit 编排框架** 仓库，并非既有 Web 应用。

| 目录 | 用途 |
|------|------|
| `.harness/` | Harness 编排器、门禁脚本、Sprint 模板、宪法 |
| `.specify/` | SpecKit 模板、扩展、工作流注册 |
| `.cursor/skills/` | Cursor Agent 技能定义 |
| `specs/` | Feature 规格文档（本次新建 `feature-mqdxnbef/`） |
| `README.md` | 仅一行项目名 |

**技术栈**：无既有应用代码；Node.js 用于 Harness runner；Bash 用于 L1 验证。无 `package.json`、无前端构建链、无后端服务。

## 2. 相关模块

本次需求为 **绿地开发（greenfield）**，仓库内无贪吃蛇或游戏相关代码。需从零创建静态 Web 游戏。

可能落点：
- `snake-game/` 或 `web/snake/` — 独立静态站点目录（推荐）
- 根目录 `index.html` — 过于扁平，不利于后续扩展

## 3. 既有模式

- **文档驱动**：spec → plan → tasks → sprint → exec
- **分支命名**：`cursor/<feature_id>-f82a`
- **提交**：Autopilot 每批次 git commit
- **验证**：L1 通过 `verify-l1.sh`（当前无 test/build 配置，会 SKIP）
- **宪法**：`.harness/constitution.md` 要求 TDD、契约优先、≤3 User Story

## 4. 宪法约束摘要

- 必须有 spec（User Story + Given/When/Then）才能 EXEC
- 含业务逻辑须 TDD（Red → Green → Refactor）
- 单 spec ≤ 3 User Story，tasks ≤ 30
- 歧义时自治假设，写入 Clarifications

## 5. 风险与依赖

| 风险 | 说明 |
|------|------|
| 无 L1 测试框架 | 需配置 `project-commands.yaml` 或添加简单测试（如 Node 单元测试或 Playwright） |
| 纯静态页 | 无服务器依赖，可直接用浏览器打开或 `npx serve` |
| Windows 环境 | `verify-l1.sh` 需 Git Bash 或 WSL |

**外部依赖**：无数据库、无 API。仅需浏览器 + 可选静态服务器。

## 6. 建议切入点

1. 在 `snake-game/` 创建 `index.html`、`style.css`、`game.js`
2. 使用 Canvas 或 DOM 网格渲染蛇与食物
3. 键盘方向键控制，碰撞检测，计分，重新开始
4. 添加 `package.json` 与简单测试以满足 L1（如 game logic 单元测试）
5. 在 `project-commands.yaml` 配置 `test` 命令

## 7. 假设

- 单机浏览器游戏，无需多人联机
- 经典规则：吃食物变长、撞墙/自身死亡、显示分数
- 支持键盘方向键；移动端触屏为可选增强
- 中文 UI 标签
- Tier M：不含 E2E 沙箱（tier-M 无 E2E 阶段）
