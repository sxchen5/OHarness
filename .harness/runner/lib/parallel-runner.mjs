import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

function renderTaskPrompt(root, state, task, constitutionPath) {
  const templatePath = join(root, '.harness/runner/prompts/EXEC_PARALLEL.md');
  if (!existsSync(templatePath)) return `Execute task ${task.id}: ${task.description}`;
  let text = readFileSync(templatePath, 'utf8');
  const vars = {
    RUN_ID: state.run_id,
    FEATURE_ID: state.feature_id,
    TASK_ID: task.id,
    TASK_DESC: task.description,
    CONSTITUTION_PATH: constitutionPath,
    PROGRESS_PATH: state.artifacts?.progress || '.harness/sprints/sprint-1-progress.md',
    RUN_DIR: state.artifacts?.run_dir,
  };
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{{${k}}}`, String(v ?? ''));
  }
  return text;
}

function runAgent(agent, prompt, root, timeoutMs) {
  return new Promise((resolve) => {
    const modelArgs = process.env.CURSOR_AGENT_MODEL ? ['--model', process.env.CURSOR_AGENT_MODEL] : [];
    const child = spawn(agent, ['--print', '-f', '-p', prompt, ...modelArgs], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, stdout, stderr: `${stderr}\nTIMEOUT`, exit_code: -1 });
    }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr, exit_code: code ?? 1 });
    });
  });
}

/**
 * 并行启动多个 Agent 子进程执行 [P] 任务。
 */
export async function runParallelBatch(root, state, batch, options = {}) {
  const detect = spawn('bash', ['-lc', 'command -v agent'], { encoding: 'utf8' });
  let agent = process.env.CURSOR_AGENT_BIN || '';
  await new Promise((r) => {
    let out = '';
    detect.stdout?.on('data', (d) => { out += d; });
    detect.on('close', () => {
      agent = agent || out.trim();
      r();
    });
  });

  if (!agent) {
    return { ok: false, error: 'No agent CLI for parallel EXEC', launched: 0 };
  }

  const runDir = join(root, state.artifacts.run_dir);
  mkdirSync(runDir, { recursive: true });
  const logDir = join(runDir, 'parallel-logs');
  mkdirSync(logDir, { recursive: true });

  const constitutionPath = options.constitutionPath || '.harness/constitution.md';
  const timeout = options.parallel_timeout_ms || 600000;

  const jobs = batch.map(async (task) => {
    const prompt = renderTaskPrompt(root, state, task, constitutionPath);
    const promptFile = join(logDir, `prompt-${task.id}.md`);
    writeFileSync(promptFile, prompt, 'utf8');
    const result = await runAgent(agent, prompt, root, timeout);
    writeFileSync(join(logDir, `${task.id}.log`), `${result.stdout}\n${result.stderr}`, 'utf8');
    return { task_id: task.id, ...result };
  });

  const results = await Promise.all(jobs);
  const summary = { ok: results.every((r) => r.ok), launched: results.length, results };
  writeFileSync(join(logDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  return summary;
}
