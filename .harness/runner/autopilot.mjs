#!/usr/bin/env node
/**
 * Harness Autopilot — 主编排器
 *
 * 用法:
 *   node .harness/runner/autopilot.mjs init --requirement "需求描述"
 *   node .harness/runner/autopilot.mjs status --run <run_id>
 *   node .harness/runner/autopilot.mjs gate --run <run_id>
 *   node .harness/runner/autopilot.mjs advance --run <run_id>
 *   node .harness/runner/autopilot.mjs prompt --run <run_id>
 *   node .harness/runner/autopilot.mjs run --requirement "需求" [--tier M] [--create-pr]
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAutopilotConfig, loadWorkflow } from './lib/config.mjs';
import { detectTier } from './lib/tier-detect.mjs';
import {
  createInitialState,
  loadState,
  saveState,
  findLatestRun,
  findLatestFailedRun,
  listRuns,
  updateArtifactPaths,
} from './lib/state.mjs';
import { runGate, advancePhase } from './gates.mjs';
import { findRepoRoot, slugify } from './lib/utils.mjs';
import { syncOpenSpecToSpecs, findOpenSpecChange } from './lib/openspec-adapter.mjs';
import {
  initSession,
  nextSession,
  onExecBatchComplete,
  writeSessionLog,
  renderSessionHeader,
} from './lib/session-manager.mjs';
import { constitutionRef } from './lib/constitution.mjs';
import { getNextParallelBatch, formatParallelPrompt } from './lib/parallel-exec.mjs';
import { writeAutopilotMetrics, pushMetricsApi } from './lib/metrics-writer.mjs';
import {
  collectRunMetrics, analyzeRuns, writeLearnedPolicy, writeLearnedYaml, applyLearnedPolicy,
} from './lib/policy-learner.mjs';
import {
  enqueueRun, listPending, markProcessed, updateQueueStatus, queuePaths,
} from './lib/run-queue.mjs';
import { generateMonorepoScope } from './lib/monorepo-scope.mjs';
import { createPullRequest } from './lib/create-pr.mjs';
import { runParallelBatch } from './lib/parallel-runner.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = findRepoRoot(join(__dirname, '../..'));

function getConfig() {
  const base = loadAutopilotConfig(ROOT);
  if (base.learning?.auto_apply !== false) {
    return applyLearnedPolicy(base, ROOT);
  }
  return base;
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(a);
    }
  }
  return args;
}

function readRequirement(args) {
  if (args.requirement) return args.requirement;
  if (args['@']) return readFileSync(args['@'], 'utf8').trim();
  const pos = args._.slice(1).join(' ').trim();
  return pos;
}

function generateFeatureId(requirement, config) {
  const slug = slugify(requirement).slice(0, 40);
  const specsDir = join(ROOT, 'specs');
  if (!existsSync(specsDir)) return slug;
  const existing = existsSync(join(specsDir, slug));
  if (!existing) return slug;
  return `${slug}-${Date.now().toString(36)}`;
}

function generateBranch(featureId, config) {
  const prefix = config.git?.branch_prefix || 'cursor';
  const suffix = config.git?.branch_suffix || 'f82a';
  return `${prefix}/${featureId}-${suffix}`;
}

function cmdInit(args) {
  const config = getConfig();
  const requirement = readRequirement(args);
  if (!requirement) {
    console.error('Error: --requirement or positional text required');
    process.exit(1);
  }
  const tier = args.tier || detectTier(requirement, config);
  const workflow = loadWorkflow(tier, ROOT);
  const sddProvider = args['sdd-provider'] || config.sdd?.provider || 'speckit';
  const openspecChange = args['openspec-change'] || (sddProvider === 'openspec' ? slugify(requirement).slice(0, 40) : null);
  const featureId = args['feature-id'] || (openspecChange ? slugify(openspecChange) : generateFeatureId(requirement, config));
  const branch = args.branch || generateBranch(featureId, config);
  const state = createInitialState({
    root: ROOT,
    requirement,
    tier,
    workflow,
    featureId,
    branch,
    sddProvider,
    openspecChange,
    createPr: args['create-pr'] !== false,
  });
  state.options = workflow.options;
  initSession(state);
  updateArtifactPaths(state, ROOT);
  saveState(ROOT, state);
  console.log(JSON.stringify({
    ok: true,
    run_id: state.run_id,
    tier,
    feature_id: featureId,
    branch,
    sdd_provider: sddProvider,
    openspec_change: openspecChange,
    phase: state.phase,
  }, null, 2));
  return state;
}

function maybeSyncOpenSpec(state) {
  if (state.sdd_provider !== 'openspec' || !state.openspec_change) return state;
  const change = findOpenSpecChange(ROOT, state.openspec_change);
  if (!change) return state;
  const result = syncOpenSpecToSpecs(ROOT, state.openspec_change, state.feature_id);
  state.feature_id = result.featureId;
  updateArtifactPaths(state, ROOT);
  return state;
}

function cmdStatus(args) {
  const runId = args.run || findLatestRun(ROOT);
  if (!runId) {
    console.error('No runs found');
    process.exit(1);
  }
  const state = loadState(ROOT, runId);
  console.log(JSON.stringify(state, null, 2));
}

function cmdGate(args) {
  const config = getConfig();
  const runId = args.run || findLatestRun(ROOT);
  const state = loadState(ROOT, runId);
  const workflow = loadWorkflow(state.tier, ROOT);
  const result = runGate(state.phase, state, ROOT, config);
  saveState(ROOT, state);
  console.log(JSON.stringify({ phase: state.phase, ...result }, null, 2));
  process.exit(result.pass ? 0 : 1);
}

function cmdAdvance(args) {
  const config = getConfig();
  const runId = args.run || findLatestRun(ROOT);
  const state = loadState(ROOT, runId);
  const workflow = loadWorkflow(state.tier, ROOT);
  const gate = runGate(state.phase, state, ROOT, config);
  if (!gate.pass) {
    console.log(JSON.stringify({ advanced: false, phase: state.phase, gate }, null, 2));
    process.exit(1);
  }
  const prevPhase = state.phase;
  const next = advancePhase(state, workflow, gate);
  handlePostGate(state, { ...gate, pass: true, nextPhase: next }, config);
  state.phase = next;
  state.retry_count = 0;
  if (next === 'DONE') {
    maybeWriteRunMetrics(state, config, { markDone: true });
  } else if (prevPhase === 'CLOSE' && next === 'PR') {
    maybeWriteRunMetrics(state, config);
  }
  if (next === 'PR' && state.create_pr && !state.pr_url) {
    tryAutoCreatePr(state, config);
  }
  saveState(ROOT, state);
  console.log(JSON.stringify({
    advanced: true,
    phase: next,
    gate,
    metrics_path: state.metrics_path || null,
  }, null, 2));
}

function renderPrompt(state, config) {
  const promptPath = join(ROOT, '.harness/runner/prompts', `${state.phase}.md`);
  if (!existsSync(promptPath)) return null;
  let text = readFileSync(promptPath, 'utf8');
  const parallelBatch = state.phase === 'EXEC' ? getNextParallelBatch(ROOT, state) : null;
  const vars = {
    RUN_ID: state.run_id,
    FEATURE_ID: state.feature_id,
    BRANCH: state.branch,
    TIER: state.tier,
    RUN_DIR: state.artifacts.run_dir,
    PROGRESS_PATH: state.artifacts.progress || '.harness/sprints/sprint-1-progress.md',
    OPTIONS_JSON: JSON.stringify(state.options || {}),
    OPENSPEC_CHANGE: state.openspec_change || slugify(state.feature_id),
    SESSION_ID: String(state.session_id ?? 1),
    EXEC_BATCH: String(state.exec_batch_index ?? 0),
    CONSTITUTION_PATH: constitutionRef(ROOT, config),
    PARALLEL_TASKS_BLOCK: parallelBatch ? formatParallelPrompt(parallelBatch) : '',
  };
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, String(v));
  }
  const header = renderSessionHeader(state);
  return `${header}\n\n${text}`;
}

function cmdPrompt(args) {
  const config = getConfig();
  const runId = args.run || findLatestRun(ROOT);
  const state = loadState(ROOT, runId);
  const prompt = renderPrompt(state, config);
  if (!prompt) {
    console.error(`No prompt for phase ${state.phase}`);
    process.exit(1);
  }
  const out = join(ROOT, state.artifacts.run_dir, `prompt-${state.phase}.md`);
  writeFileSync(out, prompt, 'utf8');
  if (args.json) {
    console.log(JSON.stringify({ phase: state.phase, prompt_path: out, prompt }, null, 2));
  } else {
    console.log(prompt);
  }
}

function cmdSyncOpenspec(args) {
  const runId = args.run || findLatestRun(ROOT);
  const state = loadState(ROOT, runId);
  const change = args.change || state.openspec_change;
  if (!change) {
    console.error('Error: --change or state.openspec_change required');
    process.exit(1);
  }
  state.openspec_change = change;
  state.sdd_provider = 'openspec';
  const synced = maybeSyncOpenSpec(state);
  saveState(ROOT, synced);
  console.log(JSON.stringify({
    ok: true,
    feature_id: synced.feature_id,
    spec: synced.artifacts.spec,
    tasks: synced.artifacts.tasks,
  }, null, 2));
}

function handlePostGate(state, gate, config) {
  const syncPhases = ['OPSX_PROPOSE', 'DISCOVER'];
  if (gate.pass && state.sdd_provider === 'openspec' && state.openspec_change) {
    if (syncPhases.includes(state.phase) || gate.nextPhase === 'SPRINT') {
      maybeSyncOpenSpec(state);
    }
  }
  if (gate.pass && state.phase === 'SPRINT' && config.monorepo?.auto_scope !== false) {
    try {
      const scope = generateMonorepoScope(ROOT, state);
      state.artifacts.scope = scope.path;
    } catch (e) {
      // non-fatal
    }
  }
  if (gate.pass && state.phase === 'EXEC' && gate.stay) {
    onExecBatchComplete(state);
    writeSessionLog(ROOT, state);
  } else if (gate.pass && config.session?.new_session_per_phase !== false) {
    const prev = state.session_id;
    nextSession(state, `phase_${state.phase}_complete`);
    if (state.session_id !== prev) writeSessionLog(ROOT, state);
  }
  return state;
}

function finalizeRun(state, config) {
  if (config.metrics?.auto_write !== false) {
    const { path, report } = writeAutopilotMetrics(ROOT, state);
    state.metrics_path = path;
    const apiUrl = process.env.HARNESS_METRICS_API_URL || config.metrics?.api_url;
    if (apiUrl) {
      pushMetricsApi(report, apiUrl).then((r) => {
        writeFileSync(
          join(ROOT, state.artifacts.run_dir, 'metrics-push.json'),
          JSON.stringify(r, null, 2),
        );
      }).catch(() => {});
    }
  }
  return state;
}

/** Skill / advance 路径：在 CLOSE→PR 或 DONE 时刷新 autopilot-*.json */
function maybeWriteRunMetrics(state, config, { markDone = false } = {}) {
  if (markDone) state.status = 'done';
  return finalizeRun(state, config);
}

