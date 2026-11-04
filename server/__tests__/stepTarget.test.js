// Run: cd server && npm test   (node:test, no extra deps)
const test = require('node:test');
const assert = require('node:assert');
const { normalizeTarget, buildStepMessage, TARGET_ACTIONS } = require('../stepTarget');

const VP = { width: 412, height: 915 };

test('normalizeTarget keeps in-view boxes and adds viewport size', () => {
  assert.deepStrictEqual(normalizeTarget({ x: 18, y: 300.04, width: 120.26, height: 44 }, VP), { x: 18, y: 300, w: 120.3, h: 44, vw: 412, vh: 915 });
});
test('normalizeTarget clips partly visible boxes', () => {
  assert.deepStrictEqual(normalizeTarget({ x: -10, y: 900, width: 50, height: 40 }, VP), { x: 0, y: 900, w: 40, h: 15, vw: 412, vh: 915 });
});
test('normalizeTarget rejects off-screen / empty / bad input', () => {
  assert.strictEqual(normalizeTarget({ x: 10, y: 1000, width: 20, height: 20 }, VP), null);
  assert.strictEqual(normalizeTarget({ x: 10, y: 10, width: 0, height: 20 }, VP), null);
  assert.strictEqual(normalizeTarget(null, VP), null);
  assert.strictEqual(normalizeTarget({ x: 1, y: 1, width: 2, height: 2 }, null), null);
  assert.strictEqual(normalizeTarget({ x: NaN, y: 1, width: 2, height: 2 }, VP), null);
});
test('buildStepMessage is additive: no target key unless present', () => {
  const a = { action: 'click', zaoId: 'z3' };
  assert.deepStrictEqual(buildStepMessage({ step: 2, action: a }), { type: 'step', step: 2, action: a });
  assert.deepStrictEqual(buildStepMessage({ step: 2, action: a, target: null }), { type: 'step', step: 2, action: a });
  const t = { x: 1, y: 2, w: 3, h: 4, vw: 412, vh: 915 };
  assert.deepStrictEqual(buildStepMessage({ step: 2, action: a, target: t }), { type: 'step', step: 2, action: a, target: t });
});
test('only element actions get targets', () => {
  for (const a of ['click', 'fill', 'selectOption', 'setChecked', 'submitForm', 'scrollTo', 'download', 'hover']) assert.ok(TARGET_ACTIONS.has(a));
  for (const a of ['navigate', 'finish', 'needsHuman', 'extractPageText']) assert.ok(!TARGET_ACTIONS.has(a));
});

// Integration: real AgentSession + Chromium - the box matches the element's
// pixels in the very screenshot the phone receives. Skips if no Chromium.
test('AgentSession._targetFor lines up with the streamed screenshot', async (t) => {
  let AgentSession, shutdownBrowser;
  try { ({ AgentSession, shutdownBrowser } = require('../browserAgent')); } catch (e) { t.skip('playwright not installed'); return; }
  const s = new AgentSession(() => {});
  try { await s._ensureContext(); } catch (e) { t.skip(`no chromium: ${e.message.split('\n')[0]}`); return; }
  try {
    const page = s._activePage();
    await page.setContent('<body style="margin:0"><div style="height:1400px"></div><button id="b" style="position:absolute;left:40px;top:1500px;width:160px;height:50px;background:#f00;border:0">Add to cart</button><div style="height:2000px"></div></body>');
    await s._extractElements();
    const id = await page.getAttribute('#b', 'data-zao-id');
    const tgt = await s._targetFor({ action: 'click', zaoId: id });
    assert.ok(tgt, 'target computed');
    assert.strictEqual(tgt.vw, 412); assert.strictEqual(tgt.vh, 915);
    assert.strictEqual(tgt.w, 160); assert.strictEqual(tgt.h, 50); assert.strictEqual(tgt.x, 40);
    assert.ok(tgt.y >= 0 && tgt.y + tgt.h <= 915, 'scrolled into view');
    // centre pixel of the target in the viewport screenshot is the red button
    const png = await page.screenshot({ type: 'png' });
    const dims = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.deepStrictEqual(dims, [412, 915], 'frame is viewport-sized at DPR 1');
    const color = await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).backgroundColor, { x: tgt.x + tgt.w / 2, y: tgt.y + tgt.h / 2 });
    assert.strictEqual(color, 'rgb(255, 0, 0)');
    assert.strictEqual(await s._targetFor({ action: 'navigate', url: 'x' }), null);
  } finally {
    await s.context?.close().catch(() => {});
    await shutdownBrowser?.().catch(() => {});
  }
});
