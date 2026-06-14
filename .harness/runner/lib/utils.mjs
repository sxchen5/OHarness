import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function findRepoRoot(start = process.cwd()) {
  let dir = start;
  for (let i = 0; i < 20; i += 1) {
    if (existsSync(join(dir, '.harness'))) return dir;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

export function readText(path) {
  return readFileSync(path, 'utf8');
}

export function readJson(path) {
  return JSON.parse(readText(path));
}

export function slugify(text) {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (base.length >= 3) return base;
  return `feature-${Date.now().toString(36)}`;
}

export function timestampId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function ensureDir(fs, dir) {
  if (!existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
