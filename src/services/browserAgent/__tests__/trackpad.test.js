import { TP, accelGain, clampToPage, movePointer, pageToView, initialTrackpad, trackpadReduce, createMoveThrottle, pointerCenter } from '../trackpad';

const run = (evs, ctx = { scale: 1 }, st = initialTrackpad({ x: 200, y: 400 })) => {
  const all = [];
  for (const e of evs) { const r = trackpadReduce(st, e, ctx); st = r.state; all.push(...r.cmds); }
  return { st, cmds: all };
};

describe('acceleration + clamp', () => {
  it('slow = 1:1, fast = capped gain, monotonic', () => {
    expect(accelGain(0)).toBe(1); expect(accelGain(0.1)).toBe(1);
    expect(accelGain(5)).toBe(TP.GAIN_MAX);
    let prev = 0; for (let v = 0; v <= 2; v += 0.1) { const g = accelGain(v); expect(g).toBeGreaterThanOrEqual(prev); prev = g; }
  });
  it('clamps to the 412x915 page', () => {
    expect(clampToPage({ x: -3, y: 2000 })).toEqual({ x: 0, y: 914 });
    expect(movePointer({ x: 400, y: 10 }, 500, -500, 10)).toEqual({ x: 411, y: 0 });
  });
  it('slow moves are 1:1 in page px after dividing by display scale', () => {
    expect(movePointer({ x: 100, y: 100 }, 10, 0, 1000, 0.5)).toEqual({ x: 120, y: 100 });
  });
  it('fast flick goes further than a slow drag of the same distance', () => {
    const slow = movePointer({ x: 100, y: 100 }, 40, 0, 400).x, fast = movePointer({ x: 100, y: 100 }, 40, 0, 10).x;
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('pageToView uses the contain/zoom fit', () => {
  it('maps centre and corners', () => {
    expect(pageToView({ x: 206, y: 457.5 }, 412, 915)).toEqual({ x: 206, y: 457.5 });
    const v = pageToView({ x: 0, y: 0 }, 412, 915, { zoom: 0.5 });
    expect(v.x).toBeCloseTo(103); expect(v.y).toBeCloseTo(228.75);
  });
  it('null when unmeasured', () => { expect(pageToView({ x: 1, y: 1 }, 0, 0)).toBeNull(); });
});

describe('gestures', () => {
  it('defaults the pointer to the page centre', () => { expect(initialTrackpad().pointer).toEqual(pointerCenter()); });
  it('tap clicks at the POINTER, not the finger', () => {
    const { cmds } = run([{ type: 'start', t: 0, x: 10, y: 10, touches: 1 }, { type: 'end', t: 100, touches: 0 }]);
    expect(cmds).toEqual([{ type: 'click', x: 200, y: 400, count: 1 }]);
  });
  it('double-tap -> second click has count 2', () => {
    const { cmds } = run([
      { type: 'start', t: 0, x: 10, y: 10, touches: 1 }, { type: 'end', t: 80, touches: 0 },
      { type: 'start', t: 200, x: 12, y: 11, touches: 1 }, { type: 'end', t: 260, touches: 0 },
    ]);
    expect(cmds.map((c) => c.count)).toEqual([1, 2]);
  });
  it('slow taps far apart in time are two single clicks', () => {
    const { cmds } = run([
      { type: 'start', t: 0, x: 10, y: 10, touches: 1 }, { type: 'end', t: 80, touches: 0 },
      { type: 'start', t: 900, x: 10, y: 10, touches: 1 }, { type: 'end', t: 980, touches: 0 },
    ]);
    expect(cmds.map((c) => c.count)).toEqual([1, 1]);
  });
  it('drag moves the pointer relatively and does not click', () => {
    const { st, cmds } = run([
      { type: 'start', t: 0, x: 100, y: 100, touches: 1 },
      { type: 'move', t: 200, x: 104, y: 100, touches: 1 }, // inside slop: nothing yet
      { type: 'move', t: 400, x: 120, y: 100, touches: 1 },
      { type: 'end', t: 450, touches: 0 },
    ]);
    expect(cmds.every((c) => c.type === 'move')).toBe(true);
    expect(st.pointer.x).toBeGreaterThan(200); expect(st.pointer.y).toBe(400);
  });
  it('long-press then drag = down, moves, up', () => {
    const { cmds } = run([
      { type: 'start', t: 0, x: 100, y: 100, touches: 1 }, { type: 'longPress', t: 450 },
      { type: 'move', t: 600, x: 130, y: 100, touches: 1 }, { type: 'end', t: 700, touches: 0 },
    ]);
    expect(cmds[0]).toEqual({ type: 'down', x: 200, y: 400 });
    expect(cmds[1].type).toBe('move'); expect(cmds[cmds.length - 1].type).toBe('up');
  });
  it('long-press after moving does nothing', () => {
    const { cmds } = run([{ type: 'start', t: 0, x: 100, y: 100, touches: 1 }, { type: 'move', t: 100, x: 130, y: 100, touches: 1 }, { type: 'longPress', t: 450 }]);
    expect(cmds.some((c) => c.type === 'down')).toBe(false);
  });
  it('two-finger drag scrolls (natural) at the pointer and never clicks', () => {
    const { cmds } = run([
      { type: 'start', t: 0, x: 100, y: 300, touches: 2 },
      { type: 'move', t: 30, x: 100, y: 250, touches: 2 },
      { type: 'end', t: 60, touches: 1 }, { type: 'end', t: 70, touches: 0 },
    ], { scale: 0.5 });
    expect(cmds).toEqual([{ type: 'wheel', dx: 0, dy: 100, x: 200, y: 400 }]);
  });
  it('second finger mid-drag releases the button first', () => {
    const { cmds } = run([{ type: 'start', t: 0, x: 1, y: 1, touches: 1 }, { type: 'longPress', t: 500 }, { type: 'start', t: 600, x: 1, y: 1, touches: 2 }]);
    expect(cmds.map((c) => c.type)).toEqual(['down', 'up']);
  });
});

describe('rebase', () => {
  it('re-anchors without moving or changing mode', () => {
    const { st, cmds } = run([{ type: 'start', t: 0, x: 0, y: 0, touches: 2 }, { type: 'rebase', t: 5, x: 300, y: 300 }, { type: 'move', t: 20, x: 300, y: 310, touches: 1 }]);
    expect(st.mode).toBe('scroll'); expect(cmds).toEqual([{ type: 'wheel', dx: 0, dy: -10, x: 200, y: 400 }]);
  });
});

describe('move throttle ~30/s', () => {
  it('sends at most one move per 33ms and flushes the latest', () => {
    const th = createMoveThrottle(30);
    expect(th.push({ x: 1 }, 0)).toEqual({ x: 1 });
    expect(th.push({ x: 2 }, 10)).toBeNull();
    expect(th.push({ x: 3 }, 20)).toBeNull();
    expect(th.flush(25)).toEqual({ x: 3 });
    expect(th.flush(26)).toBeNull();
    expect(th.push({ x: 4 }, 40)).toBeNull(); // 15ms after the flush
    expect(th.push({ x: 5 }, 60)).toEqual({ x: 5 });
  });
});
