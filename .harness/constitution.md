# AI-Webhooks / Harness 项目宪法

**Version**: 1.0.0 | **Ratified**: 2026-06-14 | **Authority**: Harness Autopilot

> Harness 编排器与 Generator/Evaluator 的**最高约束**。SpecKit 的 `.specify/memory/constitution.md` 为兼容副本，以本文件为准。

## Core Principles

### I. Spec-Driven Delivery

所有功能必须有可验证的 spec（User Story + Given/When/Then）。Autopilot 产出 `specs/<feature>/spec.md` 后方可进入 EXEC。

### II. Contract-First

接口实现必须与 `contracts/` 或项目契约一致。无契约的接口不得合并。

### III. Test-First (NON-NEGOTIABLE)

含业务逻辑的任务遵循 TDD：Red → Green → Refactor。L1 门禁要求测试通过。

### IV. Minimal Context

每任务/每批次只加载必要文件。禁止在单会话内堆叠全量 spec/plan/tasks。

### V. Autonomous Assumptions

歧义时参照存量代码做保守假设，写入 `spec.md § Clarifications` 与 `decisions.log`，不阻断流水线。

### VI. Module Boundary (原则 XI)

跨模块依赖须符合 `.harness/scope/sprint-*.yaml`。in-scope 不得依赖 out-of-scope（横切豁免除外）。

### VII. Granularity (原则 XII)

单 spec ≤ 3 个 User Story，单 tasks.md ≤ 30 个 task。超出必须拆分 feature。

### VIII. Verification Gates

L1（构建/测试）→ L2（契约/场景）→ L3（E2E，L 档）→ L4（Constitution）。失败走 Corrector，≤3 轮。

## Governance

- 修订本文件需更新 Version（语义化版本）
- Autopilot `gates.mjs` 与 `evaluator.md` 引用本路径：`.harness/constitution.md`
- SpecKit 命令可通过 `lib/constitution.mjs` 同步读取本文件
