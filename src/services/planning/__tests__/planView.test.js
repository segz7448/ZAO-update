import { groupPlans, filterPlans, pickAutoOpen, stepProgress, summaryProgress, stepDuration, formatDuration, formatAgo, milestoneStates, stepTree, dockState, stepHistory, summaryStatus, rollupStatus, completionSummary, isPlanStalled, displayGoal } from '../planView';

const P = (id, status, extra = {}) => ({ id, goal: `Goal ${id}`, status, level: 'execution', updated_at: 1000, last_activity_at: 1000, ...extra });

describe('status roll-up', () => {
  it('matches planStore.aggregateStatus priority', () => {
    expect(rollupStatus(['completed', 'running'])).toBe('running');
    expect(rollupStatus(['running', 'failed'])).toBe('failed');
    expect(rollupStatus(['completed', 'completed'])).toBe('completed');
    expect(rollupStatus([], 'planning')).toBe('planning');
  });
  it('uses leaf statuses for a decomposed root', () => {
    expect(summaryStatus({ status: 'planning', level: 'strategic', leaf_statuses: ['awaiting_approval'] })).toBe('awaiting_approval');
  });
});

describe('groupPlans', () => {
  it('splits into Needs you / Active / Recent, newest first, drops empty', () => {
    const g = groupPlans([P('a', 'completed', { last_activity_at: 5 }), P('b', 'running', { last_activity_at: 9 }), P('c', 'awaiting_approval'), P('d', 'running', { awaiting_steps: 1 }), P('e', 'failed', { last_activity_at: 7 })]);
    expect(g.map((x) => x.key)).toEqual(['needs', 'active', 'recent']);
    expect(g[0].data.map((p) => p.id).sort()).toEqual(['c', 'd']);
    expect(g[1].data.map((p) => p.id)).toEqual(['b']);
    expect(g[2].data.map((p) => p.id)).toEqual(['e', 'a']);
    expect(groupPlans([])).toEqual([]);
  });
});

describe('filterPlans', () => {
  const plans = [P('a', 'completed', { goal: 'Ship the README' }), P('b', 'running', { current_step: 'Editing readme.md' }), P('c', 'failed'), P('d', 'paused'), P('e', 'cancelled')];
  it('chips', () => {
    expect(filterPlans(plans, { filter: 'running' }).map((p) => p.id)).toEqual(['b']);
    expect(filterPlans(plans, { filter: 'needs' }).map((p) => p.id)).toEqual(['d']);
    expect(filterPlans(plans, { filter: 'done' }).map((p) => p.id)).toEqual(['a']);
    expect(filterPlans(plans, { filter: 'failed' }).map((p) => p.id)).toEqual(['c', 'e']);
    expect(filterPlans(plans).length).toBe(5);
  });
  it('search hits goal and current step, case-insensitive', () => {
    expect(filterPlans(plans, { query: 'readme' }).map((p) => p.id)).toEqual(['a', 'b']);
    expect(filterPlans(plans, { query: 'readme', filter: 'done' }).map((p) => p.id)).toEqual(['a']);
  });
});

it('pickAutoOpen picks the newest running plan not waiting on you', () => {
  expect(pickAutoOpen([P('a', 'running', { last_activity_at: 1 }), P('b', 'running', { last_activity_at: 3, awaiting_steps: 1 }), P('c', 'running', { last_activity_at: 2 })]).id).toBe('c');
  expect(pickAutoOpen([P('a', 'completed')])).toBeNull();
});

describe('progress + time', () => {
  it('stepProgress counts done + skipped', () => {
    expect(stepProgress([{ status: 'done' }, { status: 'skipped' }, { status: 'pending' }, { status: 'failed' }])).toEqual({ done: 2, total: 4, fraction: 0.5 });
    expect(stepProgress([]).fraction).toBe(0);
    expect(summaryProgress({ total_steps: 4, done_steps: 1 }).fraction).toBe(0.25);
  });
  it('stepDuration only from real timestamps', () => {
    expect(stepDuration({ started_at: 1000, completed_at: 4000 })).toBe(3000);
    expect(stepDuration({ started_at: 1000, status: 'running' }, 2500)).toBe(1500);
    expect(stepDuration({ status: 'done', completed_at: 5 })).toBeNull();
    expect(stepDuration({ started_at: 1000, status: 'failed' })).toBeNull();
  });
  it('formats', () => {
    expect(formatDuration(4200)).toBe('4s');
    expect(formatDuration(125000)).toBe('2m 5s');
    expect(formatDuration(3720000)).toBe('1h 2m');
    expect(formatDuration(1747 * 3600 * 1000)).toBe('2mo');
    expect(formatDuration(50 * 3600 * 1000)).toBe('2d 2h');
    expect(formatDuration(null)).toBeNull();
    expect(formatAgo(1000, 11000)).toBe('just now');
    expect(formatAgo(0, 1)).toBe('');
    expect(formatAgo(1, 1 + 5 * 60000)).toBe('5m ago');
  });
});

