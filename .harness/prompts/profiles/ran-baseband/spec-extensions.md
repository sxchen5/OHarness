# Ran-Baseband Profile · Spec 撰写扩展（孵化中）

<!-- 来源: 本仓 speckit.clarify.md + spec-template.md 的通信域增补段（2026-05 从基础文件剥离回 profile） -->

通信类项目对 `/speckit.clarify` 扫描清单和 `spec-template.md` 的领域增补。基础文件保持通用、不含通信特质；通信项目启用本 profile 后，按下面两节把对应片段并入 clarify 命令和 spec 模板。

## 适用 / 不适用

**适用**：5G 核心网（SBI/NF）/ RAN 协议栈（PHY/MAC/RLC/RRC/PDCP/SDAP）/ NTN / 嵌入式物理层。
**不适用**：通用 Web/SaaS、AI 业务系统——整段跳过。

---

## 1. Clarify 扫描扩展（并入 `commands/speckit.clarify.md` 的扫描清单）

在 clarify 的扫描类别中追加一组通信域检测维度（非通信项目跳过）：

```
Telecom Domain *(optional · 仅通信类项目检测此 4 维 · 非通信项目跳过)*:
- **协议合规**: 是否引用了具体的协议条款（TS 编号 + 版本 + 章节）？多版本兼容性边界（R15/R16/R17 差异）？字段值域 / 枚举范围是否完整？
- **实时性预算**: 是否声明了关键路径的 cycle / latency 上限？测量方式（cycle 计数 / wall-clock / N 采样 p95）是否具体？
- **硬件接口**: 是否依赖 FPGA / DSP / 仿真器 / 频谱仪等外部硬件？接口形式（FAPI / CPRI / PCIe）+ 时序约束是否声明？
- **跨层边界**: 协议栈跨层调用边界（PHY/MAC/RRC/NAS）是否明确？哪些是 in-scope / out-of-scope？known violations 是否登记？
```

---

## 2. Spec 模板扩展（追加到 `specify/templates/spec-template.md` 末尾）

通信项目的 spec 末尾追加「Telecom Domain Annexes」附录三段。非通信项目不追加。

```markdown
---

## Telecom Domain Annexes *(optional · 非通信类项目可整段删除)*

<!--
  以下三段仅适用于通信类项目（5G 核心网 / RAN / NTN / 协议栈实现）。
  非通信类项目请整段删除，不要保留空标题。
  通信类项目必须填三段，否则 /speckit.analyze 会提示缺失。
-->

### Protocol References

引用本 feature 涉及的协议条款，**段落级精度**（用于 evaluator 字段对照 + 反向追溯）。

格式：
- [协议号] [版本] §[章节号] ¶[段落号]: [本 feature 用到的具体内容]

示例：
- TS 29.510 R17 §6.1.6.2.2 ¶3-4: NFProfile 必填字段（nfInstanceId / nfType）
- TS 38.331 R17 §5.3.3: RRC Connection Setup 流程
- CPRI v0.9 §4.2.7.1: IQ 数据帧格式

### Hardware Contracts

声明本 feature 对硬件 / 仿真器 / 外部子系统的契约。**有则必填**（即使没有也声明"无硬件依赖"）。

格式：
- [硬件 / 仿真器名称]: [接口形式] / [输入] / [输出] / [时序约束]

示例：
- FPGA bitstream v2.3.1: FAPI P5 over PCIe / 输入 DL_TTI.request / 输出 SLOT.indication / DL_TTI 必须在 TTI N 提前 ≥ 2 slot
- srsRAN gNB v23.10: AMF interface 模拟 / 不支持 PNI-NPN
- 频谱仪 R&S FSV3050: 抓帧带宽 ≥ 100 MHz

### Real-time Budget

声明本 feature 的实时性预算 + 关键路径的 cycle / latency 上限。**协议栈 / 嵌入式必填**。

格式：
- [关键路径]: ≤ [上限] · [测量方式]

示例：
- DL HARQ ACK 处理: ≤ 200 µs (n+1 slot 内必返回) · cycle 计数 + N≥100 采样 p95
- RRC ConnectionSetup 处理: ≤ 50 ms · 端到端 wall-clock + N≥30 采样 p95
- NFProfile JSON 反序列化: ≤ 5 ms · cycle 计数 + N≥200 采样 p99

> 这三段是 evaluator L2 (协议字段对照) / L3 (cycle 断言) / L4 (实物证据) 的输入源。空着会导致 evaluator 跑空。
```
