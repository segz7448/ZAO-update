import { reduceCard, initialCard, CARD_PHASE, statusPill, captionForStep, domainFromUrl, isTaskStart } from '../browserCardState';
import { useBrowserCardStore, attachBrowserCardStream } from '../../../store/browserCardStore';

const card = () => initialCard({ id: 'c1', conversationId: 'conv', anchorMessageId: 'm1', now: 0 });

describe('browserCardState', () => {
  test('pill mapping covers Live/Working/Needs you/Done', () => {
    expect(statusPill(CARD_PHASE.LIVE).label).toBe('Live');
    expect(statusPill(CARD_PHASE.WORKING).label).toBe('Working');
    expect(statusPill(CARD_PHASE.PAUSED).label).toBe('Needs you');
    expect(statusPill(CARD_PHASE.DONE)).toMatchObject({ label: 'Done', pulse: false });
  });
  test('status updates title/url from active tab and running/awaitingHuman', () => {
    let c = reduceCard(card(), { type: 'status', running: true, tabs: [{ tabId: 'a', url: 'https://www.amazon.com/x', title: 'Amazon', active: true }] });
    expect(c).toMatchObject({ phase: 'working', title: 'Amazon', url: 'https://www.amazon.com/x' });
    c = reduceCard(c, { type: 'status', running: false, awaitingHuman: true, reason: 'CAPTCHA' });
    expect(c.phase).toBe('paused');
    expect(c.caption).toMatch(/CAPTCHA/);
  });
  test('frames update until terminal, then the last frame is kept', () => {
    let c = reduceCard(card(), { type: 'frame', data: 'AAA' });
    c = reduceCard(c, { type: 'taskResult', success: true, answer: 'ok' });
    expect(c.phase).toBe('done');
    c = reduceCard(c, { type: 'frame', data: 'BBB' });
    expect(c.lastFrame).toBe('AAA');
  });
  test('steps produce captions and count', () => {
    const c = reduceCard(card(), { type: 'step', step: 1, action: { action: 'click', label: 'Add to cart' } });
    expect(c.caption).toBe('Clicking Add to cart');
    expect(c.stepCount).toBe(1);
    expect(captionForStep({ action: { action: 'navigate', url: 'https://www.target.com/p' } })).toBe('Opening target.com');
  });
  test('disconnect -> reconnecting, reconnect restores previous phase', () => {
    let c = reduceCard(card(), { type: 'connection', connected: false });
    expect(c.phase).toBe('reconnecting');
    c = reduceCard(c, { type: 'connection', connected: true });
    expect(c.phase).toBe('working');
  });
  test('stop -> stopped, failure -> error, needsHuman -> paused', () => {
    let c = reduceCard(card(), { type: 'stopRequested' });
    c = reduceCard(c, { type: 'status', running: false, awaitingHuman: false });
    expect(c.phase).toBe('stopped');
    expect(reduceCard(card(), { type: 'taskResult', success: false, error: { message: 'boom' } })).toMatchObject({ phase: 'error', error: 'boom' });
    expect(reduceCard(card(), { type: 'taskResult', needsHuman: true, reason: 'login' }).phase).toBe('paused');
  });
  test('helpers', () => {
    expect(domainFromUrl('https://www.example.com/a')).toBe('example.com');
    expect(domainFromUrl('bad url')).toBe('bad url'.split('/')[0]);
    expect(isTaskStart(false, { running: true })).toBe(true);
    expect(isTaskStart(true, { running: true })).toBe(false);
  });
});

