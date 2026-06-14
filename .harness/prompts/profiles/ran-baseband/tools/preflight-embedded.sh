#!/usr/bin/env bash
# Source: NTN 仓 .harness/tools/preflight-embedded.sh (2026-05-04 改造现场 · 路径 C 双轨同步)
# 关联: docs/backlog.md §0.5 已触发差距 · 此处为实战 evidence
#
# NTN-SPECIFIC 待剥离:
#   - SIM_PROCESS_NAMES 默认值 "srsenb,nr-softmodem,gnb,oai_softmodem" 偏 RAN 仿真器
#   - latest_commit_epoch_for_path 'src bbu fpga' 路径 (RAN 仓常见目录)
#
# 可保留作 RAN 通用 (无需剥离):
#   - 4 段 FRESH/STALE 校对架构 (构建产物 / 固件 hash / FPGA bitstream / 仿真器)
#   - 钩子化设计 (FW_HASH_CMD / FPGA_BURN_TS_CMD / SIM_VERSION_CMD)
#
# 剥离时机: 等 NRF 也跑出现场 (NRF 无 FPGA / 无仿真器, 但有 docker compose / k8s health),
# 两边对照才能抽象出 preflight 通用骨架.
# Harness L1 Step 4.0 — Pre-flight 运行态新鲜度校对（嵌入式版）
#
# 校对 BBU 协议栈构建产物 / 烧入固件 / FPGA bitstream / 仿真器版本
# 是否与最新代码 commit 一致。任一 STALE 即阻断后续 L1 Step 4。
#
# 校对维度：
#   1. 构建产物：build/ 下 .elf / .so / .a mtime vs 最近一次相关 commit
#   2. 烧入 BBU 固件 commit hash（FW_HASH_CMD 钩子）vs 当前 HEAD
#   3. FPGA bitstream 烧录时间（FPGA_BURN_TS_CMD 钩子）vs .bit 文件 mtime
#   4. 仿真器进程版本（仿真模式下，SIM_PROCESS_NAMES）
#
# 钩子未配置 → 降级 WARN（不阻断），便于硬件未接入时本地仿真也能跑；
# 钩子已配置但校对失败 → STALE，阻断。
#
# Exit codes:
#   0 = FRESH（含全部 WARN 但无 STALE）
#   1 = STALE，必须重编 / 重烧 / 重启仿真器
#   2 = 脚本内部错误

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

BUILD_DIR="${BUILD_DIR:-build}"
FPGA_BITSTREAM_FILE="${FPGA_BITSTREAM_FILE:-}"  # 显式给路径，否则自动找第一个 .bit
SIM_PROCESS_NAMES="${SIM_PROCESS_NAMES:-srsenb,nr-softmodem,gnb,oai_softmodem}"

STALE=0
WARN_COUNT=0

# ---------------------- helpers ----------------------

fmt_epoch() {
  if date --version >/dev/null 2>&1; then
    date -d "@$1" '+%Y-%m-%d %H:%M:%S'
  else
    date -r "$1" '+%Y-%m-%d %H:%M:%S'
  fi
}

mtime_of() {
  local f="$1"
  if stat -f %m "$f" >/dev/null 2>&1; then
    stat -f %m "$f"
  else
    stat -c %Y "$f"
  fi
}

hrs_diff() {
  awk "BEGIN{printf \"%.1f\", ($1-$2)/3600}"
}

latest_commit_epoch_for_path() {
  local path_pattern="$1"
  git log -1 --format=%ct -- $path_pattern 2>/dev/null
}

