<!--
来源: NTN 仓 .harness/prompts/boundary-reviewer.md (2026-05-04 改造现场 · 路径 C 双轨同步)
关联: docs/backlog.md §0 跨域可移植性 已触发差距 · 此处为实战 evidence

NTN-SPECIFIC 待剥离（升级正式 profile 时处理）:
- 项目代号 "AstraNet RAN (NTN 软硬一体基站, BBU 协议栈 + 前传 FPGA + AAU 相控阵)"
- 协议族 "NTN 再生载荷 R19" / "CPRI 私有协议 v0.9"
- 甲方 "中国移动企规"
- 平台 "Phytium FTC862"

可保留作 RAN 域示例（无需剥离）:
- 3GPP R17 / TS 38.xxx 引用规范 / FAPI / TTI <= 500 us / BBU CPU <= 90%
- 仿真器 srsRAN / OpenAirInterface (开源工具名)
- 协议栈层级 PHY/MAC/RLC/RRC/PDCP/SDAP

剥离时机: 等 NRF 也跑出现场后, 两边对照才能正确抽象 (单项目易过度或不足抽象).
-->

# Boundary Reviewer Prompt 模板 — L2/PHY/L3 层间边界 Sensor

## 使用方式

由 Evaluator 在 L2.4（模块边界一致性）阶段调用，也可由 `/harness.exec` 在批次门禁前主动触发。

输入：
- `.harness/scope/sprint-<N>.yaml`（必须存在，缺失即 FAIL · 关联 Constitution 原则 II）
- 项目源码（C / C++ 协议栈，用于构建 `#include` + 静态调用依赖图）
- 接口契约文档（FAPI / CPRI / FPGA 寄存器 / OAM）

输出：
- 结构化违规报告（写入 `scope.yaml.metadata.report_path` 指定路径，默认 `.harness/sprints/sprint-<N>-boundary-report.md`）
- 评分（用于 Evaluator L2.5 评分汇总的"L2/PHY/L3 层间边界"维度）

本 Prompt 针对 **C / C++ 协议栈代码**，工具链：
- `#include` 关系：`grep -rln '#include "phy/'` 之类的源码扫描
- 符号级调用：`cscope -R -L -3 <symbol>` / `ctags -R --c-kinds=+pf` / `clang-query` / `clangd indexer` 任一可用
- 跨编译单元符号：`nm -gC <obj>` 找未定义符号 → 反推跨层调用

> 方法论骨架（解析 yaml → 构建依赖图 → 对照规则 → 分级报告 → 检测违规扩大）与 NRF / 通用 toolkit 一致；本 NTN 版本重点：**层间禁令是 RAN 协议栈的 L2/PHY/L3 分层，不是 Web 项目的 module/layer**。

---

## L2/PHY/L3 层间禁令（NTN 强制规则）

以下规则**默认强制**，除非 `scope.yaml` 显式列入 `known_violations` 并附 ADR：

| 规则 ID | 内容 | 严重性 |
|---|---|---|
| RAN-B-1 | **L3 不直接调 PHY**：所有 L3↔PHY 通信必须经 L2 中转 | error |
| RAN-B-2 | **L2 不绕 FAPI 调 PHY**：L2→PHY 唯一通道是 FAPI 接口 | error |
| RAN-B-3 | **PHY 不改 RRC 状态机**：PHY 不得读写 RRC 内部状态 / 上下文结构体 | error |
| RAN-B-4 | **跨层调用必须走预定义接口**：跨层（L1/L2/L3 互相之间）的函数调用必须命中预定义的 header（如 `include/fapi/`, `include/itf/`, `include/oam/`），不允许直接 `#include "../phy/internal/*"` | error |
| RAN-B-5 | **HAL 隔离**：上层（L1/L2/L3）不直接访问 FPGA 寄存器 / DMA 描述符 / 板上外设；必须经 HAL 抽象层 | error |
| RAN-B-6 | **协议条款追溯**：跨层接口字段读写在源码中必须含 `// TS xx.xxx §y.z` 引用注释（缺失 → warning，不阻断但记入 Checkpoint）| warning |

模块名 → 层映射（默认按目录前缀，可在 yaml 覆盖）：
- `phy/`, `l1/` → **PHY 层**
- `mac/`, `rlc/`, `pdcp/`, `l2/` → **L2 层**
- `rrc/`, `nas/`, `oam/`, `l3/` → **L3 层**
- `hal/`, `bsp/`, `drv/` → **HAL 层**
- `fapi/`, `itf/`, `include/` → **接口契约层**（任何层均可 include）
- `common/`, `utils/`, `log/` → **横切层**（cross-cutting，受 cross_cutting_exempt 规则控制）

