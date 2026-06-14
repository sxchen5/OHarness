import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveFeatureDir } from './lib/state.mjs';

function readText(path) {
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

function countMatches(text, regex) {
  return (text.match(regex) || []).length;
}

function countPendingTasks(progressPath, root) {
  const full = join(root, progressPath);
  if (!existsSync(full)) return -1;
  const text = readText(full);
  const pending = (text.match(/^- \[ \]/gm) || []).length;
  return pending;
}

function latestSprintFiles(root) {
  const dir = join(root, '.harness/sprints');
  if (!existsSync(dir)) return { sprint: null, progress: null };
  const sprints = readdirSync(dir)
    .filter((f) => /^sprint-\d+\.md$/.test(f))
    .sort((a, b) => {
      const na = Number(a.match(/\d+/)[0]);
      const nb = Number(b.match(/\d+/)[0]);
      return nb - na;
    });
  if (!sprints.length) return { sprint: null, progress: null };
  const sprint = `.harness/sprints/${sprints[0]}`;
  const progress = sprint.replace('.md', '-progress.md');
  return { sprint, progress: existsSync(join(root, progress)) ? progress : null };
}

function readProjectTestCommand(root) {
  const commandsFile = join(root, '.harness/config/project-commands.yaml');
  if (!existsSync(commandsFile)) return null;
  const text = readText(commandsFile);
  const match = text.match(/^\s*test:\s*"?([^"\n]+)"?\s*$/m);
  return match ? match[1].trim() : null;
}

function runL1Verification(root) {
  const script = join(root, '.harness/scripts/verify-l1.sh');
  const bash = spawnSync('bash', [script, '--root', root], {
    encoding: 'utf8',
    cwd: root,
  });
  if (bash.status === 0) return bash;

  const testCmd = readProjectTestCommand(root);
  if (process.platform === 'win32' && testCmd) {
    return spawnSync(testCmd, {
      encoding: 'utf8',
      cwd: root,
      shell: true,
    });
  }
  return bash;
}

