import { sanitizePlanText } from '../../utils/sanitizePlanText';
/**
 * ZAO - pure view logic for the Plans home + plan detail (no React, no DB).
 * Everything here works on real rows from database.js (getPlanSummaries /
 * getPlan + planStore's buildDisplayPlan); nothing is invented - a value
 * that isn't in the data (e.g. a step duration without timestamps) comes
 * back null so the UI can omit it.
 */

export const TERMINAL = ['completed', 'failed', 'cancelled'];
const ORDER = ['failed', 'awaiting_approval', 'recovering', 'running', 'paused'];

/** Same roll-up as planStore.aggregateStatus, on plain status strings. */
export function rollupStatus(statuses, fallback) {
  if (!statuses || statuses.length === 0) return fallback;
  for (const s of ORDER) if (statuses.includes(s)) return s;
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.includes('cancelled')) return 'cancelled';
  return 'planning';
}

/** Effective status of a getPlanSummaries row. */
export function summaryStatus(p) {
  return p.level === 'execution' || !p.leaf_statuses?.length ? p.status : rollupStatus(p.leaf_statuses, p.status);
}

/** Needs a human: awaiting approval (risky step OR not started yet) or paused (checkpoint). */
export function needsYou(p) {
  const s = summaryStatus(p);
  return s === 'awaiting_approval' || s === 'paused' || (p.awaiting_steps || 0) > 0;
}

/** Active / Needs you / Recent sections, each newest activity first. Empty sections dropped. */
export function groupPlans(plans) {
  const sorted = [...(plans || [])].sort((a, b) => (b.last_activity_at || b.updated_at || 0) - (a.last_activity_at || a.updated_at || 0));
  const needs = []; const active = []; const recent = [];
  for (const p of sorted) {
    const s = summaryStatus(p);
    if (needsYou(p)) needs.push(p);
    else if (!TERMINAL.includes(s)) active.push(p);
    else recent.push(p);
  }
  return [
    { key: 'needs', title: 'Needs you', data: needs },
    { key: 'active', title: 'Active', data: active },
    { key: 'recent', title: 'Recent', data: recent },
  ].filter((g) => g.data.length > 0);
}

export const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'needs', label: 'Needs you' },
  { key: 'done', label: 'Done' },
  { key: 'failed', label: 'Failed' },
];

export function matchesFilter(p, filter) {
  const s = summaryStatus(p);
  switch (filter) {
    case 'running': return !needsYou(p) && (s === 'running' || s === 'recovering' || s === 'planning');
    case 'needs': return needsYou(p);
    case 'done': return s === 'completed';
    case 'failed': return s === 'failed' || s === 'cancelled';
    default: return true;
  }
}

/** Case-insensitive search over goal + current step, then the chip filter. */
export function filterPlans(plans, { query = '', filter = 'all' } = {}) {
  const q = query.trim().toLowerCase();
  return (plans || []).filter((p) => matchesFilter(p, filter)
    && (!q || `${p.goal || ''} ${p.current_step || ''}`.toLowerCase().includes(q)));
}

/** First plan the person should land in when the tab opens (running, not waiting on them). */
export function pickAutoOpen(plans) {
  const r = (plans || []).filter((p) => ['running', 'recovering'].includes(summaryStatus(p)) && !needsYou(p));
  r.sort((a, b) => (b.last_activity_at || 0) - (a.last_activity_at || 0));
  return r[0] || null;
}

/** {done, total, fraction} from steps (skipped counts as resolved). */
export function stepProgress(steps) {
  const total = (steps || []).length;
  const done = (steps || []).filter((s) => s.status === 'done' || s.status === 'skipped').length;
  return { done, total, fraction: total ? done / total : 0 };
}
export function summaryProgress(p) {
  const total = p.total_steps || 0; const done = p.done_steps || 0;
  return { done, total, fraction: total ? done / total : 0 };
}

/** ms a step took (or has been running, given now); null when the data has no start time. */
export function stepDuration(step, now = Date.now()) {
  if (!step || !step.started_at) return null;
  const end = step.completed_at || (step.status === 'running' ? now : null);
  return end && end >= step.started_at ? end - step.started_at : null;
}

/** Plan elapsed: created -> completed_at (terminal) or now. */
export function planElapsed(plan, now = Date.now()) {
  if (!plan?.created_at) return null;
  const end = TERMINAL.includes(plan.status) ? (plan.completed_at || plan.updated_at) : now;
  return end >= plan.created_at ? end - plan.created_at : null;
}