---

## Boundary Reviewer Prompt

```
## L2/PHY/L3 层间边界一致性验证（Boundary Reviewer · 关联 Constitution 原则 II）

你是 boundary-reviewer sub-agent。本次任务是验证当前 NTN 协议栈代码库的层间依赖图与
`.harness/scope/sprint-<N>.yaml` 申报一致 + 满足 RAN-B-1~B-6 强制规则。
**不要修改代码**，只输出报告。

### Step 0 · Pre-flight

1. 读取 `.harness/scope/sprint-<N>.yaml`（N 由调用方传入或从 `.harness/sprints/` 推断当前 Sprint）
   - 找不到 → 立即报告 `FAIL: scope.yaml 缺失` · 终止
   - schema 不合法（缺 `modules.in_scope` / `dependency_rules`）→ FAIL · 列出缺失字段
2. 检测**调用模式**：
   - 默认 `enforce` 模式：NEW_VIOLATION → 阻断（按 severity）
   - `discovery` 模式（首次生成 yaml 时调用，可由 `mode=discovery` 或 `scope.yaml.metadata.discovery_mode=true` 触发）：
     - 不阻断 · NEW_VIOLATION 全部转为"待登记 known_violations 候选"输出
     - verdict 强制为 PASS（用于 /harness.scope 的 Step 5 自动登记，不影响 evaluator）
3. 读取项目根 `CLAUDE.md`（如存在），检查"L2/PHY/L3 焦点 / 出范围"叙述是否与 yaml + 强制规则一致
   - 模块名 / 层映射不一致 → 记入报告 `consistency_warnings`，但不阻断本次扫描

### Step 1 · 构建依赖图（三轮扫描必需）

C / C++ 项目的跨层依赖来自三类边：`#include` 关系 + 函数调用 + 全局符号引用。单一工具拿不齐——必须三轮组合扫描。

#### Step 1.1 · `#include` 关系（包级边）

按文件搜索所有 `#include` 形成 `<from_file> -> <to_header>`，再聚合到层：

\`\`\`bash
# 全仓 #include 抓取（限定到协议栈源码目录）
grep -rn -E '^[[:space:]]*#include[[:space:]]+"' src/ include/ \
  | awk -F: '{print $1 ":" $2 ":" $3}' > /tmp/includes.txt
\`\`\`

把每条 include 边的 from / to 文件按 **模块名 → 层映射** 归到层（PHY / L2 / L3 / HAL / 接口契约 / 横切）。

#### Step 1.2 · 静态函数调用（symbol 级）

`#include` 不抓"间接函数调用"；必须叠一轮 symbol 索引：

\`\`\`bash
# 任选一种可用工具（按项目实际配置）：
# 1. cscope
cscope -R -b
cscope -d -L -3 <suspicious_symbol>   # 找谁调了 <symbol>

# 2. ctags + grep
ctags -R --c-kinds=+pf src/ include/
# 然后基于 tags 文件搜跨层调用

# 3. clangd indexer / clang-query
clang-query -p compile_commands.json -c 'match callExpr(callee(functionDecl(hasName("<sym>"))))'
\`\`\`

工具不可用 / 索引失败 → 立即 **FAIL** · 报告 `tool unavailable`。**禁止**用"我猜大概是这样"代替真扫描。

#### Step 1.3 · 链接期符号兜底（nm 反查）

`#include` + 符号索引仍可能漏 weak symbol / extern 声明 / 函数指针 / dlopen 动态加载。必须再叠一轮链接期校验：

\`\`\`bash
# 对每个层的 .o / .a / .so，找其未定义符号
for obj in build/phy/*.o build/l2/*.o build/l3/*.o; do
  nm -gC "$obj" | grep ' U ' | awk '{print FILENAME ":" $2}' FILENAME="$obj"
done
\`\`\`

未定义符号反查 → 看它最终在哪一层定义 → 推出跨层依赖。把命中边标记 `via: link-symbol`，加入清单。

#### 输出格式

三轮扫描合并后，每条边归一化为：

\`\`\`json
{
  "from_layer": "L3",
  "from_path": "rrc/conn/setup.c",
  "to_layer": "PHY",
  "to_path": "phy/internal/dl_grant.h",
  "via": ["include", "static-call"],
  "evidence": [
    {"file": "rrc/conn/setup.c", "line": 142, "kind": "include"},
    {"file": "rrc/conn/setup.c", "line": 318, "kind": "call", "symbol": "phy_dl_grant_force"}
  ]
}
\`\`\`

`via` 取值：`include` / `static-call` / `link-symbol` / `function-pointer`。

### Step 2 · 对照 dependency_rules + RAN 强制规则

对每条依赖边 `(from_layer, to_layer, evidence)`：

1. **强制规则优先**（即使 yaml 没列）：
   - L3 → PHY 直接调用（不经 L2，不走 FAPI）→ 触发 RAN-B-1 / RAN-B-2 → error
   - L2 → PHY 不经 FAPI（即不命中 `include/fapi/`）→ 触发 RAN-B-2 → error
   - PHY → RRC 状态机/上下文结构体写入 → 触发 RAN-B-3 → error
   - 跨层调用未命中预定义接口 header → 触发 RAN-B-4 → error
   - 上层 → FPGA 寄存器 / DMA 直接访问 → 触发 RAN-B-5 → error
   - 跨层接口字段无 `// TS` 注释 → 触发 RAN-B-6 → warning

