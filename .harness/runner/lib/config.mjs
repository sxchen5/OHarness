import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot } from './utils.mjs';

function expandEnv(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const def = expr.includes(':-') ? expr.split(':-') : [expr, ''];
    const key = def[0];
    return process.env[key] ?? def[1] ?? '';
  });
}

function parseSimpleYaml(text) {
  const result = { autonomy: {}, tier_detection: { default: 'M', rules: [] }, gates: {}, paths: {}, agent: {}, git: {} };
  let section = null;
  let subsection = null;
  let currentRule = null;

  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.trim().startsWith('#')) continue;

    if (/^(\w+):\s*$/.test(line) && !line.startsWith(' ')) {
      section = line.replace(':', '');
      subsection = null;
      currentRule = null;
      if (!result[section]) result[section] = {};
      continue;
    }

    if (section === 'tier_detection' && line.trim() === 'rules:') continue;

    if (section === 'tier_detection' && /^  - tier:/.test(line)) {
      currentRule = { tier: line.split(':')[1].trim(), patterns: [] };
      result.tier_detection.rules.push(currentRule);
      continue;
    }

    if (currentRule && line.includes('- "')) {
      const m = line.match(/- "(.*)"/);
      if (m) currentRule.patterns.push(m[1]);
      continue;
    }

    const kv = line.match(/^  ([\w_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    let val = rawVal.replace(/^["']|["']$/g, '');
    val = expandEnv(val);
    if (val === 'true') val = true;
    if (val === 'false') val = false;
    if (/^\d+$/.test(val)) val = Number(val);

    if (section === 'autonomy' || section === 'gates' || section === 'paths' || section === 'agent' || section === 'git') {
      if (subsection && typeof result[section][subsection] === 'object') {
        result[section][subsection][key] = val;
      } else {
        result[section][key] = val;
      }
    } else if (section === 'tier_detection') {
      result.tier_detection[key] = val;
    }
  }

  return result;
}

export function loadAutopilotConfig(root = findRepoRoot()) {
  const path = join(root, '.harness/config/autopilot.yaml');
  if (!existsSync(path)) {
    throw new Error(`Missing config: ${path}`);
  }
  let config = parseSimpleYaml(readFileSync(path, 'utf8'));
  const learnedPath = join(root, '.harness/config/autopilot-learned.yaml');
  if (existsSync(learnedPath)) {
    const overlay = parseSimpleYaml(readFileSync(learnedPath, 'utf8'));
    config = mergeConfig(config, overlay);
  }
  return config;
}

function mergeConfig(base, overlay) {
  const merged = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && merged[k] && typeof merged[k] === 'object') {
      merged[k] = mergeConfig(merged[k], v);
    } else {
      merged[k] = v;
    }
  }
  return merged;
}

export function loadWorkflow(tier, root = findRepoRoot()) {
  const path = join(root, `.harness/workflows/tier-${tier}.yaml`);
  if (!existsSync(path)) {
    throw new Error(`Missing workflow: ${path}`);
  }
  const text = readFileSync(path, 'utf8');
  const wf = { id: `tier-${tier}`, phases: [], options: {} };
  let section = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#') || !line) continue;
    if (line === 'phases:') { section = 'phases'; continue; }
    if (line === 'options:') { section = 'options'; continue; }
    if (section === 'phases' && line.startsWith('- ')) {
      wf.phases.push(line.slice(2));
    }
    if (section === 'options') {
      const m = line.match(/^([\w_]+):\s*(.*)$/);
      if (m) {
        let v = m[2];
        if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (v === 'auto') v = 'auto';
        wf.options[m[1]] = v;
      }
    }
  }
  return wf;
}
