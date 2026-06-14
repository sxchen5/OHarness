#!/usr/bin/env bash
# 5 分钟积累机制 PoC ② · 性能基线档案自动归档
# 触发：Sprint 完成时，evaluator L1-L4 全 PASS 后由 hook 调用
# 入参：TASK_ID + 实测数据 JSON 文件路径（或从 stdin 读）
# 产出：.harness/metrics/perf-archive/{task-id}.json
# 工程师付出：0（hook 自动调用）
#
# 设计依据：第 4.4.1.4 节 + Task #16

set -euo pipefail

TASK_ID="${1:-}"
PERF_DATA="${2:-}"

if [[ -z "$TASK_ID" ]]; then
  echo "用法: $0 <TASK_ID> [<perf-data.json>]" >&2
  echo "      cat perf.json | $0 <TASK_ID>" >&2
  exit 2
fi

ARCHIVE_DIR=".harness/metrics/perf-archive"
mkdir -p "$ARCHIVE_DIR"

OUTPUT_FILE="${ARCHIVE_DIR}/${TASK_ID}.json"
ISO_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "no-git")
SPRINT=$(git symbolic-ref --short HEAD 2>/dev/null | grep -oE 'sprint-[0-9]+' || echo "unknown-sprint")

# 读 perf data
if [[ -n "$PERF_DATA" && -f "$PERF_DATA" ]]; then
  RAW_DATA=$(cat "$PERF_DATA")
elif [[ ! -t 0 ]]; then
  RAW_DATA=$(cat)
else
  echo "未提供 perf 数据。用 $0 $TASK_ID <file.json> 或管道传入" >&2
  exit 2
fi

# 验证是合法 JSON
if ! echo "$RAW_DATA" | python3 -c "import json,sys; json.loads(sys.stdin.read())" 2>/dev/null; then
  echo "perf 数据不是合法 JSON" >&2
  exit 3
fi

# 包装上下文 + 写出
cat > "$OUTPUT_FILE" <<EOF
{
  "task_id": "$TASK_ID",
  "archived_at": "$ISO_TS",
  "git_sha": "$GIT_SHA",
  "sprint": "$SPRINT",
  "perf_data": $RAW_DATA
}
EOF

echo "归档: $OUTPUT_FILE"

# 与 metrics.md 集成：append 到 metrics 索引
INDEX_FILE=".harness/metrics/perf-index.jsonl"
echo "{\"task_id\":\"$TASK_ID\",\"archived_at\":\"$ISO_TS\",\"sprint\":\"$SPRINT\",\"file\":\"$OUTPUT_FILE\"}" >> "$INDEX_FILE"
