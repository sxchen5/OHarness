<!--
来源: NTN 仓 .harness/prompts/evaluator.md (2026-05-04 改造现场 · 路径 C 双轨同步)
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

# Evaluator Prompt 模板 — 质量验证

## 使用方式

每个任务完成后，用对应的验证模板检查质量。不通过的项进入 Corrector 流程。

---

## 四级验证体系

### Level 1: CI 验证（自动化流水线，必须全部通过）

模拟 CI/CD 流水线的自动化检查。L1 不通过则阻断，不得进入 L2。

```
## CI 自动化验证

对刚才生成的代码执行以下 CI 流水线检查，按顺序执行，任一步失败则整体 FAIL：

### Step 1: 单元测试（门禁）

这是 CI 的第一道关卡。测试不通过，后续步骤不执行。

- [ ] `make test` — 所有单元测试 PASS（GTest / cmocka）
- [ ] 本次任务涉及的运行时逻辑必须有对应测试文件（TDD 产出）
- [ ] 测试失败数 = 0
- [ ] **cycle 预算断言**：协议栈 / 嵌入式驱动 / 数值算法类任务，单测必须包含 cycle 计数采样（N≥100），p95 ≤ Constitution III 阈值（参考 generator.md TDD Red 步骤）
- [ ] 协议事实查询任务（RAG）→ 不要求 TDD，但需提供溯源段落引用

**阻断规则**:
- 任务含运行时逻辑但无测试文件 → 直接 FAIL（"未完成"而非"遗漏"）
- 单测过但缺 cycle 断言 → FAIL（Constitution III 硬约束）

### Step 2: 编译 / 静态检查

- [ ] `make` 编译通过，`-Wall -Wextra -Werror` **零告警**（含 -Wfloat-equal 数值算法类）
- [ ] 头文件 / 数据结构定义类任务：仅需 make 过；不要求 cycle 断言

### Step 3: 静态分析 / 代码规范

- [ ] `cppcheck` 无 ERROR / 无 critical（warning 可接受）
- [ ] `clang-tidy` 无 ERROR（项目规则集配置在 `.clang-tidy`）
- [ ] 中断 / RT 安全规则（无 hot-path malloc / 无关中断长段 / 无 ISR 阻塞）静态扫描零告警

### Step 4: 协议栈起栈 + 接口契约 + 实物证据（嵌入式版）

编译过 ≠ 协议栈跑得起来；进程起来 ≠ 与硬件对得上；仿真过 ≠ 实机射频通业务。
此步在仿真/实机环境下逐层验证 BBU↔AAU↔UE 的协议链路。

#### 4.0 Pre-flight: 运行态新鲜度校对（强制，任一失败阻断后续 4a-4f）

验证"正在运行的协议栈/固件/bitstream"与"最新代码"一致，防止误把"旧二进制跑旧逻辑"当成"代码已生效"。

**执行方式**:
```bash
bash .harness/tools/preflight-embedded.sh
```

脚本自动校对：
- BBU 协议栈构建产物（`build/**/*.elf` / `*.so` / `*.a`）mtime vs 最近一次相关 commit
- 烧入 BBU 的固件 commit hash（从 `/proc/version` 或运行时上报接口拿）vs 当前 HEAD
- FPGA bitstream 烧录时间戳（从 FPGA 状态寄存器读出）vs `*.bit` 文件 mtime
- 仿真器进程版本（仿真模式下）

**阻断规则**:
- 任一构建产物 mtime **早于** 最近一次相关 commit → STALE，必须重新编译 / 烧录后再进入 4a
- 烧入固件 commit hash 与 HEAD 不一致 → STALE
- FPGA bitstream 烧录时间早于 `.bit` mtime → STALE
- 脚本输出 `STALE` 仍继续验证 → 视为 L1 Step 4 FAIL（流程违规）
- 如无 running 协议栈 → 4.0 自动 PASS（4a 会拉起全新实例）

**常见触发场景**:
- 跨天 / 跨会话继续验证：昨天起的协议栈进程今天测试时已"过期"
- 增量 commit 后忘记重烧固件 / 重载 bitstream
- 多版本共存：现场板子上跑的不是当前分支编译产物

#### 4a. 基础设施

- [ ] 仿真环境（开源 srsRAN / OpenAirInterface 或 内部仿真器）启动成功
- [ ] 共享内存 / DPDK 环网 / 跨核 IPC 通道就绪
- [ ] 仿真器版本 + 配置文件 hash 已记录（事后回放用）

#### 4b. 协议栈进程启动

- [ ] L1 / L2 / L3 进程启动无异常退出（dmesg / coredump 检查）
- [ ] 健康指标在 Constitution III 阈值内：
  - 单 TTI 处理时长 ≤ 500 µs
  - BBU CPU cycle 占用 ≤ 90%
  - 内存：运行 ≥ 5 min 后 RSS 平稳，无 leak
  - 跨核通信：无丢包 / 无队列堆积
- [ ] PHY ↔ MAC FAPI 心跳正常（连续 N 个 TTI 无丢拍）

#### 4c. 硬件就绪

- [ ] BBU ↔ AAU CPRI 链路 SYNC 成功（K28.5 同步 / 字时钟对齐）
- [ ] FPGA bitstream 加载校验通过（CRC / device ID）
- [ ] 关键控制寄存器 readback 与预期一致

#### 4d. 接口契约真实请求

启动后用真实接口调用验证已实现的协议栈端点。

**执行规则**:
1. **L2 → L1 FAPI 接口**：构造典型 sf+k 调度请求，PHY 侧确认接收并回 ACK
2. **L2 → FPGA 寄存器**：写关键控制字 → 读回校对（位段对齐到硬件契约）
3. **L3 ↔ OAM 接口**：跑典型流程（参数下发 / 告警上报 / 性能查询）
4. 每个端点必须含正常路径 + 异常路径（非法字段 / 越权 / 时序违反）
5. 验证结果记录到 Sprint 进度文件：
```
接口契约: {通过端点数}/{总端点数} PASS, 失败: {失败端点 + 根因}
```

#### 4e. 协议路径深度走查（替代深度点击）

4a-4d 是横向健康检查；4e 做纵向端到端协议路径走查，按 spec acceptance scenario 跑完整信令流程。

**执行规则**:
1. 打开本 Sprint 对应 feature 的 `spec.md`，列出 acceptance scenarios
2. 每条 scenario 至少选一条端到端协议路径
3. 典型路径：**UE 附着流程 = 随机接入 → SIB 接收 → RRC Connection Setup → 鉴权 → PDU 会话建立**
4. 在仿真器（或实机）按路径触发，验证：
   - 每一步信令字段与协议条款逐字对照（TS 38.331 / 38.413 / 38.501）
   - 时序约束（RA-RNTI 窗口 / msg2 时延 / msg4 ACK 时延）满足
   - 异常路径（拒绝 / 超时 / 重传）行为符合协议

**阻断规则**:
- 任一 scenario 在协议路径上断链 → FAIL，定位是 PHY/MAC/RLC/PDCP/RRC 哪层
- 时序违反（即使流程跑通）→ FAIL（NTN 实时性硬约束 · Constitution III）
- 信令字段与协议不符 → FAIL（Constitution I）

**记录方式**:
```
端到端路径: {scenario1 路径} → {scenario2 路径} ... | 时序 p95: {数据}
```

#### 4f. 实物证据（替代真 AI / UI 物证 · 涉协议栈关键路径强制）

前面 4a-4e 在仿真 / 进程层面证明"跑得通"，**不能证明实机射频 + UE 真机端到端真有业务**。
4f 是防"仿真过 / 实机断"的硬阻断。

**触发条件**（任一成立即 4f 硬约束）:
- Feature 涉及 AAU 射频路径（CPRI 控制字 / 波束 / 调度下发）
- Feature 有最终用户可见业务（UE 附着 / 上下行业务 / 切换 / 鉴权）
- Spec 含以"端到端用户业务可达"形式表述的 Acceptance Scenario

**执行规则**（4f.1 - 4f.3 顺序 · 一条缺失即 FAIL）:

1. **4f.1 CPRI 抓帧**：PCAP / 厂商抓包工具抓 ≥ 1 次完整流程的 CPRI 帧序列，
   控制字字段解出来与设计字段对照一致；存证到 `tests/captures/{feature}-{ts}.pcap`
2. **4f.2 频谱仪截图**：在 AAU 出口 / 接收端打频谱仪，截图 ≥ 1 张确认载波 / 功率 / 邻信道泄漏与设计一致；存证到 `tests/screenshots/{feature}-spectrum-{ts}.png`
3. **4f.3 UE 真机肉眼验证**：用真实 UE ≥ 1 次跑 feature 关联业务（附着 / ping / 速率），
   截屏或录屏存证；附着成功 + 业务指标（RSRP / SINR / 吞吐）非零

**阻断规则**:
- 任一 4f.1 / 4f.2 / 4f.3 缺失 → L1 Step 4 FAIL，不允许进 Level 2
- CPRI 抓帧字段与设计不符 → FAIL（硬件接口契约违反 · Constitution IV）
- 频谱异常（功率不达标 / 邻信道超限）→ FAIL
- UE 真机业务不通而仿真过 → FAIL（典型仿真/实机偏差）

#### 触发时机

- 每个批次（Batch）完成后 — 通过 progress.md 中的 🚧 批次门禁行强制触发
- Sprint Checkpoint 时
- 涉及硬件接口 / 时序 / 协议栈关键路径的任务完成后

**强制执行机制**: progress.md 中每个批次末尾有 `🚧 批次门禁` 行。
harness.exec 定位下一个 `[ ]` 时，遇门禁行必须先完成 Step 4 验证并标记通过，方可继续后续任务。

#### 阻断规则汇总

- **4.0 Pre-flight STALE → FAIL**，必须重编 / 重烧后继续
- 4a/4b/4c 任一失败 → FAIL，进入 Corrector
- 4d 接口契约失败 → 定位 L1/L2/L3 哪层后修复
- **4e 协议路径断链 / 时序违反 / 信令字段不符 → FAIL**
- **4f.1/4f.2/4f.3 任一缺失或不符 → FAIL**（Constitution IV 硬约束）

### CI 结果

| 步骤 | 结果 | 详情 |
|------|------|------|
| 单元测试 | ✅/❌ | {通过数}/{总数}（含 cycle 断言） |
| 编译 | ✅/❌ | -Wall -Wextra -Werror 零告警 |
| Lint / 静态分析 | ✅/❌ | cppcheck / clang-tidy ERROR: {n} |
| Pre-flight (4.0) | ✅/❌/N/A | 协议栈构建产物 / 固件 hash / FPGA bitstream / STALE-FRESH |
| 协议栈起栈 (4a-4c) | ✅/❌/N/A | L1/L2/L3 进程 UP，FAPI 心跳 OK，CPRI SYNC OK |
| 接口契约 (4d) | ✅/❌/N/A | 通过端点 {n}/{n} |
| 协议路径深度走查 (4e) | ✅/❌/N/A | scenario {n}/{n}，时序 p95 {数据} |
| **实物证据 (4f)** | ✅/❌/N/A | **CPRI 抓帧 {n} · 频谱截图 {n} · UE 真机 {n} 次** |

**整体判定**: 全部 ✅ → 进入 Level 2 / 任一 ❌ → 进入 Corrector
```

