/**
 * ZAO - optional `target` on browser-agent `step` messages (additive; old
 * clients ignore it). Describes where the agent is about to act, in
 * viewport-relative CSS pixels plus the viewport size:
 *   target: { x, y, w, h, vw, vh }
 * The live frames are page.screenshot() of the same viewport (412x915,
 * deviceScaleFactor 1, viewport-only, not fullPage), and Playwright's
 * boundingBox() is relative to the main-frame viewport after scroll - so
 * frame pixel = target pixel * (frameWidth / vw).
 */

/** Actions that act on a zaoId element and so get a target. */
const TARGET_ACTIONS = new Set(['click', 'fill', 'selectOption', 'setChecked', 'submitForm', 'scrollTo', 'download', 'hover']);

const r1 = (n) => Math.round(n * 10) / 10;

/**
 * Normalises a Playwright boundingBox + viewport to a target, clipped to the
 * viewport. Returns null when there's no box or it's entirely off-screen.
 */
function normalizeTarget(box, viewport) {
  if (!box || !viewport || !(viewport.width > 0) || !(viewport.height > 0)) return null;
  const { x, y, width, height } = box;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(viewport.width, x + width), y1 = Math.min(viewport.height, y + height);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: r1(x0), y: r1(y0), w: r1(x1 - x0), h: r1(y1 - y0), vw: viewport.width, vh: viewport.height };
}

/** The outgoing ws message. `target` only appears when there is one. */
function buildStepMessage({ step, action, target }) {
  const msg = { type: 'step', step, action };
  if (target) msg.target = target;
  return msg;
}

module.exports = { TARGET_ACTIONS, normalizeTarget, buildStepMessage };
