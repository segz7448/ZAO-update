const test = require('node:test');
const assert = require('node:assert');
const { clampPoint, clampWheel, clickCount, MAX_WHEEL } = require('../manualInput');

test('clampPoint clamps on-page and rejects junk', () => {
  assert.deepStrictEqual(clampPoint(10, 20), { x: 10, y: 20 });
  assert.deepStrictEqual(clampPoint(-5, 5000), { x: 0, y: 914 });
  assert.deepStrictEqual(clampPoint(999, 1, { width: 412, height: 915 }), { x: 411, y: 1 });
  assert.strictEqual(clampPoint('1', 2), null);
  assert.strictEqual(clampPoint(NaN, 2), null);
  assert.strictEqual(clampPoint(undefined, undefined), null);
});
test('clampWheel caps and drops no-ops', () => {
  assert.deepStrictEqual(clampWheel(0, 120), { dx: 0, dy: 120 });
  assert.deepStrictEqual(clampWheel(1e9, -1e9), { dx: MAX_WHEEL, dy: -MAX_WHEEL });
  assert.strictEqual(clampWheel(0, 0), null);
  assert.strictEqual(clampWheel('x', null), null);
});
test('clickCount only allows 1 or 2', () => {
  assert.strictEqual(clickCount(2), 2);
  for (const n of [undefined, 0, 1, 3, '2']) assert.strictEqual(clickCount(n), 1);
});

test('AgentSession trackpad handlers drive the real page (move/down/up/wheel/dblclick)', async (t) => {
  let AgentSession, shutdownBrowser;
  try { ({ AgentSession, shutdownBrowser } = require('../browserAgent')); } catch (e) { t.skip('playwright not installed'); return; }
  const s = new AgentSession(() => {});
  try { await s._ensureContext(); } catch (e) { t.skip('no chromium'); return; }
  try {
    const page = s._activePage();
    await page.setContent(`<body style="margin:0"><div id="b" style="width:412px;height:300px"></div><div style="height:3000px"></div>
      <script>window.ev=[];const b=document.getElementById('b');for(const k of ['mousemove','mousedown','mouseup','dblclick'])b.addEventListener(k,e=>ev.push(k+':'+e.clientX+','+e.clientY));</script></body>`);
    await s.manualMouseMove(100, 50);
    await s.manualMouseDown(100, 50);
    await s.manualMouseMove(150, 60);
    await s.manualMouseUp(150, 60);
    await s.manualClick(20, 20, 2);
    await s.manualWheel(0, 400, 200, 400);
    await page.waitForTimeout(150);
    const ev = await page.evaluate(() => window.ev);
    assert.ok(ev.includes('mousedown:100,50'), ev.join(' '));
    assert.ok(ev.includes('mouseup:150,60'), ev.join(' '));
    assert.ok(ev.includes('dblclick:20,20'), ev.join(' '));
    assert.ok((await page.evaluate(() => window.scrollY)) >= 300, 'wheel scrolled');
    await s.manualMouseMove('bad', 1); // ignored, no throw
  } finally {
    await s.context?.close().catch(() => {});
    await shutdownBrowser?.().catch(() => {});
  }
});
