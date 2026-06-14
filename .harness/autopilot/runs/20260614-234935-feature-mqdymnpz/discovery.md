# Discovery — 贪吃蛇速度优化

## 1. 项目结构

OHarness 仓库已包含 `snake-game/` 静态网页游戏（上轮 Autopilot `feature-mqdxnbef` 交付）。

| 路径 | 说明 |
|------|------|
| `snake-game/game-logic.js` | 纯逻辑：速度常量 `INITIAL_TICK_MS=150`、`MIN_TICK_MS=80` |
| `snake-game/game.js` | Canvas 渲染、`setTimeout` 循环、`speedLabel()` UI |
| `snake-game/game-logic.test.js` | 11 个单元测试，无速度断言 |
| `specs/feature-mqdxnbef/` | 上轮 spec，Clarifications 写明 150ms/格 |

**技术栈**：HTML/CSS/ES Module + Node `node:test`。L1 经 `project-commands.yaml` → `cd snake-game && npm test`。

## 2. 相关模块

速度控制全在 `game-logic.js` 常量与 `tick()` 加速逻辑；`game.js` 的 `scheduleNext()` 使用 `state.tickMs`；`speedLabel()` 阈值基于旧速度设计（≤130 为「较快」）。

## 3. 既有模式

- tickMs 越大越慢（毫秒/步）
- 每吃 5 个食物 `tickMs -= 10`，下限 80ms
- 重置走 `resetGame()` → `createGame()` 恢复初始 tickMs

## 4. 宪法约束

- 改动须有 spec + 测试（TDD）
- ≤3 User Story，tasks ≤30
- 自治假设写入 Clarifications

## 5. 风险

- 仅调常量风险低；需同步 `speedLabel` 阈值与 spec
- 无破坏性 API 变更

## 6. 建议切入点

1. 提高 `INITIAL_TICK_MS`（150→280 左右，约慢 87%）
2. 略提高 `MIN_TICK_MS`（80→100）避免后期过快
3. 新增 `createGame` 速度断言测试
4. 调整 `game.js` `speedLabel` 档位

## 7. 假设

- 「太快」指标为初始 150ms/步；目标约 250–300ms/步
- 加速曲线保持「每 5 食物加速」，步长可微调
- 不增加难度选择 UI（本版仅调默认速度）