export function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return null;
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60); const r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ${h % 24}h`;
  if (d < 60) return `${d}d`;
  const mo = Math.floor(d / 30);
  if (mo < 24) return `${mo}mo`;
  return `${Math.floor(mo / 12)}y`;
}

/** Planning/running with no progress for >30 minutes → treat as stalled in UI. */
export const STALL_MS = 30 * 60 * 1000;
export function isPlanStalled(plan, now = Date.now()) {
  if (!plan) return false;
  const status = plan.status || plan.rollup_status;
  if (!['planning', 'running', 'recovering'].includes(status)) return false;
  const anchor = plan.last_activity_at || plan.updated_at || plan.started_at || plan.created_at;
  if (!anchor) return false;
  return (now - anchor) > STALL_MS;
}

export function formatAgo(ts, now = Date.now()) {
  if (!ts) return '';
  const d = Math.max(0, now - ts) / 1000;
  if (d < 45) return 'just now';
  if (d < 3600) return `${Math.round(d / 60)}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  if (d < 86400 * 7) return `${Math.round(d / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Milestones with UI state: done | current | future | missed, plus their step counts. */
export function milestoneStates(milestones, steps) {
  let currentSet = false;
  return (milestones || []).map((m) => {
    const own = (steps || []).filter((s) => s.milestone_id === m.id);
    const done = own.filter((s) => s.status === 'done' || s.status === 'skipped').length;
    let state;
    if (m.status === 'reached') state = 'done';
    else if (m.status === 'missed') state = 'missed';
    else if (!currentSet) { state = 'current'; currentSet = true; }
    else state = 'future';
    return { ...m, state, stepCount: own.length, doneCount: done };
  });
}

/** Steps as a parent -> sub-task tree (subtask_of_step_id), order kept; optional milestone filter. */
export function stepTree(steps, milestoneId = null) {
  const list = (steps || []).filter((s) => !milestoneId || s.milestone_id === milestoneId);
  const ids = new Set(list.map((s) => s.id));
  const kids = new Map();
  for (const s of list) if (s.subtask_of_step_id && ids.has(s.subtask_of_step_id)) {
    if (!kids.has(s.subtask_of_step_id)) kids.set(s.subtask_of_step_id, []);
    kids.get(s.subtask_of_step_id).push(s);
  }
  return list.filter((s) => !s.subtask_of_step_id || !ids.has(s.subtask_of_step_id)).map((s) => ({ step: s, children: kids.get(s.id) || [] }));
}

/**
 * Which bottom dock to show. Mirrors the old PlanScreen conditions exactly:
 * start (awaiting_approval and nothing run yet) > approval (a step awaiting) >
 * checkpoint > running > done (terminal) > none.
 */
export function dockState(plan) {
  if (!plan) return { kind: 'none' };
  const steps = plan.steps || [];
  const awaitingStep = steps.find((s) => s.status === 'awaiting_approval') || null;
  if (plan.status === 'awaiting_approval' && !awaitingStep && steps.length > 0 && steps.every((s) => s.status === 'pending')) return { kind: 'start' };
  if (awaitingStep) return { kind: 'approval', step: awaitingStep };
  if (plan.checkpoint_pending) return { kind: 'checkpoint' };
  if (['running', 'recovering', 'planning'].includes(plan.status)) {
    return { kind: 'running', step: steps.find((s) => s.status === 'running') || null };
  }
  if (TERMINAL.includes(plan.status)) return { kind: 'terminal', status: plan.status };
  return { kind: 'none' };
}

/** Status history from real timestamps only: started, each tool call, finished. */
export function stepHistory(step) {
  if (!step) return [];
  const h = [];
  if (step.started_at) h.push({ at: step.started_at, label: 'Started', status: 'running' });
  for (const a of step.actions || []) {
    if (a.entry_type === 'reasoning') continue;
    const at = a.completed_at || a.started_at || a.created_at;
    if (at) h.push({ at, label: `${a.label || a.tool_name || 'Tool call'} ${a.status === 'failed' ? 'failed' : a.status === 'running' ? 'running' : 'done'}`, status: a.status });
  }
  if (step.retry_count > 0) h.push({ at: null, label: `Retried ${step.retry_count}×`, status: 'running' });
  if (step.completed_at) h.push({ at: step.completed_at, label: step.status === 'failed' ? 'Failed' : step.status === 'skipped' ? 'Skipped' : 'Done', status: step.status });
  return h;
}

/** Outcome summary for the completion moment. */
export function completionSummary(plan, now = Date.now()) {
  const steps = plan?.steps || [];
  return {
    done: steps.filter((s) => s.status === 'done').length,
    skipped: steps.filter((s) => s.status === 'skipped').length,
    total: steps.length,
    calls: steps.reduce((n, s) => n + (s.actions || []).filter((a) => a.entry_type !== 'reasoning').length, 0),
    elapsed: formatDuration(planElapsed(plan, now)),
  };
}

/** Display goal with SYSTEM stamp stripped. */
export function displayGoal(planOrGoal) {
  const g = typeof planOrGoal === 'string' ? planOrGoal : planOrGoal?.goal;
  return sanitizePlanText(g || '') || 'Untitled plan';
}
