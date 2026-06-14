import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const HARNESS_PATH = '.harness/constitution.md';
const SPECKIT_PATH = '.specify/memory/constitution.md';

/**
 * 解析项目宪法路径：Harness 优先，SpecKit 回退。
 */
export function resolveConstitutionPath(root, config = {}) {
  const harness = join(root, config.paths?.constitution_harness || HARNESS_PATH);
  if (existsSync(harness)) {
    const text = readFileSync(harness, 'utf8');
    if (!isPlaceholderConstitution(text)) return harness;
  }
  const speckit = join(root, config.paths?.constitution || SPECKIT_PATH);
  if (existsSync(speckit) && !isPlaceholderConstitution(readFileSync(speckit, 'utf8'))) {
    return speckit;
  }
  return harness;
}

export function readConstitution(root, config = {}) {
  const path = resolveConstitutionPath(root, config);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf8');
}

export function isPlaceholderConstitution(text) {
  return /\[PRINCIPLE_1_NAME\]|\[PROJECT_NAME\]/.test(text);
}

/**
 * 将 Harness 宪法同步到 SpecKit 路径（兼容旧 speckit 命令）。
 */
export function syncToSpeckit(root) {
  const src = join(root, HARNESS_PATH);
  const dest = join(root, SPECKIT_PATH);
  if (!existsSync(src)) return false;
  mkdirSync(join(root, '.specify/memory'), { recursive: true });
  const body = readFileSync(src, 'utf8');
  const synced = `<!-- Synced from .harness/constitution.md — edit .harness/constitution.md instead -->\n\n${body}`;
  writeFileSync(dest, synced, 'utf8');
  return true;
}

export function constitutionRef(root, config = {}) {
  const rel = resolveConstitutionPath(root, config).replace(`${root}/`, '');
  return rel;
}