function cmdFinalize(args) {
  const config = getConfig();
  const runId = args.run || findLatestRun(ROOT);
  if (!runId) {
    console.error('No runs found');
    process.exit(1);
  }
  const state = loadState(ROOT, runId);
  const updated = maybeWriteRunMetrics(state, config, { markDone: args.done === true });
  saveState(ROOT, updated);
  console.log(JSON.stringify({
    ok: true,
    run_id: runId,
    metrics_path: updated.metrics_path,
    status: updated.status,
    phase: updated.phase,
  }, null, 2));
}

async function cmdResume(args) {
  const runId = args.run || findLatestFailedRun(ROOT);
  if (!runId) {
    console.error('No failed or interrupted run to resume');
    process.exit(1);
  }
  const state = loadState(ROOT, runId);
  state.status = 'running';
  state.retry_count = 0;
  saveState(ROOT, state);
  console.log(JSON.stringify({
    ok: true,
    resumed: runId,
    phase: state.phase,
    feature_id: state.feature_id,
  }, null, 2));
  await cmdRun({ ...args, run: runId });
}

function tryAutoCreatePr(state, config) {
  if (!state.create_pr || state.pr_url) return state;
  const result = createPullRequest(ROOT, state, config);
  if (result.ok) {
    state.pr_url = result.url;
    state.pr_draft = result.draft;
  } else {
    state.pr_error = result.error;
  }
  return state;
}

