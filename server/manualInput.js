/**
 * ZAO - validation for the phone's manual pointer messages (trackpad mode).
 * Additive to manualClick/manualType/manualKey: manualMouseMove / Down / Up
 * and manualWheel. Coordinates are viewport CSS px of the streamed 412x915
 * page; anything non-numeric is dropped, everything is clamped on-page.
 */
const VIEWPORT = { width: 412, height: 915 };
const MAX_WHEEL = 3000; // px per message - a fling, not a teleport

function clampPoint(x, y, vp = VIEWPORT) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const w = vp?.width || VIEWPORT.width, h = vp?.height || VIEWPORT.height;
  return { x: Math.min(w - 1, Math.max(0, x)), y: Math.min(h - 1, Math.max(0, y)) };
}

function clampWheel(dx, dy) {
  const c = (v) => (Number.isFinite(v) ? Math.max(-MAX_WHEEL, Math.min(MAX_WHEEL, v)) : 0);
  const out = { dx: c(dx), dy: c(dy) };
  return out.dx || out.dy ? out : null;
}

/** 1 (single) or 2 (double-click); anything else -> 1. */
const clickCount = (n) => (n === 2 ? 2 : 1);

module.exports = { VIEWPORT, MAX_WHEEL, clampPoint, clampWheel, clickCount };
