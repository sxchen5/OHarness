#!/usr/bin/env bash
# Harness L1 门禁 — 技术正确性（test / build / lint）
# 用法: .harness/scripts/verify-l1.sh [--root PATH]
# HARNESS_SANDBOX=1 时委托 sandbox-run.sh（Docker 容器）
# 退出码: 0=通过, 1=失败

set -euo pipefail

ROOT="$(pwd)"
if [[ "${1:-}" == "--root" ]]; then
  ROOT="${2:-.}"
fi

if [[ "${HARNESS_SANDBOX:-0}" == "1" ]] && [[ "${HARNESS_SANDBOX_RECURSE:-}" != "1" ]]; then
  export HARNESS_SANDBOX_RECURSE=1
  exec bash "$ROOT/.harness/scripts/sandbox-run.sh" ".harness/scripts/verify-l1-inner.sh"
fi

cd "$ROOT"

log() { echo "[verify-l1] $*" >&2; }
fail() { log "FAIL: $*"; exit 1; }
pass() { log "PASS: $*"; }

COMMANDS_FILE=".harness/config/project-commands.yaml"
TEST_CMD=""
BUILD_CMD=""
LINT_CMD=""

if [[ -f "$COMMANDS_FILE" ]]; then
  TEST_CMD=$(grep -E '^\s*test:' "$COMMANDS_FILE" | head -1 | sed 's/.*test:\s*"\?\([^"]*\)"\?.*/\1/' | sed 's/^ *//;s/ *$//' || true)
  BUILD_CMD=$(grep -E '^\s*build:' "$COMMANDS_FILE" | head -1 | sed 's/.*build:\s*"\?\([^"]*\)"\?.*/\1/' | sed 's/^ *//;s/ *$//' || true)
  LINT_CMD=$(grep -E '^\s*lint:' "$COMMANDS_FILE" | head -1 | sed 's/.*lint:\s*"\?\([^"]*\)"\?.*/\1/' | sed 's/^ *//;s/ *$//' || true)
fi

run_cmd() {
  local label="$1"
  local cmd="$2"
  log "Running $label: $cmd"
  if bash -lc "$cmd"; then
    pass "$label"
    return 0
  fi
  fail "$label"
}

has_script() {
  local sub="$1"
  local script="$2"
  [[ -f "$sub/package.json" ]] && node -e "const p=require('./$sub/package.json'); process.exit(p.scripts&&p.scripts['$script']?0:1)" 2>/dev/null
}

run_detected() {
  local kind="$1"
  local ran=0
  for sub in scan-platform-backend scan-platform-frontend .; do
    [[ -d "$sub" ]] || continue
    case "$kind" in
      test)
        if has_script "$sub" test; then
          run_cmd "test ($sub)" "cd $sub && npm test"
          ran=1
        elif [[ -f "$sub/pom.xml" ]] && command -v mvn >/dev/null 2>&1; then
          run_cmd "test ($sub)" "cd $sub && mvn -q test"
          ran=1
        fi
        ;;
      build)
        if has_script "$sub" build; then
          run_cmd "build ($sub)" "cd $sub && npm run build"
          ran=1
        elif [[ -f "$sub/pom.xml" ]] && command -v mvn >/dev/null 2>&1; then
          run_cmd "build ($sub)" "cd $sub && mvn -q -DskipTests package"
          ran=1
        fi
        ;;
      lint)
        if has_script "$sub" lint; then
          run_cmd "lint ($sub)" "cd $sub && npm run lint"
          ran=1
        fi
        ;;
    esac
  done
  return $((ran > 0 ? 0 : 1))
}

log "Starting L1 verification at $ROOT"

if [[ -n "$TEST_CMD" ]]; then
  run_cmd "test (configured)" "$TEST_CMD"
elif ! run_detected test; then
  log "SKIP: no test command"
fi

if [[ -n "$BUILD_CMD" ]]; then
  run_cmd "build (configured)" "$BUILD_CMD"
elif ! run_detected build; then
  log "SKIP: no build command"
fi

if [[ -n "$LINT_CMD" ]]; then
  run_cmd "lint (configured)" "$LINT_CMD"
else
  run_detected lint || log "SKIP: no lint command"
fi

log "L1 verification complete"
exit 0