### Level 2: 契约与规格验证

L1 通过后，验证实现的正确性和完整性。

```
## 契约与规格验证

请检查刚才完成的任务 {任务ID} 生成的代码：

### 2.1 接口契约一致性

读取项目接口契约文档（任一适用即查）：
- `specs/{feature}/contracts/`（项目内接口契约目录，如有）
- `docs/hw-interface/{cpri,fpga,aau}-*.md`（硬件接口规范）
- 3GPP TS 引用（`TS 38.xxx §y.z` 在代码注释 / spec 中已逐项标注）
- FAPI / Small Cell Forum 接口规范（如适用）

逐项检查：

| 检查项 | 契约定义 | 实际实现 | 一致? |
|--------|---------|---------|------|
| 接口名 / 函数签名 | | | |
| 字段位段 / 偏移 / 字节序 | | | |
| 协议字段（每字段必须含 `// TS xx.xxx §y.z` 引用） | | | |
| 错误码 / 返回值约定 | | | |
| 时序约束（窗口 / 重传 / 超时） | | | |

### 2.2 协议数据结构一致性

读取 `specs/{feature}/data-model.md`（如有）或 spec.md 中的数据结构段，检查协议结构体字段：

| 字段名 | spec/协议定义 | 实现类型 + 位段 | 一致? |
|--------|-------------|----------------|------|

