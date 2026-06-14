import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from './utils.mjs';

/**
 * SDD 提供方抽象：Harness 只消费 specs/<feature>/ 下的标准产物。
 */

export function getSddProvider(config) {
  return config.sdd?.provider || 'speckit';
}

export function resolveSpecPaths(root, featureId) {
  const base = join(root, 'specs', featureId);
  return {
    featureId,
    featureDir: base,
    spec: join(base, 'spec.md'),
    plan: join(base, 'plan.md'),
    tasks: join(base, 'tasks.md'),
    dataModel: join(base, 'data-model.md'),
    contracts: join(base, 'contracts'),
  };
}

export function findOpenSpecChange(root, changeName) {
  const base = join(root, 'openspec', 'changes', changeName);
  if (!existsSync(base)) return null;
  return {
    changeDir: base,
    proposal: join(base, 'proposal.md'),
    design: join(base, 'design.md'),
    tasks: join(base, 'tasks.md'),
    deltaSpecs: join(base, 'specs'),
  };
}

function readSafe(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

/**
 * 将 OpenSpec change 同步为 Harness 可消费的 specs/<feature>/ 目录。
 */
export function syncOpenSpecToSpecs(root, changeName, featureId = null) {
  const change = findOpenSpecChange(root, changeName);
  if (!change) {
    throw new Error(`OpenSpec change not found: openspec/changes/${changeName}`);
  }

  const fid = featureId || slugify(changeName);
  const paths = resolveSpecPaths(root, fid);
  mkdirSync(paths.featureDir, { recursive: true });

  const proposal = readSafe(change.proposal);
  const design = readSafe(change.design);
  const tasks = readSafe(change.tasks);

  const specBody = buildSpecFromOpenSpec(change, proposal);
  writeFileSync(paths.spec, specBody, 'utf8');

  if (design) {
    writeFileSync(paths.plan, `# Implementation Plan\n\n${design}`, 'utf8');
  }

  if (tasks) {
    writeFileSync(paths.tasks, normalizeTasks(tasks), 'utf8');
  }

  if (existsSync(change.deltaSpecs)) {
    const deltaOut = join(paths.featureDir, 'openspec-delta');
    mkdirSync(deltaOut, { recursive: true });
    for (const f of readdirSync(change.deltaSpecs)) {
      const src = join(change.deltaSpecs, f);
      cpSync(src, join(deltaOut, f), { recursive: true });
    }
  }

  const manifest = {
    provider: 'openspec',
    change_name: changeName,
    feature_id: fid,
    synced_at: new Date().toISOString(),
    sources: {
      proposal: change.proposal,
      design: change.design,
      tasks: change.tasks,
    },
  };
  writeFileSync(join(paths.featureDir, 'sdd-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  return { featureId: fid, paths, manifest };
}

function buildSpecFromOpenSpec(change, proposal) {
  const deltas = [];
  if (existsSync(change.deltaSpecs)) {
    for (const f of readdirSync(change.deltaSpecs)) {
      if (f.endsWith('.md')) deltas.push(readSafe(join(change.deltaSpecs, f)));
    }
  }

  const usBlocks = [];
  let usIndex = 1;
  for (const delta of deltas) {
    const scenarios = extractScenarios(delta);
    if (scenarios.length) {
      usBlocks.push(`### User Story ${usIndex} - ${extractTitle(delta) || `Requirement ${usIndex}`} (Priority: P${usIndex})\n\n${scenarios.join('\n\n')}`);
      usIndex += 1;
    }
  }

  if (!usBlocks.length) {
    usBlocks.push(`### User Story 1 - ${extractTitle(proposal) || 'Feature'} (Priority: P1)\n\n${extractScenarios(proposal).join('\n\n') || '1. **Given** context, **When** action, **Then** outcome.'}`);
  }

  return `# Feature Specification: ${extractTitle(proposal) || 'OpenSpec Change'}

${proposal ? `## Overview\n\n${proposal.split('\n').slice(0, 12).join('\n')}\n` : ''}

${usBlocks.join('\n\n')}

## Clarifications

- Synced from OpenSpec change; assumptions preserved from proposal/delta specs.
`;
}

function extractTitle(md) {
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : null;
}

function extractScenarios(md) {
  const scenarios = [];
  const lines = md.split('\n');
  let i = 0;
  let n = 1;
  while (i < lines.length) {
    const line = lines[i];
    if (/scenario|场景|when|WHEN/i.test(line) || /^\s*-\s+/.test(line)) {
      const chunk = [];
      while (i < lines.length && (lines[i].trim() || chunk.length === 0)) {
        if (!lines[i].trim()) {
          i += 1;
          break;
        }
        chunk.push(lines[i]);
        i += 1;
      }
      const text = chunk.join(' ').trim();
      if (text.length > 10) {
        if (/given|when|then/i.test(text)) {
          scenarios.push(`${n}. ${text.startsWith('**') ? text : `**Scenario**: ${text}`}`);
        } else {
          scenarios.push(`${n}. **Given** setup, **When** ${text}, **Then** expected outcome.`);
        }
        n += 1;
      }
      continue;
    }
    i += 1;
  }
  return scenarios.slice(0, 5);
}

function normalizeTasks(tasks) {
  if (/- \[[ x]\] T\d+/.test(tasks)) return tasks;
  const lines = tasks.split('\n');
  let id = 1;
  return lines
    .map((line) => {
      const m = line.match(/^- \[[ x]\]\s*(.+)/);
      if (m) {
        const t = `- [ ] T${String(id).padStart(3, '0')} ${m[1]}`;
        id += 1;
        return t;
      }
      return line;
    })
    .join('\n');
}
