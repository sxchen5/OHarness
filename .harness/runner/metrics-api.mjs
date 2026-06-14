#!/usr/bin/env node
/**
 * 轻量 Autopilot 度量 API — 直读 .harness/metrics/
 * 用法: node .harness/runner/metrics-api.mjs [--port 4177]
 */
import http from 'node:http';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const PORT = Number(process.env.HARNESS_METRICS_PORT || process.argv.find((a, i) => process.argv[i - 1] === '--port') || 4177);

function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function listAutopilotRuns() {
  const dir = join(ROOT, '.harness/metrics');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith('autopilot-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(dir, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') return json(res, 200, { ok: true });
  if (req.url === '/api/autopilot/latest') {
    const p = join(ROOT, '.harness/metrics/latest-autopilot.json');
    if (!existsSync(p)) return json(res, 200, { run: null });
    return json(res, 200, JSON.parse(readFileSync(p, 'utf8')));
  }
  if (req.url === '/api/autopilot/runs') {
    return json(res, 200, { runs: listAutopilotRuns() });
  }
  if (req.url === '/api/queue/status') {
    const p = join(ROOT, '.harness/queue/status.json');
    if (!existsSync(p)) return json(res, 200, { pending_count: 0 });
    return json(res, 200, JSON.parse(readFileSync(p, 'utf8')));
  }
  json(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[metrics-api] http://127.0.0.1:${PORT}`);
});
