import { existsSync, readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const QUEUE_DIR = '.harness/queue';
const PENDING_FILE = 'pending.jsonl';
const STATUS_FILE = 'status.json';

export function queuePaths(root) {
  const dir = join(root, QUEUE_DIR);
  return {
    dir,
    pending: join(dir, PENDING_FILE),
    status: join(dir, STATUS_FILE),
  };
}

export function enqueueRun(root, { requirement, tier, meta = {} }) {
  const { dir, pending, status } = queuePaths(root);
  mkdirSync(dir, { recursive: true });
  const item = {
    id: randomUUID(),
    requirement,
    tier: tier || null,
    meta,
    enqueued_at: new Date().toISOString(),
    status: 'pending',
  };
  appendFileSync(pending, `${JSON.stringify(item)}\n`, 'utf8');
  updateQueueStatus(root, { last_enqueued: item.id, pending_count: countPending(root) });
  return item;
}

export function listPending(root) {
  const { pending } = queuePaths(root);
  if (!existsSync(pending)) return [];
  return readFileSync(pending, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter((item) => item.status === 'pending');
}

function countPending(root) {
  return listPending(root).length;
}

export function markProcessed(root, id, result = {}) {
  const { pending } = queuePaths(root);
  if (!existsSync(pending)) return;
  const lines = readFileSync(pending, 'utf8').split('\n').filter(Boolean);
  const updated = lines.map((line) => {
    const item = JSON.parse(line);
    if (item.id === id) {
      return JSON.stringify({ ...item, status: 'done', finished_at: new Date().toISOString(), result });
    }
    return line;
  });
  writeFileSync(pending, `${updated.join('\n')}\n`, 'utf8');
  updateQueueStatus(root, {
    last_processed: id,
    pending_count: countPending(root),
    last_result: result,
  });
}

export function updateQueueStatus(root, patch) {
  const { status } = queuePaths(root);
  mkdirSync(join(root, QUEUE_DIR), { recursive: true });
  let current = {};
  if (existsSync(status)) {
    try {
      current = JSON.parse(readFileSync(status, 'utf8'));
    } catch {
      current = {};
    }
  }
  writeFileSync(status, JSON.stringify({ ...current, ...patch, updated_at: new Date().toISOString() }, null, 2), 'utf8');
}
