<!--
来源: NTN 仓 .harness/prompts/planner.md (2026-05-04 改造现场 · 路径 C 双轨同步)
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

# Planner Prompt 模板 — Sprint 规划

## 使用方式

将以下内容复制到 Claude Code 中执行。替换 `{变量}` 为实际值。

---

## Prompt

```
你是一个 Sprint 规划器（Planner）。请根据以下输入，将任务分解为可执行的 Sprint。

## 输入

### 任务清单
{粘贴 tasks.md 的内容，或指定路径让 Claude Code 读取}

### 约束条件
- 每个 Sprint 时长: {1周 / 2周}
- 团队规模: {N} 人
- 每人每Sprint可用工时: {X} 小时
- AI辅助开发效率系数: 1.5-2x（协议栈类不取 Web 的 3x，因为协议条款核对 / 字段位偏移确认 / 实时性预算回测反复多）

### 规划规则

1. **依赖优先**: 严格遵守 tasks.md 中的 Phase 依赖顺序，不可跳过
2. **用户故事完整性**: 同一个用户故事的任务尽量放在同一个 Sprint，确保Sprint结束时有可验证的增量
3. **并行利用**: 标记 [P] 的任务可分配给不同成员并行执行
4. **验证节点**: 每个 Sprint 必须包含验证检查点（Checkpoint）
5. **MVP优先**: Sprint 1 必须瞄准 MVP（US1 + US2）
6. **批次门禁**: 每个批次（Batch）末尾必须标注 L1 Step 4 门禁点。门禁点会体现在 progress 文件中作为强制检查行。

### 批次类型定义

每个批次（Batch）按内容分为四种类型，门禁验证内容不同（对齐 evaluator.md L1 Step 4 嵌入式版）：

| 批次类型 | 判断规则 | 门禁验证内容 |
|---------|---------|-------------|
| **协议栈批次** | 含 FAPI / RRC / MAC / PDCP / RLC / 信令编解码 任务 | `make test` 全 PASS（含 cycle 断言）+ 仿真器+协议栈进程起栈（4a-4b）+ FAPI 心跳 OK + L2→L1 接口契约真实请求 PASS（4d） |
| **嵌入式驱动批次** | 含 CPRI / FPGA 寄存器 / 中断 / DMA / SPI/I2C/GPIO 任务 | `make test` 含 mock MMIO 序列校验 + 硬件就绪（CPRI SYNC + bitstream 校验，4c）+ 关键寄存器 readback 一致 + **4f 实物证据**（CPRI 抓帧 + 频谱 + UE 真机） |
| **数值算法批次** | 含 ECEF↔ENU / 信道估计 / SFN 时序 / SIMD 内核 / FFT 等数值任务 | `make test` 黄金向量 PASS + 数值精度断言（`ASSERT_NEAR`）+ cycle p95 ≤ BUDGET |
| **集成批次** | 含端到端协议路径 / 互通 / 协议一致性套件 / Sprint Checkpoint 任务 | L1 Step 4 全部 ✅（4.0-4f）+ L3.1 协议一致性 ≥ 95% + L3.2 互通 PASS + L3.3 实时性 p95 不超预算 |

混合批次使用**最高级别门禁**（集成 > 嵌入式驱动 > 协议栈 > 数值算法）。
注：嵌入式驱动 > 协议栈，因驱动批次必须 4f 实物证据（CPRI 抓帧 / 频谱 / UE 真机）。

### 任务工时估算基准（AI辅助开发 · 协议栈/嵌入式 RAN 基准）

- 协议栈头文件 / 数据结构定义: 0.5h
- FAPI 接口实现（典型一对 sf+k）: 2-4h
- RRC 状态机一段（如 Connection Setup）: 4-8h
- MAC 调度算法一个特性: 4-8h
- CPRI 控制字组帧逻辑: 2-4h
- FPGA 寄存器读写驱动: 1-2h
- 数值算法（ECEF→ENU / SFN+Slot 时序 / 信道估计 等）: 2-4h
- 单元测试（含 cycle 预算断言）: 1-2h
- 集成测试（仿真环境 srsRAN / OAI）: 2-4h
- 协议一致性套件适配（ETSI / Spirent / Keysight）: 4-8h
- CPRI 抓帧分析（PCAP 解码 + 字段对照硬件契约）: 2-4h

> **AI 辅助效率系数**：协议栈类按 **1.5-2x**（不是 Web 的 3x），原因：协议条款逐字核对、硬件字段位偏移确认、实时性预算回测、信令字段端到端 trace 反复多，AI 加速空间小于纯业务代码。

## 输出格式

对每个 Sprint 输出：

### Sprint {N}: {Sprint 目标}
**时间**: {起止日期}
**目标**: {一句话描述Sprint交付物}
**对应Phase**: {tasks.md 中的 Phase}

#### 任务清单
| 任务ID | 描述 | 负责人 | 预估工时 | 并行标记 |
|--------|------|--------|---------|---------|
| T001   | ...  | 成员A  | 0.5h    | [P]     |

#### 👁 人工验证节点（实物验收强制）

**规划阶段必须 identify · 至少 2 个节点 · 均涉射频路径或用户可见业务**。

规划目的：防"AI 一路 autopilot 到 Sprint 收官才让主审验收"· 把问题暴露从"事后撤回判决"提前到"过程中及时 pivot"。NTN 软硬一体的特殊之处：仿真过 ≠ 实机过，进程起栈 ≠ 频谱可见，FAPI 心跳 OK ≠ UE 真机能附着。

| 节点 ID | 所在批次 | 触发时机 | 验证动作 | 预期时间 | 验证人 |
|---|---|---|---|---|---|
| HV-1 | 批次 N（典型首个 US 仿真可用）| 首个核心协议路径可用时 | 主审在仿真器看 UE 附着 log + FAPI 心跳 + 抓 1 次 CPRI 帧解析 | ~10 min | 协议栈主审 |
| HV-2 | 批次 Polish（收官前）| 4f 实物证据收口 | 实机 UE 真机走业务（附着 / 上下行 / 切换）+ 频谱仪截图 ≥ 1 张 + 上游 AMF 互通无异常 NGAP 错误码 | ~30-45 min | 主审 + 射频 / 终端工程师 |

**识别规则**:
- Feature 涉 AAU 射频路径（CPRI 控制字 / 波束下发 / 调度）→ 必须 ≥ 2 个 HV 节点
- Feature 涉最终用户可见业务（UE 附着 / 上下行业务 / 切换 / 鉴权）→ 必须 ≥ 1 个 HV 节点（推荐 2）
- 纯协议栈内部重构 / 纯算法重写（零射频路径 / 零业务可见性）→ 可 0 个 HV 节点（显式说明）

**HV 节点在批次门禁行的标记格式**：
```
- [ ] 🚧 **批次N门禁: L1 Step4 + 👁 HV-M (~N min, {验证人})** | 结果: - |
```
通过后更新为：
```
- [x] 🚧 **批次N门禁: L1 Step4 + 👁 HV-M PASS** | 结果: ✅ 主审实物验收 + CPRI 抓帧 / 频谱截图 / UE 真机 log {对应证据} |
```

**HV 节点执行时**:
- AI（Generator）**暂停**新任务 · 等待主审反馈
- 主审反馈"通过" → 继续批次
- 主审反馈"有问题" → 走 Corrector 或 `/harness.fix` · 不继续后续任务
- 未标注 / 未执行 HV 直接收官 → Constitution IV（硬件接口契约）-2 · V（测试纪律）-1

#### 验证检查点
- [ ] {自动化检查项1}
- [ ] {自动化检查项2}

#### Sprint 完成标准
- {可验证的交付物描述}
- **所有 HV 节点全部 PASS 签收**

#### 风险项
- {可能的阻塞或延期风险}

---

最后输出一个总览表：

### Sprint 总览
| Sprint | 目标 | 任务数 | 总工时 | 关键交付物 |
|--------|------|--------|--------|-----------|
```

