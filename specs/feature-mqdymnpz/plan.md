# Implementation Plan: 贪吃蛇速度优化

**Feature**: `feature-mqdymnpz` | **Tier**: M | **Date**: 2026-06-14

## Summary

调低初始移动频率（提高 tickMs），同步加速曲线与 UI 速度标签，补充单元测试。

## 变更点

| 常量 | 旧值 | 新值 |
|------|------|------|
| INITIAL_TICK_MS | 150 | 280 |
| MIN_TICK_MS | 80 | 100 |
| 加速步长 | -10 | -15 |

## 文件

- `snake-game/game-logic.js` — 常量与 `tick()` 加速
- `snake-game/game.js` — `speedLabel()` 阈值
- `snake-game/game-logic.test.js` — 速度断言

## 验证

`cd snake-game && npm test`