function cmdLearnPolicy(args = {}) {
  const runs = collectRunMetrics(ROOT);
  const analysis = analyzeRuns(runs);
  const path = writeLearnedPolicy(ROOT, analysis);
  const result = { ok: true, path, ...analysis };
  if (args.write) {
    result.yaml_path = writeLearnedYaml(ROOT, analysis);
  }
  console.log(JSON.stringify(result, null, 2));
}

function cmdQueueAdd(args) {
  const requirement = readRequirement(args);
  if (!requirement) {
    console.error('Error: --requirement required');
    process.exit(1);
  }
  const item = enqueueRun(ROOT, {
    requirement,
    tier: args.tier || null,
    meta: {
      sdd_provider: args['sdd-provider'] || null,
      openspec_change: args['openspec-change'] || null,
      create_pr: args['create-pr'] !== false,
    },
  });
  console.log(JSON.stringify({ ok: true, item }, null, 2));
}

function cmdQueueStatus() {
  const { status } = queuePaths(ROOT);
  const pending = listPending(ROOT);
  let statusDoc = {};
  if (existsSync(status)) {
    try {
      statusDoc = JSON.parse(readFileSync(status, 'utf8'));
    } catch {
      statusDoc = {};
    }
  }
  console.log(JSON.stringify({
    ok: true,
    pending_count: pending.length,
    pending,
    status: statusDoc,
  }, null, 2));
}

