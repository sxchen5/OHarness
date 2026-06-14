# Tasks: 贪吃蛇网页游戏

**Feature**: `feature-mqdxnbef`

## Phase 1: Setup

- [x] T001 创建 `snake-game/` 目录与 `package.json`（test 脚本）
- [x] T002 配置 `.harness/config/project-commands.yaml` 添加 test 命令

## Phase 2: Foundational

- [x] T003 [US1] 编写 `snake-game/game-logic.test.js`（移动、吃食物、碰撞、方向）
- [x] T004 [US1] 实现 `snake-game/game-logic.js` 使测试通过

## Phase 3: User Story 1 — 基础玩法

- [x] T005 [US1] 创建 `snake-game/index.html`（Canvas 400×400、分数显示）
- [x] T006 [US1] 实现 `snake-game/game.js`（渲染、键盘、游戏循环、碰撞结束）
- [x] T007 [US1] 创建 `snake-game/style.css` 基础样式

## Phase 4: User Story 2 — 暂停与重开

- [x] T008 [US2] 在 `game.js` 实现空格暂停/继续
- [x] T009 [US2] 在 `index.html` 添加「重新开始」按钮并绑定重置逻辑

## Phase 5: User Story 3 — 界面与最高分

- [x] T010 [US3] 在 `game.js` 实现 localStorage 最高分读写
- [x] T011 [US3] 完善 `style.css` 暗色主题与控制说明

## Phase 6: Polish

- [x] T012 运行 `npm test` 并修复问题
- [x] T013 更新 `snake-game/README.md` 使用说明
