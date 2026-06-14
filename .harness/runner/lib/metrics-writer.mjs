import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function countProgressTasks(progressText) {
  const done = (progressText.match(/^- \[x\]/gm) || []).length;
  const pending = (progressText.match(/^- \[ \]/gm) || []).length;
  const blocked = (progressText.match(/⚠️ BLOCKED/g) || []).length;
  return { done, pending, blocked, total: done + pending };
}

function healthColor(value, green, yellow) {
  if (value >= green) return 'green';
  if (value >= yellow) return 'yellow';
  return 'red';
}

/**
 * 从 Autopilot run state 生成度量 JSON，写入 .harness/metrics/
 */
export function writeAutopilotMetrics(root, state) {
  mkdirSync(join(root, '.harness/metrics'), { recursive: true });

  const progressPath = state.artifacts?.progress
    ? join(root, state.artifacts.progress)
    : null;
  const progressText = progressPath && existsSync(progressPath)
    ? readFileSync(progressPath, 'utf8')
    : '';
  const tasks = countProgressTasks(progressText);
  const completionRate = tasks.total > 0 ? tasks.done / tasks.total : null;

  const report = {
    schema_version: '1.0',
    type: 'autopilot-run',
    run_id: state.run_id,
    feature_id: state.feature_id,
    tier: state.tier,
    sdd_provider: state.sdd_provider,
    status: state.status,
    phase: state.phase,
    created_at: state.created_at,
    updated_at: state.updated_at,
    sessions: state.session_id ?? 1,
    exec_batches: state.exec_batch_index ?? 0,
    errors: state.errors || [],
    execution: {
      tasks_done: tasks.done,
      tasks_pending: tasks.pending,
      tasks_blocked: tasks.blocked,
      completion_rate: completionRate,
      health: completionRate != null ? healthColor(completionRate, 0.9, 0.7) : null,
    },
    verification: {
      l1_script: '.harness/scripts/verify-l1.sh',
      sandbox: process.env.HARNESS_SANDBOX === '1',
    },
    artifacts: state.artifacts,
    pr_url: state.pr_url || null,
  };

  const outFile = join(root, '.harness/metrics', `autopilot-${state.run_id}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');

  // 最新 run 指针（供度量大屏读取）
  writeFileSync(
    join(root, '.harness/metrics', 'latest-autopilot.json'),
    JSON.stringify({ run_id: state.run_id, path: outFile, updated_at: report.updated_at }, null, 2),
    'utf8',
  );

  return { path: outFile, report };
}

/**
 * 可选：POST 到外部 metrics API
 */
export async function pushMetricsApi(report, apiUrl) {
  if (!apiUrl) return { pushed: false };
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    return { pushed: res.ok, status: res.status };
  } catch (e) {
    return { pushed: false, error: String(e.message || e) };
  }
}
