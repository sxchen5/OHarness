#!/usr/bin/env bash
# 启动单阶段 Agent 会话
# 用法: session-launcher.sh <phase> <run_id> [repo_root]
set -euo pipefail

PHASE="${1:?phase required}"
RUN_ID="${2:?run_id required}"
ROOT="${3:-$(cd "$(dirname "$0")/../.." && pwd)}"

STATE_FILE="$ROOT/.harness/autopilot/runs/$RUN_ID/state.json"
PROMPT_SRC="$ROOT/.harness/runner/prompts/${PHASE}.md"
PROMPT_OUT="$ROOT/.harness/autopilot/runs/$RUN_ID/prompt-${PHASE}.md"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "ERROR: state not found: $STATE_FILE" >&2
  exit 1
fi

if [[ ! -f "$PROMPT_SRC" ]]; then
  echo "ERROR: prompt not found: $PROMPT_SRC" >&2
  exit 1
fi

# 从 state.json 提取变量（轻量 jq-free）
feature_id=$(grep -o '"feature_id": *"[^"]*"' "$STATE_FILE" | head -1 | sed 's/.*: *"\([^"]*\)"/\1/')
branch=$(grep -o '"branch": *"[^"]*"' "$STATE_FILE" | head -1 | sed 's/.*: *"\([^"]*\)"/\1/')
tier=$(grep -o '"tier": *"[^"]*"' "$STATE_FILE" | head -1 | sed 's/.*: *"\([^"]*\)"/\1/')
run_dir=".harness/autopilot/runs/$RUN_ID"
progress=$(grep -o '"progress": *"[^"]*"' "$STATE_FILE" | head -1 | sed 's/.*: *"\([^"]*\)"/\1/' || true)
options=$(grep -o '"options": *{[^}]*}' "$STATE_FILE" | head -1 | sed 's/"options": *//' || echo '{}')

sed \
  -e "s|{{RUN_ID}}|$RUN_ID|g" \
  -e "s|{{FEATURE_ID}}|$feature_id|g" \
  -e "s|{{BRANCH}}|$branch|g" \
  -e "s|{{TIER}}|$tier|g" \
  -e "s|{{RUN_DIR}}|$run_dir|g" \
  -e "s|{{PROGRESS_PATH}}|${progress:-.harness/sprints/sprint-1-progress.md}|g" \
  -e "s|{{OPTIONS_JSON}}|$options|g" \
  "$PROMPT_SRC" > "$PROMPT_OUT"

AGENT_BIN="${CURSOR_AGENT_BIN:-}"
if [[ -z "$AGENT_BIN" ]]; then
  if command -v agent >/dev/null 2>&1; then
    AGENT_BIN="agent"
  fi
fi

echo "[session-launcher] phase=$PHASE run=$RUN_ID"
echo "[session-launcher] prompt=$PROMPT_OUT"

if [[ -n "$AGENT_BIN" ]]; then
  cd "$ROOT"
  # shellcheck disable=SC2068
  exec "$AGENT_BIN" --print -f -p "$(cat "$PROMPT_OUT")" ${CURSOR_AGENT_MODEL:+--model "$CURSOR_AGENT_MODEL"}
else
  echo "[session-launcher] No agent CLI — in-process mode"
  echo "[session-launcher] Execute the prompt at: $PROMPT_OUT"
  cat "$PROMPT_OUT"
  exit 0
fi
