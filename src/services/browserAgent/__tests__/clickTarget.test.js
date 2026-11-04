import { sanitizeTarget, frameBox, mapTargetToView, ringSize, isRingAction, FRAME_W, FRAME_H } from '../clickTarget';
import { reduceCard, initialCard } from '../browserCardState';

const T = { x: 40, y: 600, w: 160, h: 50, vw: 412, vh: 915 };
const close = (a, b) => expect(Math.abs(a - b)).toBeLessThan(0.01);

describe('sanitizeTarget', () => {
  it('accepts a valid target and defaults the viewport', () => {
    expect(sanitizeTarget(T)).toEqual(T);
    expect(sanitizeTarget({ x: 1, y: 2, w: 3, h: 4 })).toEqual({ x: 1, y: 2, w: 3, h: 4, vw: FRAME_W, vh: FRAME_H });
  });
  it('rejects missing / malformed / off-screen', () => {
    for (const bad of [undefined, null, 'x', {}, { ...T, w: 0 }, { ...T, x: 'a' }, { ...T, y: 2000 }, { ...T, x: -500 }]) expect(sanitizeTarget(bad)).toBeNull();
  });
});

describe('frameBox', () => {
  it('contain in an exactly-shaped view is identity scale', () => {
    expect(frameBox(412, 915)).toEqual({ x: 0, y: 0, width: 412, height: 915, scale: 1 });
  });
  it('contain letterboxes horizontally in a wide view', () => {
    const b = frameBox(800, 915);
    expect(b.width).toBe(412); close(b.x, 194); expect(b.y).toBe(0);
  });
  it('contain + zoom shrinks about the centre', () => {
    const b = frameBox(412, 915, { zoom: 0.5 });
    expect(b.width).toBe(206); close(b.x, 103); close(b.y, 228.75);
  });
  it('cover/top fills width and crops the bottom (the card)', () => {
    const b = frameBox(343, 343 * 11 / 16, { mode: 'cover', align: 'top' });
    close(b.width, 343); close(b.height, 343 * 915 / 412); expect(b.x).toBeCloseTo(0); expect(b.y).toBe(0);
  });
  it('null for an unmeasured view', () => { expect(frameBox(0, 100)).toBeNull(); });
});

describe('mapTargetToView', () => {
  it('fullscreen sheet (contain, letterboxed) scales and offsets', () => {
    // sheet 372 x 700: contain scale = min(372/412, 700/915) = 0.765
    const s = Math.min(372 / 412, 700 / 915); const ox = (372 - 412 * s) / 2;
    const r = mapTargetToView(T, 372, 700);
    close(r.x, ox + 40 * s); close(r.y, 600 * s); close(r.w, 160 * s); close(r.h, 50 * s);
    close(r.cx, ox + 120 * s); close(r.cy, 625 * s);
  });
  it('honours zoom', () => {
    const r = mapTargetToView(T, 412, 915, { zoom: 0.5 });
    close(r.x, 103 + 20); close(r.y, 228.75 + 300); close(r.w, 80);
  });
  it('card (cover/top) maps visible targets and drops cropped-out ones', () => {
    const vw = 343, vh = vw * 11 / 16, k = vw / 412;
    const top = mapTargetToView({ ...T, y: 100 }, vw, vh, { mode: 'cover', align: 'top' });
    close(top.x, 40 * k); close(top.y, 100 * k); close(top.w, 160 * k);
    expect(mapTargetToView(T, vw, vh, { mode: 'cover', align: 'top' })).toBeNull(); // y=600 is below the 16:11 crop
  });
  it('clips a partly visible target to the view', () => {
    const r = mapTargetToView({ ...T, y: 900, h: 50 }, 412, 915);
    close(r.y, 900); close(r.h, 15);
  });
  it('rescales when the target viewport differs from the frame size', () => {
    const r = mapTargetToView({ x: 82.4, y: 0, w: 82.4, h: 10, vw: 824, vh: 1830 }, 412, 915);
    close(r.x, 41.2); close(r.w, 41.2); close(r.h, 5);
  });
  it('null for missing target (old servers)', () => { expect(mapTargetToView(undefined, 412, 915)).toBeNull(); });
});

describe('ring helpers', () => {
  it('ringSize clamps', () => {
    expect(ringSize(null)).toBe(36);
    expect(ringSize({ w: 10, h: 10 })).toBe(36);
    expect(ringSize({ w: 300, h: 300 })).toBe(88);
    expect(ringSize({ w: 100, h: 40 })).toBe(58);
  });
  it('rings on clicks, not on fill', () => {
    expect(isRingAction({ action: 'click' })).toBe(true);
    expect(isRingAction({ action: 'fill' })).toBe(false);
    expect(isRingAction(null)).toBe(false);
  });
});

describe('reduceCard keeps the newest target', () => {
  it('stores step.target as lastTarget and keeps it across target-less steps', () => {
    let c = initialCard({ id: 'a' });
    c = reduceCard(c, { type: 'step', step: 0, action: { action: 'click', zaoId: 'z3' }, target: T, at: 5 });
    expect(c.lastTarget).toEqual({ ...T, action: 'click', n: 1, at: 5 });
    c = reduceCard(c, { type: 'step', step: 1, action: { action: 'navigate', url: 'https://x' }, at: 6 });
    expect(c.lastTarget.n).toBe(1);
    c = reduceCard(c, { type: 'step', step: 2, action: { action: 'click' }, target: { bogus: 1 }, at: 7 });
    expect(c.lastTarget.n).toBe(1);
  });
});
