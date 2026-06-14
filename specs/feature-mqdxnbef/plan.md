# Implementation Plan: 贪吃蛇网页游戏

**Feature**: `feature-mqdxnbef` | **Tier**: M | **Date**: 2026-06-14

## Summary

在 `snake-game/` 目录创建纯静态贪吃蛇游戏：Canvas 渲染 + 可测试的游戏逻辑模块 + Node 单元测试。

## Technical Context

| 项 | 选择 |
|----|------|
| 语言 | HTML5, CSS3, ES Modules (浏览器) + CommonJS (Node 测试) |
| 渲染 | Canvas 2D API |
| 测试 | Node.js 内置 `node:test` + `node:assert` |
| 构建 | 无；`npm test` 仅跑逻辑测试 |
| 存储 | localStorage（最高分） |

## Architecture

```
snake-game/
├── index.html      # 页面结构、Canvas、UI
├── style.css       # 暗色主题样式
├── game-logic.js   # 纯函数游戏逻辑（可 Node 测试）
├── game.js         # 浏览器：渲染、输入、游戏循环
├── game-logic.test.js
└── package.json
```

### 模块职责

- **game-logic.js**: `createGame`, `moveSnake`, `changeDirection`, `spawnFood`, `tick` — 无副作用
- **game.js**: DOM/Canvas 绑定、requestAnimationFrame/setInterval、localStorage
- **index.html**: 引入 game.js (type=module)

## Data Model

无需后端数据模型。运行时状态：

```js
{ snake: [{x,y},...], direction, nextDirection, food: {x,y}, score, gameOver, paused, tickMs }
```

## Contracts

无 API 契约。内部模块契约：

- `game-logic.js` 导出函数签名稳定，测试覆盖移动/吃食物/碰撞/方向

## Phase Breakdown

1. **Setup** — 目录、package.json、project-commands
2. **Foundational** — game-logic + 测试
3. **US1** — Canvas 渲染 + 核心循环
4. **US2** — 暂停/重新开始
5. **US3** — 样式 + 最高分
6. **Polish** — L1 验证、文档

## Risks

- Windows 下 bash 脚本：配置 `project-commands.yaml` 使用 `npm test`
- ES Module vs CJS：game-logic 用 dual export 或 test 用 dynamic import

## Constitution Alignment

- TDD: 先写 game-logic.test.js 再实现
- ≤3 User Story: 符合
- L1: npm test 通过