note_warn() {
  echo "  [WARN] $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

note_stale() {
  echo "  → STALE: $1"
  STALE=1
}

note_fresh() {
  echo "  → FRESH: $1"
}

echo "=========================================="
echo "Harness Pre-flight (嵌入式版) · 运行态新鲜度校对"
echo "=========================================="

# ---------------------- 1. 构建产物 mtime ----------------------
echo
echo "[1/4] 构建产物 mtime vs 最近 commit"

if [ ! -d "$BUILD_DIR" ]; then
  note_warn "构建目录 $BUILD_DIR 不存在 → 跳过本项（需先编译）"
else
  ART_NEWEST=""
  ART_NEWEST_TS=0
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    ts="$(mtime_of "$f" || echo 0)"
    if [ "$ts" -gt "$ART_NEWEST_TS" ]; then
      ART_NEWEST_TS="$ts"
      ART_NEWEST="$f"
    fi
  done < <(find "$BUILD_DIR" -type f \( -name '*.elf' -o -name '*.so' -o -name '*.a' \) 2>/dev/null)

  if [ -z "$ART_NEWEST" ]; then
    note_warn "$BUILD_DIR 下未找到 .elf / .so / .a → 跳过本项"
  else
    SRC_COMMIT="$(latest_commit_epoch_for_path 'src bbu fpga' || true)"
    [ -z "$SRC_COMMIT" ] && SRC_COMMIT="$(latest_commit_epoch_for_path '.' || true)"
    echo "  最新构建产物: $ART_NEWEST"
    echo "  产物 mtime  : $(fmt_epoch "$ART_NEWEST_TS")"
    if [ -n "$SRC_COMMIT" ]; then
      echo "  最近源码 commit: $(fmt_epoch "$SRC_COMMIT")"
      if [ "$SRC_COMMIT" -gt "$ART_NEWEST_TS" ]; then
        DIFF="$(hrs_diff "$SRC_COMMIT" "$ART_NEWEST_TS")"
        note_stale "源码 commit 落后产物 mtime $DIFF 小时 — 必须重新 make 后再校对"
      else
        note_fresh "构建产物晚于最近源码 commit"
      fi
    else
      note_warn "无 git 历史可比对 → 跳过本项"
    fi
  fi
fi

# ---------------------- 2. 烧入 BBU 固件 commit hash ----------------------
echo
echo "[2/4] 烧入 BBU 固件 commit hash vs HEAD"

HEAD_HASH="$(git rev-parse HEAD 2>/dev/null || echo)"

if [ -z "${FW_HASH_CMD:-}" ]; then
  note_warn "FW_HASH_CMD 未配置 → 跳过本项"
  note_warn "示例配置：export FW_HASH_CMD='ssh bbu cat /proc/version | awk \"{print \\\$NF}\"'"
elif [ -z "$HEAD_HASH" ]; then
  note_warn "无法读取当前 HEAD（不在 git 仓库内？）→ 跳过本项"
else
  set +e
  RUNNING_HASH="$(eval "$FW_HASH_CMD" 2>/dev/null)"
  RC=$?
  set -e
  if [ $RC -ne 0 ] || [ -z "$RUNNING_HASH" ]; then
    note_warn "FW_HASH_CMD 执行失败或返回空 → 跳过本项（BBU 未连接？）"
  else
    echo "  HEAD          : $HEAD_HASH"
    echo "  烧入 BBU hash : $RUNNING_HASH"
    if [ "$RUNNING_HASH" = "$HEAD_HASH" ]; then
      note_fresh "烧入固件 commit hash 与 HEAD 一致"
    else
      note_stale "烧入 BBU 固件 commit hash 与 HEAD 不一致 — 必须重烧固件"
    fi
  fi
fi

# ---------------------- 3. FPGA bitstream 烧录时间 ----------------------
echo
echo "[3/4] FPGA bitstream 烧录时间 vs .bit mtime"

if [ -z "$FPGA_BITSTREAM_FILE" ]; then
  FPGA_BITSTREAM_FILE="$(find . -type f -name '*.bit' 2>/dev/null | head -1 || true)"
fi

if [ -z "$FPGA_BITSTREAM_FILE" ] || [ ! -f "$FPGA_BITSTREAM_FILE" ]; then
  note_warn ".bit 文件未找到（FPGA_BITSTREAM_FILE 未设或路径不存在）→ 跳过本项"
elif [ -z "${FPGA_BURN_TS_CMD:-}" ]; then
  note_warn "FPGA_BURN_TS_CMD 未配置 → 跳过本项"
  note_warn "示例配置：export FPGA_BURN_TS_CMD='ssh fpga read_status_reg 0x40'  # 输出 epoch 秒"
else
  BIT_MTIME="$(mtime_of "$FPGA_BITSTREAM_FILE")"
  set +e
  BURN_TS="$(eval "$FPGA_BURN_TS_CMD" 2>/dev/null)"
  RC=$?
  set -e
  if [ $RC -ne 0 ] || ! [[ "$BURN_TS" =~ ^[0-9]+$ ]]; then
    note_warn "FPGA_BURN_TS_CMD 失败或返回非整数 epoch → 跳过本项"
  else
    echo "  bitstream 文件 : $FPGA_BITSTREAM_FILE"
    echo "  .bit mtime     : $(fmt_epoch "$BIT_MTIME")"
    echo "  烧录时间       : $(fmt_epoch "$BURN_TS")"
    if [ "$BIT_MTIME" -gt "$BURN_TS" ]; then
      DIFF="$(hrs_diff "$BIT_MTIME" "$BURN_TS")"
      note_stale ".bit 文件晚于 FPGA 烧录时间 $DIFF 小时 — 必须重新烧 bitstream"
    else
      note_fresh "FPGA 烧录晚于 .bit 文件"
    fi
  fi
fi

# ---------------------- 4. 仿真器进程版本 ----------------------
echo
echo "[4/4] 仿真器进程版本（仿真模式）"

SIM_FOUND=0
IFS=',' read -ra SIM_NAMES <<< "$SIM_PROCESS_NAMES"
for name in "${SIM_NAMES[@]}"; do
  name="$(echo "$name" | sed 's/^ *//;s/ *$//')"
  [ -z "$name" ] && continue
  pids="$(pgrep -f "$name" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    SIM_FOUND=1
    for pid in $pids; do
      cmdline="$(ps -o args= -p "$pid" 2>/dev/null | head -c 200 || true)"
      echo "  [sim:$name] PID=$pid"
      echo "    cmdline: $cmdline"
      # 这里不直接 STALE — 仿真器版本由项目自定义钩子（SIM_VERSION_CMD）判定
      if [ -n "${SIM_VERSION_CMD:-}" ]; then
        set +e
        sim_ver="$(eval "$SIM_VERSION_CMD" 2>/dev/null)"
        set -e
        echo "    版本: ${sim_ver:-未知}"
      fi
    done
  fi
done

if [ $SIM_FOUND -eq 0 ]; then
  note_warn "未发现仿真器进程（${SIM_PROCESS_NAMES}）→ 实机模式或仿真器未启 · 跳过本项"
fi

# ---------------------- 结论 ----------------------
echo
echo "=========================================="
echo "结论汇总: STALE=$STALE · WARN=$WARN_COUNT"
if [ $STALE -ne 0 ]; then
  echo "→ L1 Step 4.0 FAIL · 必须修复后再进入 4a-4f"
  echo
  echo "修复建议:"
  echo "  - 构建产物落后 → make clean && make"
  echo "  - 烧入固件 hash 不符 → 重烧 BBU 固件至当前 HEAD"
  echo "  - .bit 晚于 FPGA 烧录 → 重新烧 bitstream"
  echo "  - 仿真器版本不符 → kill <pid> && 重启仿真器"
  exit 1
fi
echo "→ L1 Step 4.0 PASS（含 $WARN_COUNT 项 WARN，未阻断）"
exit 0