## 规划产出示例

```
### Sprint 1: US1 (单小区多波束) + US5 (CPRI 下发) 最小演示
**目标**: 仿真环境下 1 个测试 UE 通过 1 个波束附着到单小区，CPRI 抓帧能解析出 4 波束控制字
**对应 Phase**: Phase 1 (Setup) + Phase 2 (Foundational) + Phase 3 (US1 + US5)
**任务**: 8-12 个（不超 Constitution 30 红线）
**验证检查点**:
- [ ] 仿真器（srsRAN / OAI / 内部）启动成功 + DPDK / 共享内存就绪（4a）
- [ ] L1/L2/L3 进程起栈无异常 + FAPI 心跳 OK + cycle 占用 ≤ 90%（4b）
- [ ] BBU↔AAU CPRI 链路 SYNC + FPGA bitstream 校验通过（4c）
- [ ] L2→L1 FAPI sf+k 调度请求构造 + PHY 接收 ACK（4d）
- [ ] UE 附着 E2E：随机接入→SIB→RRC Connection Setup→鉴权→PDU 会话建立（4e）
- [ ] CPRI 抓帧 ≥ 1 次解析出 4 波束控制字 + 频谱仪截图 ≥ 1 张 + UE 真机肉眼附着 ≥ 1 次（4f）
- [ ] SC-001 + SC-004 两条 acceptance scenario 全 PASS

### Sprint 2: US2 + US3 增量
**目标**: ...
**对应 Phase**: Phase 3 (US2 + US3)
...
```

## 注意事项

- Sprint 规划产出保存到 `.harness/sprints/sprint-{n}.md`
- 每个 Sprint 开始前，用 Generator 模板逐个执行任务
- 每个 Sprint 结束后，用 Metrics 模板生成度量报告
