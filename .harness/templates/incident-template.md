# Incident · {TASK_ID} · {ISO_TIMESTAMP}

> evaluator FAIL 触发的 5 分钟故障复盘。**5 分钟内填完**，超时不写就丢失。
> 文件位置：`.harness/incidents/{ISO_TIMESTAMP}-{TASK_ID}.md`

---

## 1. 症状（1-2 句话）

<!-- 哪个验证级别（L1/L2/L3/L4）什么验证项 FAIL 了？错误信号是什么？复制 evaluator 输出关键 1-3 行即可。 -->

**FAIL 级别**: <!-- L1 / L2 / L3 / L4 -->
**FAIL 项**: <!-- 例如 "L2.1 API 契约一致性 < 7 分" / "L1 Step 4f 真 AI 实物未跑" -->
**错误信号**:
```
<!-- 粘贴 evaluator 输出的 1-3 行关键报错 -->
```

## 2. 根因（一句话）

<!--
  填具体的"为什么"，不是表面的"什么坏了"。
  Bad: "测试失败" / "代码不对"
  Good: "generator 没读 wiki 直接编了字段名" / "spec 没写 cycle 预算导致 evaluator 跑空"
-->

## 3. 修法（具体动作）

<!-- 工程师做了什么让它 PASS。代码 commit hash / prompt 改动 / 配置改动都行。 -->

- 改了文件: <!-- 路径 -->
- 改动摘要: <!-- 一句话 -->
- commit: <!-- hash 或 "未提交" -->

## 4. 触发哪条规则升级

<!--
  这是反向沉淀的关键字段。问自己：
  - 这次坑能不能让 AI Native OS 自己以后避开？
  - 哪条 prompt / template / Constitution 原则需要加一句话？
  - 如果不知道改哪里，写"待 /harness.upstream 处理"。
-->

**应升级目标**: <!-- 例如 "evaluator.md L2.1" / "Constitution 原则 II" / "generator.md 协议栈模板" -->
**升级动作**: <!-- 一句话描述要在那个文件加什么规则 -->

> 决定要不要立刻 cut 一条 PENDING 进 `.specify/memory/constitution-pending.md`：
> 跑 `/harness.upstream constitution "<上面的升级动作>"` 即落库。

## 5. 是否进 LoRA 训练池

<!--
  如果这次 FAIL 是"AI 写错了代码 + 工程师写了修法"，自动喂下次 LoRA 重训。
  仅当 FAIL 由 generator 输出引发 + 工程师明确给了正确版本时勾选。
-->

- [ ] 喂 LoRA 训练池（自动归档 .harness/lora-feed/{TASK_ID}.json）

---

**填表时间**: <!-- ISO 时间 -->
**填表人**: <!-- 名字 -->
**Sprint**: <!-- Sprint N -->

---

## 集成钩子（evaluator 调用方式 · Q2 W4-W5 上线）

```bash
# evaluator FAIL 后调用
INCIDENT_FILE=".harness/incidents/$(date -Iseconds)-${TASK_ID}.md"
mkdir -p .harness/incidents
cp harness/templates/incident-template.md "$INCIDENT_FILE"
sed -i '' "s/{TASK_ID}/${TASK_ID}/g; s/{ISO_TIMESTAMP}/$(date -Iseconds)/g" "$INCIDENT_FILE"
echo "故障复盘待填: $INCIDENT_FILE"
echo "5 分钟内填完。Cmd+Enter 跳过会扣项目宪法 1 CONDITIONAL。"
${EDITOR:-vi} "$INCIDENT_FILE"
```

evaluator.md 集成位置：每次 L1-L4 verdict=FAIL 时强制调用。
