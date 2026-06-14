# Feature Specification: 贪吃蛇网页游戏

**Feature Branch**: `cursor/feature-mqdxnbef-f82a`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "写一个贪吃蛇网页游戏"

## User Scenarios & Testing

### User Story 1 - 基础游戏玩法 (Priority: P1)

作为玩家，我打开网页即可看到游戏画布，用方向键控制蛇移动，吃到食物后蛇身变长、分数增加，撞墙或撞到自己时游戏结束。

**Why this priority**: 核心玩法是 MVP，无此则不是贪吃蛇游戏。

**Independent Test**: 在浏览器打开 `snake-game/index.html`，方向键移动、吃食物、死亡判定均可手动验证。

**Acceptance Scenarios**:

1. **Given** 游戏已加载且未开始，**When** 玩家按下方向键，**Then** 蛇按对应方向移动且每帧自动前进
2. **Given** 蛇头与食物同格，**When** 蛇移动一步，**Then** 蛇身增长一格、分数 +10、食物在新位置生成
3. **Given** 蛇头碰到边界或自身，**When** 碰撞发生，**Then** 游戏结束并显示「游戏结束」与最终分数

---

### User Story 2 - 重新开始与暂停 (Priority: P2)

作为玩家，我可以在游戏结束后点击按钮重新开始，或在游戏中按空格键暂停/继续。

**Why this priority**: 提升可玩性，避免刷新页面才能再玩。

**Independent Test**: 触发游戏结束后点击「重新开始」；游戏中按空格验证暂停与恢复。

**Acceptance Scenarios**:

1. **Given** 游戏已结束，**When** 玩家点击「重新开始」，**Then** 蛇、分数、食物重置为初始状态
2. **Given** 游戏进行中，**When** 玩家按下空格键，**Then** 蛇停止移动且显示「已暂停」
3. **Given** 游戏已暂停，**When** 玩家再次按下空格键，**Then** 蛇恢复移动

---

### User Story 3 - 界面与最高分 (Priority: P3)

作为玩家，我希望界面美观、显示当前分数与历史最高分，并在刷新页面后最高分仍保留。

**Why this priority**: 增强体验与成就感，非阻塞核心玩法。

**Independent Test**: 玩游戏得分超过历史最高后刷新页面，最高分仍显示。

**Acceptance Scenarios**:

1. **Given** 页面首次加载，**When** 玩家查看界面，**Then** 显示标题、分数面板、游戏画布与控制说明
2. **Given** 本局分数超过 localStorage 中的最高分，**When** 分数更新，**Then** 最高分同步更新并持久化
3. **Given** 玩家刷新页面，**When** 页面重新加载，**Then** 最高分从 localStorage 恢复显示

---

### Edge Cases

- 蛇长度为 1 时反向按键应被忽略（不能直接掉头撞自己）
- 食物不生成在蛇身上
- 棋盘填满时视为胜利或结束（本版：游戏结束并提示）
- 快速连按方向键不应导致异常状态

## Requirements

### Functional Requirements

- **FR-001**: 系统 MUST 在 Canvas 上渲染 20×20 网格的蛇与食物
- **FR-002**: 系统 MUST 支持方向键（↑↓←→）控制蛇的移动方向
- **FR-003**: 系统 MUST 在蛇吃到食物后增长身体并增加分数
- **FR-004**: 系统 MUST 检测撞墙、撞自身并结束游戏
- **FR-005**: 系统 MUST 提供重新开始按钮与空格暂停功能
- **FR-006**: 系统 MUST 使用 localStorage 持久化最高分
- **FR-007**: 游戏逻辑 MUST 有单元测试覆盖（移动、吃食物、碰撞）

### Key Entities

- **Snake**: 由有序坐标段组成的蛇身，含当前方向
- **Food**: 网格上的单个食物坐标
- **GameState**: 分数、是否运行、是否暂停、是否结束

## Success Criteria

### Measurable Outcomes

- **SC-001**: 玩家可在 5 秒内理解操作并开始游戏
- **SC-002**: 游戏帧率稳定（约 150ms/格），无明显卡顿
- **SC-003**: 单元测试全部通过（`npm test`）
- **SC-004**: 在 Chrome/Edge 最新版可完整游玩

## Clarifications

- **网格大小**: 20×20，每格 20px Canvas 400×400
- **速度**: 初始 150ms/步，每吃 5 个食物加速 10ms（下限 80ms）
- **计分**: 每个食物 +10 分
- **技术栈**: 纯 HTML/CSS/JS，无框架；逻辑抽离至 `game-logic.js` 便于测试
- **目录**: `snake-game/` 独立子目录
- **移动端**: 本版不实现触屏虚拟方向键

## Assumptions

- 目标用户为桌面浏览器玩家
- 无需后端或用户账号
- 中文 UI
