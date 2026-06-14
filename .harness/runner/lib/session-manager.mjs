import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 会话分段：每 phase 切换、EXEC 每批次完成后递增 session_id，强制新 Agent 上下文。
 */
export function initSession(state) {
  if (state.session_id == null) {
    state.session_id = 1;
    state.exec_batch_index = 0;
    state.sessions = [];
  }
  return state;
}

export function recordSession(state, meta) {
  initSession(state);
  state.sessions.push({
    session_id: state.session_id,
    phase: state.phase,
    exec_batch_index: state.exec_batch_index,
    at: new Date().toISOString(),
    ...meta,
  });
  return state;
}

export function nextSession(state, reason) {
  initSession(state);
  recordSession(state, { event: 'session_end', reason });
  state.session_id += 1;
  recordSession(state, { event: 'session_start', reason });
  return state;
}

export function onExecBatchComplete(state) {
  initSession(state);
  state.exec_batch_index = (state.exec_batch_index || 0) + 1;
  return nextSession(state, `exec_batch_${state.exec_batch_index}_complete`);
}

export function shouldForceNewSession(state, phase, gateResult) {
  if (phase === 'EXEC' && gateResult?.stay) {
    return true;
  }
  return false;
}

export function writeSessionLog(root, state) {
  const logPath = join(root, state.artifacts.run_dir, 'sessions.log');
  const lines = (state.sessions || []).map(
    (s) => `[${s.at}] session=${s.session_id} phase=${s.phase} event=${s.event || '-'} ${s.reason || ''}`.trim(),
  );
  writeFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');
}

export function renderSessionHeader(state) {
  return `## 会话上下文（Batch 分段）

- Session ID: ${state.session_id ?? 1}
- Phase: ${state.phase}
- EXEC Batch: ${state.exec_batch_index ?? 0}
- 原则: 只读磁盘文件（progress/spec/代码），不依赖历史对话
`;
}
