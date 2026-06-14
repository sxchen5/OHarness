#!/usr/bin/env bash
# E2E 沙箱 — 在 Docker 内运行 Playwright 测试
# 用法: .harness/scripts/e2e-sandbox.sh [test-command]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
IMAGE="${HARNESS_E2E_IMAGE:-harness-sandbox-e2e:latest}"
DOCKERFILE="$ROOT/.harness/sandbox/Dockerfile.e2e"
CMD="${1:-npm run test:e2e}"

if ! command -v docker >/dev/null 2>&1; then
  echo "[e2e-sandbox] Docker not available, running on host: $CMD"
  exec bash -lc "cd $ROOT && $CMD"
fi

if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
  echo "[e2e-sandbox] Building $IMAGE ..."
  docker build -t "$IMAGE" -f "$DOCKERFILE" "$ROOT/.harness/sandbox"
fi

exec docker run --rm \
  -v "$ROOT:/workspace" \
  -w /workspace \
  "$IMAGE" \
  bash -lc "$CMD"
