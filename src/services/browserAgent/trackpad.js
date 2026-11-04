/**
 * ZAO - trackpad-mode gesture logic for takeover (pure; no React).
 *
 * The person drags on the live frame like a laptop trackpad and a pointer
 * moves over the page; nothing is clicked where the finger lands.
 *   1-finger drag        -> pointer moves (relative, with acceleration, clamped)
 *   tap                  -> click at the pointer
 *   double-tap           -> double-click at the pointer
 *   long-press then drag -> mouse down, move, mouse up (drag-select / sliders)
 *   2-finger drag        -> wheel scroll at the pointer (natural direction)
 * The reducer turns touch events into commands for the stream
 * (manualMouseMove / Down / Up / Click / Wheel - viewport px of the 412x915
 * page). Pointer lives in PAGE coordinates; finger deltas are view px and
 * are divided by the frame's display scale (clickTarget.frameBox).
 */
import { FRAME_W, FRAME_H, frameBox } from './clickTarget';

export const TP = {
  TAP_SLOP: 8, // view px a tap may wander
  TAP_MS: 260,
  DOUBLE_MS: 320,
  DOUBLE_SLOP: 30, // page px between the two taps' pointer positions
  LONG_MS: 450,
  MOVE_HZ: 30,
  GAIN_MIN: 1, // slow, precise
  GAIN_MAX: 3.2, // fast flicks cross the page
  V_LOW: 0.15, // view px/ms where acceleration starts
  V_HIGH: 1.6, // ... and where it tops out
};

/** Pointer acceleration: gain grows smoothly with finger speed (px/ms). */
export function accelGain(speed) {
  if (!(speed > TP.V_LOW)) return TP.GAIN_MIN;
  if (speed >= TP.V_HIGH) return TP.GAIN_MAX;
  const t = (speed - TP.V_LOW) / (TP.V_HIGH - TP.V_LOW);
  const e = t * t * (3 - 2 * t); // smoothstep
  return TP.GAIN_MIN + (TP.GAIN_MAX - TP.GAIN_MIN) * e;
}

export function clampToPage(p, w = FRAME_W, h = FRAME_H) {
  return { x: Math.min(w - 1, Math.max(0, p.x)), y: Math.min(h - 1, Math.max(0, p.y)) };
}

/** Moves the pointer by a finger delta (view px) over dt ms. `scale` = view px per page px. */
export function movePointer(p, dx, dy, dt, scale = 1) {
  const s = scale > 0 ? scale : 1;
  const speed = Math.hypot(dx, dy) / Math.max(1, dt || 16);
  const g = accelGain(speed);
  return clampToPage({ x: p.x + (dx * g) / s, y: p.y + (dy * g) / s });
}

/** Page coords -> view coords inside a view of viewW x viewH (for drawing the pointer). */
export function pageToView(p, viewW, viewH, fit = {}) {
  const b = frameBox(viewW, viewH, fit);
  if (!b || !p) return null;
  return { x: b.x + p.x * b.scale, y: b.y + p.y * b.scale };
}

export const pointerCenter = () => ({ x: Math.round(FRAME_W / 2), y: Math.round(FRAME_H / 2) });

export function initialTrackpad(pointer) {
  return { pointer: pointer ? clampToPage(pointer) : pointerCenter(), mode: 'idle', start: null, last: null, moved: 0, lastTap: null };
}

const pt = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });

/**
 * ev: { type: 'start'|'move'|'end'|'longPress'|'rebase', t, x, y, touches }
 *   x/y = touch centroid in view px; touches = active finger count.
 * ctx: { scale } view px per page px.
 * Returns { state, cmds } - cmds: {type:'move'|'down'|'up', x, y} |
 *   {type:'click', x, y, count} | {type:'wheel', dx, dy, x, y}
 */
