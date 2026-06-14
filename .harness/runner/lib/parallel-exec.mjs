import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 从 tasks.md / progress 解析可并行 [P] 任务。
 */
export function parseParallelTasks(tasksContent) {
  const tasks = [];
  for (const line of tasksContent.split('\n')) {
    const m = line.match(/^- \[[ x]\] (T\d+)\s+\[P\](?:\s+\[US\d+\])?\s+(.+)/);
    if (m) {
      tasks.push({ id: m[1], description: m[2].trim(), parallel: true });
    }
  }
  return tasks;
}

export function groupParallelBatch(tasks, maxParallel = 4) {
  const parallel = tasks.filter((t) => t.parallel);
  if (parallel.length < 2) return [];
  const batches = [];
  for (let i = 0; i < parallel.length; i += maxParallel) {
    batches.push(parallel.slice(i, i + maxParallel));
  }
  return batches;
}

export function getNextParallelBatch(root, state) {
  const tasksPath = join(root, 'specs', state.feature_id, 'tasks.md');
  if (!existsSync(tasksPath)) return null;
  const content = readFileSync(tasksPath, 'utf8');
  const all = parseParallelTasks(content);
  const progressPath = state.artifacts?.progress;
  if (!progressPath) return groupParallelBatch(all)[0] || null;

  const progress = existsSync(join(root, progressPath))
    ? readFileSync(join(root, progressPath), 'utf8')
    : '';
  const pending = all.filter((t) => {
    const re = new RegExp(`- \\[ \\] ${t.id}`);
    return re.test(progress) || !progress.includes(t.id);
  });
  const batch = groupParallelBatch(pending)[0];
  return batch?.length >= 2 ? batch : null;
}

export function formatParallelPrompt(batch) {
  if (!batch?.length) return '';
  const lines = batch.map((t) => `- ${t.id}: ${t.description}`);
  return `## 本批次并行任务（[P] 标记，可用 sub-agent 同时执行）\n\n${lines.join('\n')}\n\n完成后分别更新 progress 并跑一次 verify-l1。`;
}
