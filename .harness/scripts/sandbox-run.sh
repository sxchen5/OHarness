#!/usr/bin/env bash
# Harness VM 级沙箱 — 在 Docker 容器内执行 L1 验证
# 用法: .harness/scripts/sandbox-run.sh [command...]
# 环境: HARNESS_SANDBOX=1 时 verify-l1.sh 自动调用本脚本

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${HARNESS_SANDBOX_IMAGE:-harness-sandbox:latest}"
DOCKERFILE="$ROOT/.harness/sandbox/Dockerfile"

log() { echo "[sandbox] $*" >&2; }

if ! command -v docker >/dev/null 2>&1; then
  log "Docker not available — falling back to host verify-l1"
  exec bash "$ROOT/.harness/scripts/verify-l1.sh" --root "$ROOT"
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  log "Building image $IMAGE ..."
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$ROOT/.harness/sandbox"
fi

CMD="${*:-.harness/scripts/verify-l1-inner.sh}"

log "Running in sandbox: $CMD"
docker run --rm \
  -e HARNESS_ROOT=/workspace \
  -v "$ROOT:/workspace" \
  -w /workspace \
  "$IMAGE" \
  bash -lc "$CMD"