2. **yaml dependency_rules** 二次审：
   - 把层归类（in_scope / out_of_scope / unknown）
   - 在 `dependency_rules` 中查 `(from_layer, to_layer)` 对应规则
   - 如果 `allow=false` 且未在 `known_violations` → `NEW_VIOLATION`
   - 如果在 `known_violations` 中：
     - 实际涉及文件 ⊆ yaml 列出文件 → `KNOWN_VIOLATION`（违规在收敛）
     - 实际涉及文件 ⊋ yaml 列出文件 → `VIOLATION_EXPANSION` · severity 升级 error

3. **横切豁免**（关联 `cross_cutting_exempt`）：
   - from_layer 为 `cross-cutting` 或 file 命中 `class_patterns` glob → 降级为 `INFO` · 不计入 errors / warnings · 不影响 verdict
   - 但保留 INFO 累积记录（长期增长是 smell · 触发复盘）

4. 收集 `unknown` 层 / 模块 → 列入 `unclassified_packages`，提示是否要补 yaml 的层映射

### Step 3 · 输出报告

按以下 markdown 模板写入 `scope.yaml.metadata.report_path`（默认 `.harness/sprints/sprint-<N>-boundary-report.md`）：

\`\`\`markdown
# Boundary Report · Sprint {N} · L2/PHY/L3 层间边界

**生成时间**: {YYYY-MM-DD HH:MM}
**输入**: `.harness/scope/sprint-{N}.yaml`
**依赖图工具**: {grep + cscope / ctags / clangd / nm}
**总边数**: {N}（include {n}, call {n}, link-symbol {n}）

## 概要

| 维度 | 数量 |
|---|---|
| ❌ RAN 强制规则违反（B-1 ~ B-5）| {n} |
| ⚠️ RAN-B-6 协议字段无 TS 引用 | {n} |
| ❌ NEW_VIOLATION (error) | {n} |
| ⚠️ NEW_VIOLATION (warning) | {n} |
| 🔥 VIOLATION_EXPANSION | {n} |
| 📋 KNOWN_VIOLATION (收敛中) | {n} |
| ❓ UNCLASSIFIED_LAYERS | {n} |
| ⚠️ CONSISTENCY_WARNINGS | {n} |
| ℹ️ INFO · 横切豁免 | {n} |

## ❌ RAN 强制规则违反（阻断 L2）

| 规则 | from | to | 涉及文件:line | 证据类型 | 建议处理 |
|---|---|---|---|---|---|
| RAN-B-1 | L3:rrc/conn/setup.c | PHY:phy/internal/dl_grant.h | setup.c:142 | include | 改为经 L2 中转 + 走 FAPI |
| RAN-B-2 | L2:mac/sched/dl.c | PHY:phy/internal/* | dl.c:88 | static-call | 走 FAPI sf+k 接口 |
| RAN-B-5 | L3:oam/cli.c | HAL:fpga/regs/* | cli.c:55 | include | 经 HAL 抽象层 |

## ⚠️ RAN-B-6 协议字段无 TS 引用（不阻断 · 记入 Checkpoint）

| from | to | 字段 | 涉及文件:line | 建议 |
|---|---|---|---|---|

## ❌ NEW_VIOLATION (error · yaml 申报缺口)

| from | to | 涉及文件 | 处理 |

## 🔥 VIOLATION_EXPANSION（已知违规扩大 · 阻断 L2）

| from | to | yaml 已登记 | 实际新增 | 处理 |

## ⚠️ NEW_VIOLATION (warning · 不阻断)

| from | to | 涉及文件 | 备注 |

## 📋 KNOWN_VIOLATION（收敛中）

| from | to | yaml 登记 | 实际涉及 | 收敛进度 |

## ❓ UNCLASSIFIED_LAYERS

以下模块既不在 in_scope 也不在 out_of_scope · 建议补充层映射：
- {pkg_path}（引用次数: N）

## ⚠️ CONSISTENCY_WARNINGS

CLAUDE.md / 强制规则 / scope.yaml 三者的差异：
- CLAUDE.md 提到的层 X 在 yaml 中映射缺失
- yaml 的某 in_scope 模块在 CLAUDE.md 中未提及

## ℹ️ INFO · 横切豁免（不阻断 · 透明记录）

| from | to | 涉及文件 | 豁免原因 |
|---|---|---|---|
| common/log | * | log_init.c | class-pattern: log_* |
| common/utils | * | (whole edge) | role: cross-cutting |

> 长期 INFO 行数监控：相比上 Sprint 增长 → 提示豁免规则可能过宽 / 横切代码在膨胀，要复盘。
\`\`\`

### Step 4 · 评分（供 Evaluator L2.5 评分汇总消费）

按以下规则给出 0-10 分：

| 报告内容 | 扣分 |
|---|---|
| 任一 RAN-B-1 ~ B-5 强制规则违反 | -10（直接 0 分） |
| 任一 NEW_VIOLATION (error) | -10（直接 0 分） |
| 任一 VIOLATION_EXPANSION | -10（直接 0 分） |
| 每个 RAN-B-6 协议字段无 TS 引用 | -1 |
| 每个 NEW_VIOLATION (warning) | -2 |
| 每个 UNCLASSIFIED_LAYER | -1 |
| 每个 CONSISTENCY_WARNING | -0.5 |
| KNOWN_VIOLATION 文件数比上次增加 | 视同 VIOLATION_EXPANSION |
| KNOWN_VIOLATION 文件数比上次减少 | +1（封顶 10） |
| 横切豁免命中数（INFO） | -0（不扣分 · 但记录在报告） |

底分 0，满分 10。**通过门槛**: ≥ 7 且没有 RAN 强制规则违反 / error 级违规。

### Step 5 · 输出汇总（结构化）

最后用以下 JSON-like 块输出，供 Evaluator 程序化解析：

\`\`\`
BOUNDARY_REVIEWER_RESULT:
{
  "sprint": <N>,
  "score": <0-10>,
  "verdict": "PASS" | "FAIL" | "WARN",
  "ran_rule_violations": <count>,
  "errors": <count>,
  "warnings": <count>,
  "expansions": <count>,
  "ts_ref_missing": <count>,
  "report_path": "<路径>"
}
\`\`\`

verdict 规则:
- 任一 RAN 强制违反 / error / expansion → FAIL
- 否则 score < 7 → WARN
- 否则 → PASS
```

