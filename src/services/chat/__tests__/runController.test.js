import {
  initialRunState,
  startRun,
  requestStop,
  isRunCancelled,
  enqueueSteer,
  drainSteers,
  endRun,
  coalesceSteerText,
} from '../runController';

describe('runController', () => {
  test('start → stop scoped to that run', () => {
    let s = startRun(initialRunState(), 'run-a');
    s = requestStop(s);
    expect(isRunCancelled(s, 'run-a')).toBe(true);
    expect(isRunCancelled(s, 'run-b')).toBe(false);
  });

  test('stop is no-op when idle', () => {
    const s = requestStop(initialRunState());
    expect(s.cancelRunId).toBeNull();
    expect(s.activeRunId).toBeNull();
  });

  test('five rapid mid-run steers enqueue then drain coalesced', () => {
    let s = startRun(initialRunState(), 'run-1');
    for (let i = 1; i <= 5; i += 1) {
      const r = enqueueSteer(s, { id: `m${i}`, text: `msg ${i}` });
      expect(r.accepted).toBe(true);
      s = r.state;
    }
    expect(s.pendingSteers).toHaveLength(5);
    const drained = drainSteers(s);
    expect(drained.steers).toHaveLength(5);
    expect(coalesceSteerText(drained.steers)).toBe('msg 1\nmsg 2\nmsg 3\nmsg 4\nmsg 5');
    expect(drained.state.pendingSteers).toHaveLength(0);
  });

  test('enqueue rejected when no active run', () => {
    const r = enqueueSteer(initialRunState(), { id: 'x', text: 'hi' });
    expect(r.accepted).toBe(false);
  });

  test('endRun clears cancel + steers; stale end ignored', () => {
    let s = startRun(initialRunState(), 'run-a');
    s = enqueueSteer(s, { id: '1', text: 'later' }).state;
    s = requestStop(s);
    s = endRun(s, 'run-a');
    expect(s.activeRunId).toBeNull();
    expect(s.cancelRunId).toBeNull();
    expect(s.pendingSteers).toHaveLength(0);

    s = startRun(s, 'run-b');
    const stale = endRun(s, 'run-a');
    expect(stale.activeRunId).toBe('run-b');
  });

  test('resume after stop: new run is not cancelled', () => {
    let s = startRun(initialRunState(), 'run-1');
    s = requestStop(s);
    s = endRun(s, 'run-1');
    s = startRun(s, 'run-2');
    expect(isRunCancelled(s, 'run-2')).toBe(false);
    expect(s.activeRunId).toBe('run-2');
  });
});