async function cmdQueueProcess(args) {
  const max = Number(args.max || 1);
  const pending = listPending(ROOT);
  if (!pending.length) {
    console.log(JSON.stringify({ ok: true, processed: 0, message: 'queue empty' }, null, 2));
    return;
  }

  const results = [];
  const runner = join(__dirname, 'autopilot.mjs');
  for (const item of pending.slice(0, max)) {
    updateQueueStatus(ROOT, { current: item.id, started_at: new Date().toISOString() });
    const extra = ['run', '--requirement', item.requirement];
    if (item.tier) extra.push('--tier', item.tier);
    if (item.meta?.sdd_provider) extra.push('--sdd-provider', item.meta.sdd_provider);
    if (item.meta?.openspec_change) extra.push('--openspec-change', item.meta.openspec_change);
    if (item.meta?.create_pr !== false) extra.push('--create-pr');

    const child = spawnSync(process.execPath, [runner, ...extra], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    });

    const runId = findLatestRun(ROOT);
    if (child.status === 0) {
      const result = { run_id: runId, status: 'done' };
      markProcessed(ROOT, item.id, result);
      results.push({ id: item.id, ok: true, ...result });
    } else {
      const result = { run_id: runId, status: 'failed', exit_code: child.status };
      markProcessed(ROOT, item.id, result);
      results.push({ id: item.id, ok: false, ...result });
      console.log(JSON.stringify({ ok: false, processed: results.length, results }, null, 2));
      process.exit(child.status || 1);
    }
  }
  console.log(JSON.stringify({ ok: true, processed: results.length, results }, null, 2));
}

function cmdScopeGenerate(args) {
  const runId = args.run || findLatestRun(ROOT);
  if (!runId) {
    console.error('No runs found — init a run first');
    process.exit(1);
  }
  const state = loadState(ROOT, runId);
  const scope = generateMonorepoScope(ROOT, state, { sprint: Number(args.sprint || 1) });
  state.artifacts.scope = scope.path;
  saveState(ROOT, state);
  console.log(JSON.stringify({ ok: true, ...scope }, null, 2));
}

