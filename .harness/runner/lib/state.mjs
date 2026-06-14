import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot, readJson, timestampId, slugify } from './utils.mjs';

export function runDir(root, runId) {
  return join(root, '.harness/autopilot/runs', runId);
}

export function statePath(root, runId) {
  return join(runDir(root, runId), 'state.json');
}

export function createInitialState({ root, requirement, tier, workflow, featureId, branch, sddProvider, openspecChange, createPr }) {
  const runId = `${timestampId()}-${slugify(featureId || requirement).slice(0, 24)}`;
  const dir = runDir(root, runId);
  mkdirSync(dir, { recursive: true });

  const state = {
    run_id: runId,
    phase: workflow.phases[0] || 'INIT',
    phase_index: 0,
    requirement,
    tier,
    workflow_id: workflow.id,
    feature_id: featureId,
    branch,
    sdd_provider: sddProvider || 'speckit',
    openspec_change: openspecChange || null,
    create_pr: createPr !== false,
    session_id: 1,
    exec_batch_index: 0,
    sessions: [],
    retry_count: 0,
    fix_retry_count: 0,
    exec_batches_completed: 0,
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    artifacts: {
      run_dir: `.harness/autopilot/runs/${runId}`,
      discovery: `.harness/autopilot/runs/${runId}/discovery.md`,
      decisions: `.harness/autopilot/runs/${runId}/decisions.log`,
      spec: featureId ? `specs/${featureId}/spec.md` : null,
      plan: featureId ? `specs/${featureId}/plan.md` : null,
      tasks: featureId ? `specs/${featureId}/tasks.md` : null,
      sprint: null,
      progress: null,
      metrics: null,
      run_report: `.harness/autopilot/runs/${runId}/run-report.md`,
    },
    options: workflow.options,
    errors: [],
  };

  writeFileSync(join(dir, 'requirement.md'), requirement, 'utf8');
  writeFileSync(statePath(root, runId), JSON.stringify(state, null, 2), 'utf8');
  return state;
}

export function loadState(root, runId) {
  const p = statePath(root, runId);
  if (!existsSync(p)) throw new Error(`Run not found: ${runId}`);
  return readJson(p);
}

export function saveState(root, state) {
  state.updated_at = new Date().toISOString();
  writeFileSync(statePath(root, state.run_id), JSON.stringify(state, null, 2), 'utf8');
}

export function listRuns(root) {
  const dir = join(root, '.harness/autopilot/runs');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => existsSync(join(dir, n, 'state.json')));
}

export function findLatestRun(root) {
  const runs = listRuns(root);
  if (!runs.length) return null;
  return runs.sort().reverse()[0];
}

export function findLatestFailedRun(root) {
  const runs = listRuns(root).sort().reverse();
  for (const id of runs) {
    try {
      const s = loadState(root, id);
      if (s.status === 'failed') return id;
      if (s.status === 'running' && s.phase !== 'DONE') return id;
    } catch {
      // skip invalid
    }
  }
  return null;
}

export function resolveFeatureDir(root, featureId) {
  const direct = join(root, 'specs', featureId);
  if (existsSync(direct)) return direct;
  const specs = join(root, 'specs');
  if (!existsSync(specs)) return direct;
  for (const name of readdirSync(specs)) {
    if (name.endsWith(featureId) || name.includes(featureId)) {
      return join(specs, name);
    }
  }
  return direct;
}

export function updateArtifactPaths(state, root) {
  const featureDir = resolveFeatureDir(root, state.feature_id);
  const rel = featureDir.replace(`${root}/`, '');
  state.artifacts.spec = `${rel}/spec.md`;
  state.artifacts.plan = `${rel}/plan.md`;
  state.artifacts.tasks = `${rel}/tasks.md`;
  return state;
}