### 2.3 Acceptance Scenario 覆盖

读取 `specs/{feature}/spec.md` 中 {US编号} 的 acceptance scenarios，检查：

| Acceptance Scenario | 是否有对应代码路径 + 测试? | 位置 |
|---------------------|------------------------|------|
| Given... When... Then... | | |

### 2.4 评分标准

对以下维度打分（0-10）：

| 维度 | 分数 | 说明 |
|------|------|------|
| 接口契约一致性 | /10 | 实现与接口文档 / 3GPP TS 条款的匹配度 |
| 数据结构一致性 | /10 | 协议结构体字段 / 位段 / 字节序与 spec 一致 |
| Scenario 覆盖度 | /10 | acceptance scenario 的代码路径 + 测试覆盖完整程度 |
| 代码质量 | /10 | 可读性、命名、协议引用注释完整 |

**通过门槛**: 每项 ≥ 7 分，总分 ≥ 32 分
```

### Level 3: 协议一致性 + 互通 + 实时性预算实测

L1 通过后，对完成的 feature 跑 RAN 等价的端到端验证（替代 Web 项目的 Playwright）。

```
## L3 RAN 端到端验证

### 前置条件（强制，必须验证通过才能执行 L3）

以下每项必须确认通过，否则 L3 判定 BLOCKED（不是 PASS 也不是 FAIL）：

