#!/usr/bin/env bash
# L1 验证内部脚本（在沙箱或宿主机执行）
set -euo pipefail
cd "${HARNESS_ROOT:-/workspace}"
exec bash .harness/scripts/verify-l1.sh --root "$(pwd)"
