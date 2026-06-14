# Ran-Baseband Profile（孵化中）

**状态**：草稿目录 · 等待 NTN Sprint 1 现场抽象沉淀
**起源**：2026-05-04 路径 C 决策 —— NTN 仓 in-place 改造 prompts，同步把通用 RAN 化段落沉淀到这里

## 关联

- 设计源：`docs/validation-nrf-ntn.md` §4 / §7 / 附录 C
- 已识别差距：`docs/backlog.md` §0.1 / §0.2 / §0.5 / §0.6 / §0.10
- 上游现场：`/Users/lizhiqi/00-WORK/NTN软硬一体/.harness/docs/sprint-readiness-and-prompts-rework.md`

## 适用 / 不适用

**适用**：5G/4G 基站（BBU + AAU + 前传） / 协议栈（PHY/MAC/RLC/RRC/PDCP/SDAP） / 嵌入式系统（FPGA/DSP/RT Linux） / 物理层数值算法

**不适用**：5G 核心网控制面 NF（用 `cn-control-plane`） / 通用 Web/SaaS（用 `web-saas`） / UPF 高速数据面（按需另建）

## 待迁入文件（按 NTN sprint-readiness 章节顺序）

| 文件 | 对应 toolkit 原版 | 来源段 | 状态 |
|---|---|---|---|
| `generator.md` | `harness/prompts/generator.md` | NTN sprint-readiness §1 | 待迁入 |
| `evaluator.md` | `harness/prompts/evaluator.md` | NTN sprint-readiness §2 | 待迁入 |
| `planner.md` | `harness/prompts/planner.md` | NTN sprint-readiness §3 | 待迁入 |
| `tools/preflight-embedded.sh` | `harness/tools/preflight-jvm.sh` | NTN sprint-readiness §4 | 待迁入 |
| `peer-reviewer.md` | `harness/prompts/peer-reviewer.md` | NTN sprint-readiness §5 | 待迁入 |
| `boundary-reviewer.md` | `harness/prompts/boundary-reviewer.md` | NTN sprint-readiness §5 | 待迁入 |
| `spec-extensions.md` | `commands/speckit.clarify.md` + `specify/templates/spec-template.md` | 本仓通信域增补段 | 已沉淀（从基础文件剥离） |

## 同步约定（路径 C 双轨）

每段同步过来时，顶部加来源标注 + 待抽象标注：

```
<!-- 来源: NTN/.harness/prompts/generator.md §通用前缀 (NTN sprint-readiness §1) -->
<!-- NTN-SPECIFIC 待抽象: AstraNet 项目代号 / FTC862 硬件型号 / srsRAN 仿真器选型 -->
```

## 升级到正式 profile 的判定

- [ ] 6 个待迁入文件至少 2/3 段落已迁入
- [ ] NTN Sprint 1 跑通至少 5 个任务
- [ ] 草稿审过一次（剥离 NTN-SPECIFIC 标记 → 升格为通用 placeholder）
- [ ] `install.sh` 支持 `domain` 字段（最小两 profile：web-saas + ran-baseband）

满足后，把当前 `harness/prompts/*.md`（事实上的 web-saas 偏置版）迁到 `profiles/web-saas/`，统一启用 profile 机制。