export function trackpadReduce(state, ev, ctx = {}) {
  const scale = ctx.scale > 0 ? ctx.scale : 1;
  const s = state || initialTrackpad();
  const cmds = [];
  switch (ev.type) {
    case 'start': {
      const two = (ev.touches || 1) >= 2;
      // a second finger landing mid-gesture switches to scrolling
      if (s.mode === 'drag') cmds.push({ type: 'up', ...pt(s.pointer) });
      return { state: { ...s, mode: two ? 'scroll' : 'pending', start: { x: ev.x, y: ev.y, t: ev.t }, last: { x: ev.x, y: ev.y, t: ev.t }, moved: 0 }, cmds };
    }
    case 'rebase': // finger count changed mid-gesture: re-anchor so the centroid jump isn't a move
      return { state: s.last ? { ...s, last: { x: ev.x, y: ev.y, t: ev.t } } : s, cmds };
    case 'longPress': {
      if (s.mode !== 'pending' || s.moved > TP.TAP_SLOP) return { state: s, cmds };
      cmds.push({ type: 'down', ...pt(s.pointer) });
      return { state: { ...s, mode: 'drag' }, cmds };
    }
    case 'move': {
      if (!s.last) return { state: s, cmds };
      const dx = ev.x - s.last.x, dy = ev.y - s.last.y, dt = ev.t - s.last.t;
      const moved = s.moved + Math.hypot(dx, dy);
      let mode = s.mode;
      if ((ev.touches || 1) >= 2 && mode !== 'drag') mode = 'scroll';
      if (mode === 'scroll') {
        const wx = -dx / scale, wy = -dy / scale; // natural scrolling: content follows the fingers
        if (wx || wy) cmds.push({ type: 'wheel', dx: Math.round(wx * 10) / 10 || 0, dy: Math.round(wy * 10) / 10 || 0, ...pt(s.pointer) });
        return { state: { ...s, mode, moved, last: { x: ev.x, y: ev.y, t: ev.t } }, cmds };
      }
      if (mode === 'pending' && moved > TP.TAP_SLOP) mode = 'move';
      if (mode === 'pending') return { state: { ...s, moved, last: { x: ev.x, y: ev.y, t: ev.t } }, cmds };
      const p = movePointer(s.pointer, dx, dy, dt, mode === 'drag' ? scale * 1.4 : scale); // drags are a little finer
      cmds.push({ type: 'move', ...pt(p) });
      return { state: { ...s, mode, moved, pointer: p, last: { x: ev.x, y: ev.y, t: ev.t } }, cmds };
    }
    case 'end': {
      if ((ev.touches || 0) > 0) return { state: s, cmds }; // a finger is still down
      const base = { ...s, mode: 'idle', start: null, last: null, moved: 0 };
      if (s.mode === 'drag') { cmds.push({ type: 'up', ...pt(s.pointer) }); return { state: base, cmds }; }
      if (s.mode === 'pending' && s.start && ev.t - s.start.t <= TP.TAP_MS && s.moved <= TP.TAP_SLOP) {
        const p = pt(s.pointer);
        const dbl = s.lastTap && ev.t - s.lastTap.t <= TP.DOUBLE_MS && Math.hypot(p.x - s.lastTap.x, p.y - s.lastTap.y) <= TP.DOUBLE_SLOP;
        cmds.push({ type: 'click', ...p, count: dbl ? 2 : 1 });
        return { state: { ...base, lastTap: dbl ? null : { ...p, t: ev.t } }, cmds };
      }
      return { state: base, cmds };
    }
    default:
      return { state: s, cmds };
  }
}

/**
 * Coalesces pointer moves to ~MOVE_HZ: push() returns the move to send now
 * or null (kept as pending); flush() returns the pending one (send it before
 * a down/up/click so the press lands where the pointer is).
 */
export function createMoveThrottle(hz = TP.MOVE_HZ) {
  const gap = 1000 / hz;
  let lastSent = -Infinity, pending = null;
  return {
    push(cmd, now) {
      if (now - lastSent >= gap) { lastSent = now; pending = null; return cmd; }
      pending = cmd; return null;
    },
    flush(now) { const p = pending; pending = null; if (p) lastSent = now; return p; },
    get pending() { return pending; },
  };
}