---

## 集成点

- **Constitution**: 原则 II · L2/PHY/L3 分层与接口契约不可隐式破坏
- **Evaluator**: L2.4 模块边界一致性 · 调用本 sub-agent 并消费 `BOUNDARY_REVIEWER_RESULT` · score 进入 L2.5 评分汇总
- **Corrector**: 收到 boundary FAIL 时，必须解耦（改为经 FAPI / HAL）/ 升级 scope（写入 known_violations 并附 ADR）/ 走专项重构 三选一 · 不允许"先这样吧"
- **Checkpoint**: warning 级违规和 unclassified 数量进入 Sprint 收官 Constitution II 打分
- **peer-reviewer**: 协议字段对照（维度 5）与 RAN-B-6 联动 · TS 引用缺失既算 boundary warning 也作为 peer-review 的 should-fix 候选

## 已知限制

- **C/C++ 跨层依赖图是静态分析**，不能捕捉运行时函数指针 / weak symbol / dlopen / 内核 syscall 跨层调用。这部分由 Constitution 待新增的"运行时跨切面"原则覆盖。
- 层映射依赖目录前缀，对**多 root 项目 / 跨仓库 submodule / 自定义构建产出布局** 需要在 yaml 显式覆盖 `module_layer_map`。
- 第一次在历史项目上跑，预期会有大量 NEW_VIOLATION + RAN 强制违反。**正确做法**是把它们逐条评估后挪进 `known_violations` 并标 `decision: freeze` + ADR 链接，让 sensor 进入"防扩大"模式，而不是粗暴标记 allow=true。
- **协议条款引用注释（RAN-B-6）依赖工程师自觉**：boundary-reviewer 只能看到注释存在与否，不能验证条款编号是否真实存在 / 条款内容是否正确。条款准确性留给 peer-reviewer 维度 5 + L4 主审。