function cmdCreatePr(args) {
  const config = getConfig();
  const runId = args.run || findLatestRun(ROOT);
  const state = loadState(ROOT, runId);
  const updated = tryAutoCreatePr(state, config);
  saveState(ROOT, updated);
  console.log(JSON.stringify({
    ok: !!updated.pr_url,
    pr_url: updated.pr_url,
    error: updated.pr_error,
  }, null, 2));
  process.exit(updated.pr_url ? 0 : 1);
}

async function launchPhaseAsync(state, config, args) {
  const hasAgent = process.env.CURSOR_AGENT_BIN || spawnSync('bash', ['-lc', 'command -v agent'], { encoding: 'utf8' }).stdout.trim();

  if (state.phase === 'EXEC' && config.parallel?.subprocess_enabled !== false) {
    const batch = getNextParallelBatch(ROOT, state);
    if (batch?.length >= 2 && hasAgent && !args['in-process']) {
      console.log(`[parallel] Launching ${batch.length} sub-agents: ${batch.map((t) => t.id).join(', ')}`);
      const summary = await runParallelBatch(ROOT, state, batch, {
        constitutionPath: constitutionRef(ROOT, config),
        parallel_timeout_ms: config.parallel?.timeout_ms || 600000,
      });
      console.log(JSON.stringify(summary, null, 2));
      return summary.ok;
    }
  }

  if (state.phase === 'PR' && state.create_pr && !state.pr_url) {
    tryAutoCreatePr(state, config);
    saveState(ROOT, state);
    if (state.pr_url) return true;
  }

  return launchPhase(state);
}

