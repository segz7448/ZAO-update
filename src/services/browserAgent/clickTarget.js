/**
 * ZAO - pure mapping for the click-ring overlay.
 *
 * The server (server/stepTarget.js) attaches an optional `target`
 * { x, y, w, h, vw, vh } to 'step' messages: the element the agent is about
 * to act on, in viewport CSS px of the 412x915 page the frames are
 * screenshots of (DPR 1, viewport only, box measured after scrollIntoView).
 * These helpers place that rect on screen for however the frame is drawn:
 *   - fullscreen: BrowserStreamView "contain" fit, then display zoom, centred
 *   - card:       width-filled "cover", top aligned (cropped at the bottom)
 * No React here so it's unit-tested directly.
 */

export const FRAME_W = 412;
export const FRAME_H = 915;

/** Actions that show the pulsing ring (others just get the outline + cursor). */
const RING_ACTIONS = new Set(['click', 'setChecked', 'submitForm', 'download', 'selectOption']);
export const isRingAction = (action) => RING_ACTIONS.has(action?.action);

/** Validates a step's target. Returns a clean copy or null (old servers send none). */
export function sanitizeTarget(t) {
  if (!t || typeof t !== 'object') return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
  const x = n(t.x), y = n(t.y), w = n(t.w), h = n(t.h);
  const vw = n(t.vw) > 0 ? t.vw : FRAME_W;
  const vh = n(t.vh) > 0 ? t.vh : FRAME_H;
  if ([x, y, w, h].some(Number.isNaN) || w <= 0 || h <= 0) return null;
  if (x >= vw || y >= vh || x + w <= 0 || y + h <= 0) return null;
  return { x, y, w, h, vw, vh };
}

/**
 * Where the frame image sits inside a view of viewW x viewH.
 * mode 'contain' (letterboxed, centred) or 'cover' (filled, cropped);
 * align 'center' | 'top' for the vertical position; zoom scales the box
 * about the centre (BrowserStreamView's display zoom).
 */
export function frameBox(viewW, viewH, { frameW = FRAME_W, frameH = FRAME_H, mode = 'contain', align = 'center', zoom = 1 } = {}) {
  if (!(viewW > 0) || !(viewH > 0)) return null;
  const s = (mode === 'cover' ? Math.max : Math.min)(viewW / frameW, viewH / frameH) * (zoom > 0 ? zoom : 1);
  const width = frameW * s, height = frameH * s;
  return { x: (viewW - width) / 2, y: align === 'top' ? 0 : (viewH - height) / 2, width, height, scale: s };
}

/**
 * Maps a target into view coordinates. Returns { x, y, w, h, cx, cy } or
 * null when invalid or wholly outside the visible view (e.g. below the
 * card's crop). Partly visible rects are clipped to the view.
 */
export function mapTargetToView(target, viewW, viewH, opts = {}) {
  const t = sanitizeTarget(target);
  const box = frameBox(viewW, viewH, opts);
  if (!t || !box) return null;
  const kx = box.width / t.vw, ky = box.height / t.vh; // target vw may differ from frame size
  const x0 = Math.max(0, box.x + t.x * kx), y0 = Math.max(0, box.y + t.y * ky);
  const x1 = Math.min(viewW, box.x + (t.x + t.w) * kx), y1 = Math.min(viewH, box.y + (t.y + t.h) * ky);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

/** Ring diameter for a mapped rect: hugs small targets, capped for big ones. */
export function ringSize(rect, { min = 36, max = 88 } = {}) {
  if (!rect) return min;
  return Math.max(min, Math.min(max, Math.min(rect.w, rect.h) + 18));
}
