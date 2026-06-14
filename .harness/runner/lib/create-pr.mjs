import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function hasGh() {
  const r = spawnSync('bash', ['-lc', 'command -v gh'], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim();
}

/**
 * 使用 GitHub CLI 创建 PR（draft 默认）。
 */
export function createPullRequest(root, state, config) {
  const prConfig = config.pr || {};
  const base = process.env.HARNESS_BASE_BRANCH || prConfig.base_branch || 'main';
  const title = `[Autopilot] ${state.feature_id}`;
  const bodyFile = join(root, state.artifacts.run_dir, 'run-report.md');
  const draft = prConfig.mode !== 'ready';
  const labels = (prConfig.labels || ['autopilot']).join(',');
  const reviewers = (prConfig.required_reviewers || []).join(',');

  if (!hasGh()) {
    return { ok: false, error: 'gh CLI not found', manual: true };
  }

  const push = spawnSync('git', ['push', '-u', 'origin', state.branch], {
    cwd: root,
    encoding: 'utf8',
  });
  if (push.status !== 0) {
    return { ok: false, error: push.stderr || push.stdout, step: 'push' };
  }

  const args = [
    'pr', 'create',
    '--base', base,
    '--head', state.branch,
    '--title', title,
  ];
  if (existsSync(bodyFile)) {
    args.push('--body-file', bodyFile);
  } else {
    args.push('--body', `Autopilot run ${state.run_id} for ${state.feature_id}`);
  }
  if (draft) args.push('--draft');
  if (labels) args.push('--label', labels);
  if (reviewers) args.push('--reviewer', reviewers);

  const result = spawnSync('gh', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) {
    return { ok: false, error: result.stderr || result.stdout, step: 'pr_create' };
  }

  const url = (result.stdout || '').trim();
  return { ok: true, url, draft };
}