- [ ] 仿真器 / 实机协议栈已起栈（4a-4c PASS）
- [ ] CPRI SYNC + FPGA bitstream 校验通过（4c PASS）
- [ ] 测试套件版本与协议基线（R17 / R19 / CPRI v0.9）匹配
- [ ] 测试用例选择已在 plan.md 列出（不允许只跑容易过的子集）

**阻断规则**: 前置条件不满足 → L3 状态为 BLOCKED，不得标记为 PASS 或 N/A。
只跑仿真子集而跳过实机或互通 → 不算完成 L3。

---

### L3.1: 协议一致性测试（替代 Playwright E2E）

**执行方式**（任选一）:
- ETSI / Spirent / Keysight 协议一致性套件，PASS 率 ≥ 95%
- 开源 srsRAN / OpenAirInterface 端到端测试用例，PASS 率 ≥ 95%

**结果记录**:
```
协议一致性: 套件 {名} v{ver} | PASS {n}/{total} | 失败用例: {ID + 协议条款}
```

---

### L3.2: 互通测试

**执行范围**:
- [ ] 与至少 1 款主流终端互通（COTS UE：苹果 / 三星 / 华为 / 小米 任选）
- [ ] 与上游 5GC AMF 互通成功（开源 free5GC / Open5GS 或厂商 NF）
- [ ] 多 UE 并发场景：≥ N 个 UE 同时附着 + 上下行业务（N 由 spec 给）

**结果记录**:
```
互通: UE {型号} 附着 OK | AMF {名} 上下文建立 OK | 并发 N={n} 成功率 {%}
```

---

### L3.3: 实时性预算实测（NTN 特有）

**执行方式**:
- [ ] 关键路径 cycle 计数采样 N=100（典型路径：UL/DL 调度决策 / FAPI 编解码 / CPRI 控制字组帧 / 信道估计）
- [ ] 统计 p50 / p95 / p99
- [ ] 全部不超 Constitution III 阈值（单 TTI ≤ 500 µs · BBU CPU ≤ 90%）

