# Harness Prompts · Domain Profiles

**状态**：孵化机制（`install.sh` 尚未支持 profile 选择，profiles/ 内容仍为草稿）

## 为什么有这个目录

Toolkit 出处偏 Web/AI 业务系统，`harness/prompts/*.md`（扁平 8 文件）实质是 web-saas profile 的事实版本。当 toolkit 推到 NRF（核心网 SBI）/ NTN（协议栈）等通信项目时，部分硬编码（`./mvnw`、`pnpm`、`actuator/health` 等）失去意义，需要按域特化。

这个目录是"特化版本的孵化场"：每个 profile 一个子目录。

## 当前 Profile

| Profile | 适用域 | 状态 | 来源 |
|---|---|---|---|
| `ran-baseband/` | RAN 协议栈 / 嵌入式 / 物理层 | 孵化中 | NTN 现场（路径 C 双轨） |
| `cn-control-plane/` | 5G 核心网控制面 SBI 化 NF | 未建 | 等 NRF 跑出现场再建 |
| `web-saas/` | 通用 Web/SaaS + 真 AI | 未建（当前 `harness/prompts/*.md` 即事实版本） | 等 `install.sh` 支持后正式迁入 |

## 路线图

1. **当前**（2026-05）：孵化 ran-baseband（从 NTN 现场）
2. **下一阶段**：NRF 跑出现场 → 孵化 cn-control-plane
3. **再下阶段**：`install.sh` 加 `domain` 字段，bootstrap 按 `init-options.json` 铺对应 profile
4. **终态**：扁平 `prompts/*.md` 迁入 `profiles/web-saas/`，所有项目按 profile 选择

## 约定

- 每个 profile 子目录必须有 README：适用域 / 不适用域 / 待迁入文件 / 升级条件
- 草稿文件每段顶部标注来源：`<!-- 来源: <项目>/<文档>/<段> -->`
- 含项目专属硬编码加：`<!-- PROJECT-SPECIFIC 待抽象: ... -->`