it('milestoneStates: done / current / future / missed', () => {
  const ms = milestoneStates([{ id: 'm1', status: 'reached' }, { id: 'm2', status: 'in_progress' }, { id: 'm3', status: 'pending' }, { id: 'm4', status: 'missed' }], [{ milestone_id: 'm2', status: 'done' }, { milestone_id: 'm2', status: 'running' }]);
  expect(ms.map((m) => m.state)).toEqual(['done', 'current', 'future', 'missed']);
  expect(ms[1]).toMatchObject({ stepCount: 2, doneCount: 1 });
});

it('stepTree nests sub-tasks and filters by milestone', () => {
  const steps = [{ id: 'a', milestone_id: 'm1' }, { id: 'b', subtask_of_step_id: 'a', milestone_id: 'm1' }, { id: 'c', milestone_id: 'm2' }];
  expect(stepTree(steps).map((n) => [n.step.id, n.children.map((c) => c.id)])).toEqual([['a', ['b']], ['c', []]]);
  expect(stepTree(steps, 'm2').map((n) => n.step.id)).toEqual(['c']);
  // a sub-task whose parent is filtered out shows at top level
  expect(stepTree([{ id: 'b', subtask_of_step_id: 'x' }]).length).toBe(1);
});

describe('dockState', () => {
  const st = (status) => ({ id: status, status });
  it('start / approval / checkpoint / running / terminal', () => {
    expect(dockState({ status: 'awaiting_approval', steps: [st('pending')] }).kind).toBe('start');
    expect(dockState({ status: 'awaiting_approval', steps: [st('done'), st('awaiting_approval')] })).toMatchObject({ kind: 'approval', step: { id: 'awaiting_approval' } });
    expect(dockState({ status: 'paused', checkpoint_pending: true, steps: [st('done')] }).kind).toBe('checkpoint');
    expect(dockState({ status: 'running', steps: [st('done'), st('running')] })).toMatchObject({ kind: 'running', step: { id: 'running' } });
    expect(dockState({ status: 'completed', steps: [] }).kind).toBe('terminal');
    expect(dockState(null).kind).toBe('none');
  });
});

it('stepHistory uses only real timestamps and skips reasoning entries', () => {
  const h = stepHistory({ started_at: 1, completed_at: 9, status: 'done', retry_count: 0, actions: [{ entry_type: 'reasoning', created_at: 2 }, { entry_type: 'tool_call', tool_name: 'fs_write', status: 'done', completed_at: 5 }] });
  expect(h.map((x) => x.label)).toEqual(['Started', 'fs_write done', 'Done']);
  expect(stepHistory({ status: 'pending' })).toEqual([]);
});

it('completionSummary', () => {
  expect(completionSummary({ status: 'completed', created_at: 1000, completed_at: 66000, steps: [{ status: 'done', actions: [{ entry_type: 'tool_call' }, { entry_type: 'reasoning' }] }, { status: 'skipped' }] })).toEqual({ done: 1, skipped: 1, total: 2, calls: 1, elapsed: '1m 5s' });
});

describe('isPlanStalled', () => {
  it('flags planning with no activity for >30m', () => {
    const now = 1_000_000_000_000;
    expect(isPlanStalled({ status: 'planning', last_activity_at: now - 31 * 60 * 1000 }, now)).toBe(true);
    expect(isPlanStalled({ status: 'planning', last_activity_at: now - 5 * 60 * 1000 }, now)).toBe(false);
    expect(isPlanStalled({ status: 'completed', last_activity_at: now - 60 * 60 * 1000 }, now)).toBe(false);
  });
});

describe('displayGoal', () => {
  it('strips SYSTEM contamination from goals', () => {
    expect(displayGoal({ goal: '[SYSTEM - ALWAYS TRUE]: The real current date and time, just checked, is X. Build the app' })).toBe('Build the app');
  });
});