**结果记录**:
```
实时性: 路径 {名} | p50/p95/p99 = {a}/{b}/{c} µs | BUDGET={x} µs | { PASS / FAIL }
```

---

### 阻断规则

- L3.1 PASS 率 < 95% → FAIL
- L3.2 任一互通失败（终端 / AMF / 并发）→ FAIL
- L3.3 任一关键路径 p95 超预算 → FAIL（Constitution III 硬约束）

### 评分标准

| 维度 | 分数 | 说明 |
|------|------|------|
| 协议一致性 | /10 | 套件 PASS 率 + 失败用例的协议条款追溯 |
| 互通完整性 | /10 | 终端 / 上游 NF / 并发 三类是否全覆盖 |
| 实时性达标 | /10 | 全部关键路径 p95 不超预算 |

**通过门槛**: 每项 ≥ 7 分，p95 不超预算

> 原 L3.5 视觉走查已删除 — NTN 无 GUI，视觉/UI 类检查不适用本项目。
```

---

### Level 4: Constitution 合规验证

#### ⚠️ L4 审查员实物验收前置条件（不可协商）

L4 Constitution Checkpoint **不能只看 progress.md 数字** · 必须执行实物验收：

1. **协议栈关键路径**：主审跑通至少 1 次端到端流程（典型：UE 附着 / 一次切换 / 一次切包），仿真过 + 实机过两类至少各一次
2. **CPRI 抓帧**：≥ 1 次完整流程的 CPRI 帧序列存证到 `tests/captures/`，控制字字段与硬件接口契约逐位对齐
3. **UE 附着 log**：实机或仿真附着 log，含 RA-RNTI / RRC Setup / 鉴权 / PDU 会话各阶段时间戳
4. **HV 节点（高价值场景）**：保留人工肉眼验证机制，验证对象为：
   - 频谱仪显示（载波 / 功率 / 邻信道泄漏与设计一致）
   - UE 真机业务体验（附着成功 / 速率达标 / 切换无丢包）
   - 上游 AMF 互通成功告警（无未知 NF 注册失败 / 无异常 NGAP 错误码）
5. **若审查员（子代理 / 独立上下文）无法执行以上**：必须**显式声明"未执行实物验收"**并对原则 IV（硬件接口契约）扣 1 CONDITIONAL · **不允许默认 PASS**

违反以上任一 → L4 审查结果无效 · 需主审介入重跑。

#### 合规审查矩阵（按原则打分 · 诚实扣分 · 避免 100/100 凑分）

```
## Constitution 合规验证

读取 `.specify/memory/constitution.md`，逐条检查本次代码变更是否合规：

| 原则 | 检查项 | 合规? | 备注 |
|------|--------|------|------|
| **I. 协议合规优先**（NON-NEG）| 所有功能可追溯到 3GPP TS / CPRI / 中国移动企规 等条款（含章节号） | | 缺引用 = MEDIUM 违规 |
| **I. 协议合规优先**（NON-NEG）| 无协议外擅自扩展（如有，已 ADR 标注"私有协议扩展"） | | |
| **II. L2/PHY/L3 分层与接口契约** | 跨层调用走预定义接口（FAPI / 内部接口契约），无绕过 | | boundary-reviewer 联检 |
| **II. L2/PHY/L3 分层与接口契约** | 接口字段读写清单已在 plan 阶段列出 | | |
| **III. 实时性预算硬约束**（NON-NEG）| 关键路径 cycle p95 ≤ Constitution III 阈值（实测数据） | | 单测 + L3.3 双重证据 |
| **III. 实时性预算硬约束**（NON-NEG）| 单 TTI ≤ 500 µs · BBU CPU ≤ 90% | | |
| **III. 实时性预算硬约束**（NON-NEG）| 端到端时延预算分解已写入 plan + implement 提供实测证据 | | |
| **IV. 硬件接口契约不可隐式变更**（NON-NEG）| CPRI 控制字 / FPGA 寄存器 / AAU 命令集 与硬件接口文档逐位对齐 | | 4f CPRI 抓帧 + readback 双证据 |
| **IV. 硬件接口契约不可隐式变更**（NON-NEG）| 硬件接口契约变更（如有）已走 ADR + 双方签字 | | |
| **V. 测试纪律**（NON-NEG）| 每条 `Deferrable: no` SC 提供 5 类证据（用例 / 报告 / log / 自动化 / 评审） | | |
| **V. 测试纪律**（NON-NEG）| TDD 单测 + cycle 断言均 PASS（含正负边界 + 退化输入） | | |
| **V. 测试纪律**（NON-NEG）| 集成测试（仿真）+ 协议一致性套件（条件成熟）已跑 | | L3.1 PASS 率 ≥ 95% |
| **VI. 可观测性是一等公民** | 每特性暴露至少 4 类指标（业务 / cycle/ 时延 / 资源） | | |
| **VI. 可观测性是一等公民** | 关键指标接入 telemetry 通道（log / metrics / trace） | | |
| **VI. 可观测性是一等公民** | 跨层调用携带 trace context | | |
| **VII. 复用优先 · 拒绝 NIH** | 实现来源按优先级选择（标准 codegen → 成熟开源 → 项目基线 → 新写） | | |
| **VII. 复用优先 · 拒绝 NIH** | plan 中含候选清单 + 决策依据 + 后果声明 | | |

