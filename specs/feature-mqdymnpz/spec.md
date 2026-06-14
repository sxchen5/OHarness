# Feature Specification: 贪吃蛇速度优化

**Feature Branch**: `cursor/feature-mqdymnpz-f82a`

**Created**: 2026-06-14

**Status**: Draft

**Input**: 继续优化贪吃蛇项目，初始速度太快

## User Scenarios & Testing

### User Story 1 - 更舒适的初始速度 (Priority: P1)

作为玩家，我打开游戏时期望蛇移动节奏从容，便于反应和规划路线，而不是一开局就飞快。

**Why this priority**: 用户明确反馈初始速度过快，直接影响首局体验。

**Independent Test**: 新建游戏后 `tickMs >= 250`；浏览器中主观感受明显慢于旧版 150ms。

**Acceptance Scenarios**:

1. **Given** 游戏刚加载或重新开始，**When** 查看内部速度状态，**Then** `tickMs` 为配置后的初始值（≥250ms）
2. **Given** 游戏进行中且未吃食物，**When** 蛇自动移动，**Then** 每步间隔不小于初始 `tickMs`
3. **Given** 玩家按下方向键开始游戏，**When** 前几步移动，**Then** 有足够时间调整方向而不仓促

---

### User Story 2 - 渐进加速仍可感知 (Priority: P2)

作为玩家，随着得分增加，我希望游戏逐渐变快，但最高速度仍可控，不会失控。

**Why this priority**: 降初速后需保留难度曲线，避免全程过慢。

**Independent Test**: 单元测试模拟连吃 5 个食物后 `tickMs` 下降且不低于 `MIN_TICK_MS`。

**Acceptance Scenarios**:

1. **Given** 蛇已吃 5 个食物，**When** 触发加速，**Then** `tickMs` 比初始值减少固定步长
2. **Given** 蛇持续得分多次，**When** `tickMs` 达到下限，**Then** 不再低于 `MIN_TICK_MS`

---

### User Story 3 - 速度档位显示准确 (Priority: P3)

作为玩家，界面上「速度」标签应反映当前节奏（悠闲/普通/快等），与初速调整一致。

**Why this priority**: UI 标签与真实速度一致，避免误导。

**Acceptance Scenarios**:

1. **Given** 游戏初始状态，**When** 查看速度标签，**Then** 显示「悠闲」或等价最慢档位
2. **Given** 游戏已多次加速，**When** 速度变快，**Then** 标签升级为「较快」「快」等

---

## Requirements

### Functional Requirements

- **FR-001**: `INITIAL_TICK_MS` MUST ≥ 250
- **FR-002**: 初始速度与重置后速度一致
- **FR-003**: 加速逻辑保持每 5 食物触发
- **FR-004**: `MIN_TICK_MS` MUST ≥ 100
- **FR-005**: 单元测试覆盖初始速度与加速下限

## Success Criteria

- **SC-001**: 初始 `tickMs` ≥ 250ms
- **SC-002**: 全部单元测试通过
- **SC-003**: 速度 UI 在初始状态显示最慢档

## Clarifications

- 初始速度：**280ms/步**（原 150ms）
- 最低速度：**100ms/步**（原 80ms）
- 加速步长：每 5 食物 **-15ms**（原 -10ms）
- 不新增难度设置菜单

## Assumptions

- 优化范围仅限 `snake-game/`，不改动 Harness 框架
- 基于既有 `feature-mqdxnbef` 代码增量修改