describe('browserCardStore + stream wiring', () => {
  function fakeStream() {
    const l = {};
    return { on: (e, f) => { (l[e] = l[e] || new Set()).add(f); return () => l[e].delete(f); }, emit: (e, p) => l[e]?.forEach((f) => f(p)) };
  }
  beforeEach(() => useBrowserCardStore.getState().reset());
  test('a task start creates one anchored card; it ends Done with its last frame', () => {
    const s = fakeStream();
    const off = attachBrowserCardStream(s, () => ({ conversationId: 'conv', anchorMessageId: 'm9' }));
    s.emit('status', { running: true, tabs: [] });
    s.emit('frame', 'F1');
    s.emit('step', { step: 1, action: { action: 'fill', text: 'stroller' } });
    s.emit('status', { running: true, tabs: [] });
    s.emit('taskResult', { success: true, answer: 'done' });
    s.emit('status', { running: false, tabs: [] });
    const { cards } = useBrowserCardStore.getState();
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({ anchorMessageId: 'm9', conversationId: 'conv', phase: 'done', lastFrame: 'F1' });
    // a second task makes a second card, first stays Done
    s.emit('status', { running: true, tabs: [] });
    expect(useBrowserCardStore.getState().cards.map((c) => c.phase)).toEqual(['done', 'working']);
    off();
  });
});

describe('mergeBrowserCards', () => {
  const { mergeBrowserCards } = require('../browserCardState');
  const msgs = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
  test('places a card after its anchor, scoped to the conversation, orphans at the end', () => {
    const cards = [
      { id: 'c1', conversationId: 'A', anchorMessageId: 'm1' },
      { id: 'c2', conversationId: 'B', anchorMessageId: 'm2' },
      { id: 'c3', conversationId: 'A', anchorMessageId: 'gone' },
    ];
    expect(mergeBrowserCards(msgs, cards, 'A').map((x) => x.id)).toEqual(['m1', 'c1', 'm2', 'm3', 'c3']);
  });
  test('no cards returns the same array', () => {
    expect(mergeBrowserCards(msgs, [], 'A')).toBe(msgs);
  });
});

import { historyEntry, appendHistory, formatStepTime, phaseLight, iconForAction, HISTORY_MAX } from '../browserCardState';

describe('step history + status light', () => {
  test('step events append real history rows with receive time', () => {
    let c = card();
    c = reduceCard(c, { type: 'step', step: 1, action: { action: 'navigate', url: 'https://trailhead.com/x' }, at: 1000 });
    c = reduceCard(c, { type: 'step', step: 2, action: { action: 'click', zaoId: 'z3', label: 'Add to cart' }, at: 2000 });
    expect(c.history).toEqual([
      { n: 1, action: 'navigate', caption: 'Opening trailhead.com', at: 1000 },
      { n: 2, action: 'click', caption: 'Clicking Add to cart', at: 2000 },
    ]);
  });
  test('history is capped and immutable', () => {
    const h = Array.from({ length: HISTORY_MAX }, (_, i) => ({ n: i }));
    const next = appendHistory(h, { n: 'new' });
    expect(next).toHaveLength(HISTORY_MAX);
    expect(next[next.length - 1].n).toBe('new');
    expect(h).toHaveLength(HISTORY_MAX);
  });
  test('historyEntry falls back to the count when step is missing', () => {
    expect(historyEntry({ action: { action: 'goBack' } }, 7)).toEqual({ n: 7, action: 'goBack', caption: 'Going back', at: null });
  });
  test('formatStepTime', () => {
    expect(formatStepTime(null)).toBe('');
    expect(formatStepTime(10000, 12000)).toBe('now');
    expect(formatStepTime(0, 30000)).toBe('30s ago');
    expect(formatStepTime(0, 180000)).toBe('3m ago');
  });
  test('phaseLight colours', () => {
    expect(phaseLight(CARD_PHASE.WORKING)).toEqual({ color: '#0A84FF', pulse: true });
    expect(phaseLight(CARD_PHASE.PAUSED).color).toBe('#FFD60A');
    expect(phaseLight(CARD_PHASE.DONE)).toEqual({ color: '#30D158', pulse: false });
    expect(phaseLight(CARD_PHASE.PAUSED, { takeover: true }).pulse).toBe(false);
  });
  test('iconForAction', () => {
    expect(iconForAction('needsHuman')).toBe('hand-left-outline');
    expect(iconForAction('weird')).toBe('ellipsis-horizontal-circle-outline');
  });
});