export function runGate(phase, state, root, config) {
  const gates = config.gates || {};
  const featureDir = resolveFeatureDir(root, state.feature_id);
  const specPath = join(featureDir, 'spec.md');
  const planPath = join(featureDir, 'plan.md');
  const tasksPath = join(featureDir, 'tasks.md');
  const discoveryPath = join(root, state.artifacts.discovery);

  switch (phase) {
    case 'INIT': {
      const ok = !!state.feature_id && !!state.branch;
      return gateResult(ok, ok ? 'INIT complete' : 'feature_id or branch missing', ok ? 'DISCOVER' : null);
    }
    case 'DISCOVER': {
      const text = readText(discoveryPath);
      const minLines = gates.discover?.min_discovery_lines || 20;
      const lines = text.split('\n').filter((l) => l.trim()).length;
      const ok = lines >= minLines;
      const next = resolvePostDiscoverPhase(state, root);
      return gateResult(ok, ok ? `discovery.md has ${lines} lines` : `discovery.md needs >= ${minLines} lines`, ok ? next : null);
    }
    case 'OPSX_PROPOSE': {
      const change = state.openspec_change;
      if (!change) return gateResult(false, 'openspec_change not set', null);
      const proposal = join(root, 'openspec/changes', change, 'proposal.md');
      const tasks = join(root, 'openspec/changes', change, 'tasks.md');
      const ok = existsSync(proposal) && existsSync(tasks);
      return gateResult(ok, ok ? `openspec change ${change} ready` : `missing proposal/tasks for ${change}`, ok ? 'SPRINT' : null);
    }
    case 'SPECIFY': {
      const text = readText(specPath);
      const us = countMatches(text, /^### User Story \d+/gm);
      const scenarios = countMatches(text, /^\d+\.\s+\*\*Given\*\*/gm);
      const maxUs = gates.specify?.max_user_stories || 3;
      const ok = us >= 1 && scenarios >= 1 && us <= maxUs;
      let msg = `spec: ${us} user stories, ${scenarios} scenarios`;
      if (us > maxUs) msg += ` (exceeds max ${maxUs})`;
      return gateResult(ok, msg, ok ? 'PLAN_TASKS' : null);
    }
    case 'PLAN_TASKS': {
      const hasSpec = existsSync(specPath);
      const hasTasks = existsSync(tasksPath);
      const requirePlan = gates.plan_tasks?.require_plan !== false;
      const hasPlan = existsSync(planPath);
      const taskCount = countMatches(readText(tasksPath), /^- \[[ x]\] T\d+/gm);
      const maxTasks = gates.plan_tasks?.max_tasks || 30;
      const planOk = !requirePlan || hasPlan || state.options?.generate_plan === false;
      const ok = hasSpec && hasTasks && planOk && taskCount >= 1 && taskCount <= maxTasks;
      return gateResult(ok, `plan=${hasPlan} tasks=${taskCount}`, ok ? 'SPRINT' : null);
    }
    case 'SPRINT': {
      const { sprint, progress } = latestSprintFiles(root);
      if (sprint) {
        state.artifacts.sprint = sprint;
        state.artifacts.progress = progress;
      }
      const ok = !!progress;
      return gateResult(ok, ok ? `sprint=${sprint}` : 'sprint progress file missing', ok ? 'EXEC' : null);
    }
    case 'EXEC': {
      const progress = state.artifacts.progress;
      const pending = countPendingTasks(progress, root);
      if (pending < 0) {
        return gateResult(false, 'progress file missing', null);
      }
      if (pending > 0) {
        return gateResult(false, `${pending} tasks still pending — continue EXEC`, 'EXEC', { stay: true });
      }
      const l1 = runL1Verification(root);
      const ok = l1.status === 0;
      return gateResult(ok, ok ? 'all tasks done, L1 passed' : `L1 failed: ${l1.stderr || l1.stdout}`, ok ? 'EVAL' : null);
    }
    case 'EVAL': {
      const progress = state.artifacts.progress;
      const text = readText(join(root, progress || ''));
      const hasL2 = /L2:\s*✅|L2:✅/.test(text) || !state.options?.generate_plan;
      const ok = hasL2 || state.tier === 'S';
      return gateResult(ok, ok ? 'L2 verification recorded' : 'L2 not marked in progress', ok ? nextAfterEval(state) : null);
    }
    case 'E2E': {
      const marker = join(root, '.harness/sprints', 'e2e-passed.marker');
      let ok = state.tier !== 'L' || existsSync(marker);
      if (!ok && state.tier === 'L') {
        const useSandbox = process.env.HARNESS_E2E_SANDBOX === '1' || config?.e2e?.sandbox === true;
        if (useSandbox) {
          const e2e = spawnSync('bash', [join(root, '.harness/scripts/e2e-sandbox.sh')], {
            encoding: 'utf8',
            cwd: root,
          });
          ok = e2e.status === 0 || existsSync(marker);
        }
      }
      return gateResult(ok || state.tier !== 'L', ok ? 'E2E passed' : 'E2E phase — marker or sandbox run required', ok || state.tier !== 'L' ? 'CLOSE' : null);
    }
    case 'CLOSE': {
      const metricsDir = join(root, '.harness/metrics');
      const hasMetrics = existsSync(metricsDir) && readdirSync(metricsDir).some((f) => f.endsWith('.json'));
      const hasReport = existsSync(join(root, state.artifacts.run_report));
      const ok = hasReport || hasMetrics || state.tier === 'S';
      return gateResult(ok, `metrics=${hasMetrics} report=${hasReport}`, ok ? 'PR' : null);
    }
    case 'PR': {
      const ok = state.pr_url || state.status === 'done';
      return gateResult(ok, ok ? `PR: ${state.pr_url || 'marked done'}` : 'PR not created', ok ? 'DONE' : null);
    }
    case 'DONE':
      return gateResult(true, 'run complete', null);
    default:
      return gateResult(false, `unknown phase: ${phase}`, null);
  }
}

function nextAfterEval(state) {
  if (state.workflow_id === 'tier-L' && state.options?.run_e2e) return 'E2E';
  return 'CLOSE';
}

function resolvePostDiscoverPhase(state, root) {
  if (state.openspec_change && state.sdd_provider === 'openspec') {
    const proposal = join(root, 'openspec/changes', state.openspec_change, 'proposal.md');
    if (existsSync(proposal)) return 'SPRINT';
    return 'OPSX_PROPOSE';
  }
  if (state.sdd_provider === 'openspec') return 'OPSX_PROPOSE';
  return 'SPECIFY';
}

function gateResult(pass, message, nextPhase, extra = {}) {
  return { pass, message, nextPhase, ...extra };
}

export function advancePhase(state, workflow, gateResult) {
  if (!gateResult.pass) {
    if (gateResult.stay) return state.phase;
    return state.phase;
  }
  if (!gateResult.nextPhase) return 'DONE';
  const idx = workflow.phases.indexOf(gateResult.nextPhase);
  if (idx >= 0) state.phase_index = idx;
  return gateResult.nextPhase;
}