function launchPhase(state) {
  const launcher = join(ROOT, '.harness/runner/session-launcher.sh');
  const result = spawnSync('bash', [launcher, state.phase, state.run_id, ROOT], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return result.status === 0;
}

async function cmdRun(args) {
  const config = getConfig();
  let runId = args.run;
  if (!runId) {
    const initResult = cmdInit(args);
    runId = initResult.run_id;
  }

  const maxLoops = Number(args['max-loops'] || 50);
  let loops = 0;

  while (loops < maxLoops) {
    loops += 1;
    const state = loadState(ROOT, runId);
    if (state.phase === 'DONE' || state.status === 'done') {
      finalizeRun(state, config);
      saveState(ROOT, state);
      console.log(JSON.stringify({ ok: true, run_id: runId, phase: 'DONE' }, null, 2));
      return;
    }

    const workflow = loadWorkflow(state.tier, ROOT);
    console.log(`\n=== Autopilot phase: ${state.phase} (loop ${loops}) ===\n`);

    if (!args['gate-only']) {
      const hasAgent = process.env.CURSOR_AGENT_BIN || spawnSync('bash', ['-lc', 'command -v agent'], { encoding: 'utf8' }).stdout.trim();
      if (hasAgent && !args['in-process']) {
        await launchPhaseAsync(state, config, args);
      } else {
        const prompt = renderPrompt(state, config);
        const out = join(ROOT, state.artifacts.run_dir, `prompt-${state.phase}.md`);
        writeFileSync(out, prompt, 'utf8');
        console.log(`[in-process] Phase ${state.phase} — execute prompt: ${out}`);
        if (args['in-process']) {
          console.log('\n--- PROMPT ---\n');
          console.log(prompt);
          console.log('\n--- Waiting for in-process execution; re-run with --gate after completing work ---');
          return;
        }
      }
    }

    const fresh = loadState(ROOT, runId);
    const gate = runGate(fresh.phase, fresh, ROOT, config);
    console.log(`Gate: ${gate.pass ? 'PASS' : 'FAIL'} — ${gate.message}`);

    if (!gate.pass) {
      fresh.retry_count = (fresh.retry_count || 0) + 1;
      saveState(ROOT, fresh);
      if (gate.stay && fresh.retry_count <= (config.autonomy?.max_phase_retries || 2)) {
        console.log('Staying on EXEC — more tasks pending');
        if (args['in-process']) return;
        continue;
      }
      if (fresh.retry_count > (config.autonomy?.max_phase_retries || 2)) {
        fresh.status = 'failed';
        fresh.errors.push({ phase: fresh.phase, message: gate.message });
        maybeWriteRunMetrics(fresh, config);
        saveState(ROOT, fresh);
        console.error('Max retries exceeded');
        process.exit(1);
      }
      if (args['in-process']) return;
      continue;
    }

    const next = advancePhase(fresh, workflow, gate);
    handlePostGate(fresh, { ...gate, pass: true, nextPhase: next }, config);
    fresh.phase = next;
    fresh.retry_count = 0;
    if (next === 'DONE') {
      fresh.status = 'done';
      finalizeRun(fresh, config);
      saveState(ROOT, fresh);
      console.log(JSON.stringify({ ok: true, run_id: runId, phase: 'DONE' }, null, 2));
      return;
    }
    saveState(ROOT, fresh);

    if (args['in-process']) {
      console.log(JSON.stringify({ ok: true, run_id: runId, next_phase: next }, null, 2));
      return;
    }
  }

  console.error('Max loops exceeded');
  process.exit(1);
}

function printHelp() {
  console.log(`Harness Autopilot

Commands:
  init        Create a new run (--requirement "..." [--tier S|M|L])
  status      Show run state (--run <id>)
  gate        Check gate for current phase (--run <id>)
  advance     Pass gate and move to next phase (--run <id>)
  prompt      Print/render phase prompt (--run <id>)
  sync-openspec  Sync OpenSpec change → specs/ (--change <name> --run <id>)
  resume        Resume failed/interrupted run (--run <id>)
  learn-policy  Analyze metrics and write learned-policy.json [--write]
  scope-generate  Generate monorepo scope yaml (--run <id>)
  create-pr     Create GitHub PR via gh CLI (--run <id>)
  finalize      Write autopilot-*.json metrics (--run <id>) [--done]
  queue-add     Enqueue a run (--requirement "...")
  queue-process Process pending queue items [--max N]
  queue-status  Show queue pending items and status
  run           Full loop or in-process step (--requirement "..." [--in-process])
  list          List all runs

Options:
  --run <id>            Run ID (default: latest)
  --tier S|M|L          Force tier
  --sdd-provider        speckit | openspec
  --openspec-change     OpenSpec change name
  --in-process          Single phase per invocation (IDE agent mode)
  --gate-only           Only check gate, don't launch agent
  --create-pr           Create PR at end
  --write               learn-policy: also write autopilot-learned.yaml
  --done                finalize: mark run status done
  --max N               queue-process: max items to process (default 1)
`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0] || 'help';

  const run = async () => {
    switch (cmd) {
      case 'init':
        cmdInit(args);
        break;
      case 'status':
        cmdStatus(args);
        break;
      case 'gate':
        cmdGate(args);
        break;
      case 'advance':
        cmdAdvance(args);
        break;
      case 'prompt':
        cmdPrompt(args);
        break;
      case 'sync-openspec':
        cmdSyncOpenspec(args);
        break;
      case 'resume':
        await cmdResume(args);
        break;
      case 'learn-policy':
        cmdLearnPolicy(args);
        break;
      case 'queue-add':
        cmdQueueAdd(args);
        break;
      case 'queue-process':
        await cmdQueueProcess(args);
        break;
      case 'queue-status':
        cmdQueueStatus();
        break;
      case 'scope-generate':
        cmdScopeGenerate(args);
        break;
      case 'create-pr':
        cmdCreatePr(args);
        break;
      case 'finalize':
        cmdFinalize(args);
        break;
      case 'run':
        await cmdRun(args);
        break;
      case 'list':
        console.log(JSON.stringify(listRuns(ROOT), null, 2));
        break;
      case 'help':
      default:
        printHelp();
    }
  };

  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