**合规结果**:
- 硬约束违反数: {n}（NON-NEG 原则 I/III/IV/V 任一非 0 即 FAIL）
- 软约束违反数: {n}（II/VI/VII，记录理由可走 CONDITIONAL）
- **总分计算**：7 原则 × 10 = 70 · 每原则按扣分项诚实扣 · ≥ 65 PASS · ≥ 60 CONDITIONAL · < 60 FAIL · 任一 NON-NEG 原则 < 7 直接 FAIL
```

#### Checkpoint 演进轨迹记录（必须）

若 Sprint 内 Checkpoint 经历过撤回 / 重跑，在 checkpoint.md 必须记录演进轨迹：
- 原判决（日期 + 得分 + 方法）
- 撤回原因（具体 SEV + 违反的原则）
- 重跑判决（基于实测证据 · 对比原判差异）
- 纪律沉淀（教训 → memory 或模板）

---

## 综合评审报告模板

```
## 任务评审报告: {任务ID}

### 概要
- **任务描述**: {描述}
- **执行时间**: {耗时}
- **文件变更**: {新增/修改的文件列表}

### 验证结果

| 验证层级 | 结果 | 详情 |
|---------|------|------|
| Level 1 CI 验证 | ✅/❌ | 测试 {n}/{n}, 编译 {通过/失败}, Lint {n} errors, 启动 {UP/DOWN} |
| Level 2 契约规格 | ✅/❌ | 总分 {n}/40 |
| Level 3 RAN E2E | ✅/❌/N/A | 协议一致性 {%}, 互通 {n}/{n}, 实时性 p95 {数据} |
| Level 4 Constitution | ✅/❌ | 硬约束违反 {n}，软约束违反 {n} |

### 总体判定
- **PASS**: 所有层级通过 → 进入下一个任务
- **FAIL**: 任何层级未通过 → 进入 Corrector 流程，附带具体失败项

### 失败项清单（如有）
1. {具体问题描述 + 预期 vs 实际}
2. ...
```

---

## 验证频率

| 何时验证 | 验证级别 | 说明 |
|---------|---------|------|
| 每个任务完成后 | Level 1 + Level 2 | CI 通过 + 契约一致 |
| 每个用户故事完成后 | Level 1 + 2 + **3 (协议一致性 + 互通 + 实时性预算)** | 端到端协议链路 + 互通 + cycle 实测 |
| 每个 Sprint Checkpoint | Level 1 + 2 + 3 + **4** | 全面合规检查 |
| 涉及认证/评分/安全的任务 | Level 1 + 2 + 4 | 高风险任务必须 Constitution 检查 |
| 代码合并前 | Level 3 + 4 | E2E 回归 + Constitution 兜底 |
