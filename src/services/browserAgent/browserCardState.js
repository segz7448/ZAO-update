/**
 * ZAO - Inline Browser Card state mapping (pure, no React / no I/O).
 *
 * Maps the EXISTING /browser-agent/stream messages (see
 * server/browserStream.js: frame / status / step / taskResult, plus the
 * client-side connectionChange event from browserAgentStream.js) onto the
 * state the inline chat BrowserCard renders. Nothing here talks to the
 * server or invents protocol - it's the reducer that browserCardStore.js
 * feeds stream events through, kept pure so it's unit-testable.
 */
import { sanitizeTarget } from './clickTarget';

export const CARD_PHASE = {
  LIVE: 'live', // connected session, agent idle (e.g. manual navigation in fullscreen)
  WORKING: 'working', // agent is running a task
  PAUSED: 'paused', // agent asked for a human (needsHuman) - waiting on you
  RECONNECTING: 'reconnecting', // socket dropped mid-task; browserAgentStream auto-reconnects
  DONE: 'done',
  STOPPED: 'stopped',
  ERROR: 'error',
};

export const TERMINAL_PHASES = new Set([CARD_PHASE.DONE, CARD_PHASE.STOPPED, CARD_PHASE.ERROR]);

/** Pill label + semantic tone for a phase. */
export function statusPill(phase) {
  switch (phase) {
    case CARD_PHASE.WORKING: return { label: 'Working', tone: 'brand', pulse: true };
    case CARD_PHASE.PAUSED: return { label: 'Needs you', tone: 'warning', pulse: true };
    case CARD_PHASE.RECONNECTING: return { label: 'Reconnecting', tone: 'neutral', pulse: true };
    case CARD_PHASE.DONE: return { label: 'Done', tone: 'success', pulse: false };
    case CARD_PHASE.STOPPED: return { label: 'Stopped', tone: 'neutral', pulse: false };
    case CARD_PHASE.ERROR: return { label: 'Error', tone: 'danger', pulse: false };
    case CARD_PHASE.LIVE:
    default: return { label: 'Live', tone: 'live', pulse: true };
  }
}

export function domainFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    const m = url.match(/^(?:[a-z]+:\/\/)?([^/?#]+)/i);
    return m ? m[1].replace(/^www\./, '') : '';
  }
}

export function activeTab(tabs) {
  if (!Array.isArray(tabs) || tabs.length === 0) return null;
  return tabs.find((t) => t.active) || tabs[tabs.length - 1];
}

const trunc = (s, n = 40) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

/** The step's optional `target` (see clickTarget.js), stamped so the overlay can tell each new one apart. */
function targetEntry(ev, n) {
  const t = sanitizeTarget(ev.target);
  return t ? { ...t, action: ev.action?.action || null, n, at: ev.at || Date.now() } : null;
}

/** Human caption for one 'step' message ({ step, action }). */
export function captionForStep(stepMsg) {
  const a = stepMsg?.action;
  if (!a || !a.action) return 'Browsing…';
  switch (a.action) {
    case 'navigate': { const d = domainFromUrl(a.url); return d ? `Opening ${d}` : 'Opening page'; }
    case 'click': return a.label ? `Clicking ${trunc(a.label)}` : 'Clicking on the page';
    case 'fill': return a.text ? `Typing “${trunc(a.text, 30)}”` : 'Typing';
    case 'selectOption': return a.value ? `Selecting ${trunc(a.value, 30)}` : 'Selecting an option';
    case 'setChecked': return a.checked === false ? 'Unchecking a box' : 'Checking a box';
    case 'submitForm': return 'Submitting the form';
    case 'scrollTo': return 'Scrolling';
    case 'waitForSelector': return 'Waiting for the page';
    case 'extractPageText': return 'Reading the page';
    case 'extractTables': return 'Reading a table';
    case 'checkConsole': return 'Checking the console';
    case 'newTab': return 'Opening a new tab';
    case 'switchTab': return 'Switching tabs';
    case 'closeTab': return 'Closing a tab';
    case 'goBack': return 'Going back';
    case 'download': return 'Downloading a file';
    case 'needsHuman': return a.reason ? `Needs you: ${trunc(a.reason, 50)}` : 'Needs your help';
    case 'finish': return 'Wrapping up';
    default: return 'Browsing…';
  }
}

export function initialCard({ id, conversationId = null, anchorMessageId = null, now = Date.now() } = {}) {
  return {
    id,
    conversationId,
    anchorMessageId,
    startedAt: now,
    phase: CARD_PHASE.WORKING,
    title: '',
    url: '',
    caption: 'Starting the browser…',
    stepCount: 0,
    lastFrame: null,
    answer: null,
    error: null,
    collapsed: false,
    history: [], // recent step messages: { n, action, caption, at }
    lastTarget: null, // { x, y, w, h, vw, vh, action, n, at } from the newest step that carried one - click-ring overlay
  };
}

/**
 * Reduces one stream event onto a card. Events:
 *   { type: 'frame', data }
 *   { type: 'status', running, awaitingHuman, reason, tabs }
 *   { type: 'step', step, action }
 *   { type: 'taskResult', success, answer, error, needsHuman, reason }
 *   { type: 'connection', connected, error }
 *   { type: 'stopRequested' }  - local: the person tapped Stop (cancel sent)
 */
export function reduceCard(card, ev) {
  if (!card || !ev) return card;
  const terminal = TERMINAL_PHASES.has(card.phase);
  switch (ev.type) {
    case 'frame':
      if (terminal || !ev.data) return card; // finished cards keep their final frame
      return { ...card, lastFrame: ev.data };
    case 'status': {
      const tab = activeTab(ev.tabs);
      const next = { ...card };
      if (tab) { next.title = tab.title || next.title; next.url = tab.url || next.url; }
      if (terminal) return next;
      if (ev.awaitingHuman) {
        next.phase = CARD_PHASE.PAUSED;
        next.caption = ev.reason ? `Needs you: ${trunc(ev.reason, 60)}` : 'Waiting for you to take over';
      } else if (ev.running) {
        next.phase = CARD_PHASE.WORKING;
      } else if (card.stopRequested) {
        next.phase = CARD_PHASE.STOPPED;
        next.caption = 'Stopped';
      } else if (card.phase === CARD_PHASE.PAUSED || card.phase === CARD_PHASE.RECONNECTING) {
        next.phase = CARD_PHASE.LIVE;
      }
      return next;
    }
    case 'step':
      if (terminal) return card;
      return { ...card, caption: captionForStep(ev), stepCount: card.stepCount + 1, lastTarget: targetEntry(ev, card.stepCount + 1) || card.lastTarget || null, history: appendHistory(card.history, historyEntry(ev, card.stepCount + 1)), phase: card.phase === CARD_PHASE.LIVE ? CARD_PHASE.WORKING : card.phase };
    case 'taskResult':
      if (terminal) return card;
      if (ev.needsHuman) return { ...card, phase: CARD_PHASE.PAUSED, caption: ev.reason ? `Needs you: ${trunc(ev.reason, 60)}` : 'Waiting for you to take over' };
      if (ev.success) return { ...card, phase: CARD_PHASE.DONE, answer: ev.answer || null, caption: 'Task complete' };
      if (card.stopRequested) return { ...card, phase: CARD_PHASE.STOPPED, caption: 'Stopped' };
      return { ...card, phase: CARD_PHASE.ERROR, error: ev.error?.message || 'The browser task failed', caption: ev.error?.message ? trunc(ev.error.message, 70) : 'Something went wrong' };
    case 'connection':
      if (terminal) return card;
      if (!ev.connected) return { ...card, phase: CARD_PHASE.RECONNECTING, prevPhase: card.phase === CARD_PHASE.RECONNECTING ? card.prevPhase : card.phase, error: ev.error || null };
      if (card.phase === CARD_PHASE.RECONNECTING) return { ...card, phase: card.prevPhase || CARD_PHASE.LIVE, error: null };
      return card;
    case 'stopRequested':
      if (terminal) return card;
      return { ...card, stopRequested: true, caption: 'Stopping…' };
    default:
      return card;
  }
}

/** True when a status message means a NEW task just started (idle -> running). */
export function isTaskStart(prevRunning, status) {
  return !!status?.running && !prevRunning;
}

/**
 * Interleaves browser cards into the chat message list: each card goes
 * right after its anchor message (the latest message when the task
 * started); cards whose anchor isn't in this list go at the end. Only
 * cards for the given conversation are included.
 */
export function mergeBrowserCards(messages, cards, conversationId) {
  const mine = (cards || []).filter((c) => !c.conversationId || !conversationId || c.conversationId === conversationId);
  if (mine.length === 0) return messages;
  const ids = new Set(messages.map((m) => m.id));
  const byAnchor = new Map();
  const tail = [];
  mine.forEach((c) => {
    const item = { id: c.id, __browserCard: true, card: c };
    if (c.anchorMessageId && ids.has(c.anchorMessageId)) {
      if (!byAnchor.has(c.anchorMessageId)) byAnchor.set(c.anchorMessageId, []);
      byAnchor.get(c.anchorMessageId).push(item);
    } else tail.push(item);
  });
  const out = [];
  messages.forEach((m) => { out.push(m); (byAnchor.get(m.id) || []).forEach((x) => out.push(x)); });
  return out.concat(tail);
}

/** Max steps kept per card for the step-history sheet. */
export const HISTORY_MAX = 40;

/** One history row from a real `step` stream message. `at` is the time the phone received it (the protocol carries no timestamp). */
export function historyEntry(stepMsg, fallbackN = null) {
  return {
    n: Number.isFinite(stepMsg?.step) ? stepMsg.step : fallbackN,
    action: stepMsg?.action?.action || null,
    caption: captionForStep(stepMsg),
    at: Number.isFinite(stepMsg?.at) ? stepMsg.at : null,
  };
}

/** Appends and caps (oldest dropped). Never mutates. */
export function appendHistory(history, entry, max = HISTORY_MAX) {
  const next = [...(history || []), entry];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Ionicons name for a history row / status icon, per agent action. */
export function iconForAction(action) {
  switch (action) {
    case 'navigate': case 'newTab': return 'globe-outline';
    case 'click': return 'finger-print-outline';
    case 'fill': return 'text-outline';
    case 'selectOption': case 'setChecked': return 'checkbox-outline';
    case 'submitForm': return 'paper-plane-outline';
    case 'scrollTo': return 'swap-vertical-outline';
    case 'extractPageText': case 'extractTables': return 'document-text-outline';
    case 'goBack': return 'arrow-back-outline';
    case 'download': return 'download-outline';
    case 'needsHuman': return 'hand-left-outline';
    case 'finish': return 'checkmark-done-outline';
    default: return 'ellipsis-horizontal-circle-outline';
  }
}

/** "now", "12s ago", "3m ago", or a clock time for older steps. */
export function formatStepTime(at, now = Date.now()) {
  if (!Number.isFinite(at)) return '';
  const d = Math.max(0, Math.round((now - at) / 1000));
  if (d < 5) return 'now';
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  const t = new Date(at);
  return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
}

/** Status light for a phase: colour + whether it pulses. Working pulses blue, needs-you amber, done green. */
export function phaseLight(phase, { takeover = false } = {}) {
  if (takeover) return { color: '#0A84FF', pulse: false };
  switch (phase) {
    case CARD_PHASE.WORKING: return { color: '#0A84FF', pulse: true };
    case CARD_PHASE.PAUSED: return { color: '#FFD60A', pulse: true };
    case CARD_PHASE.DONE: return { color: '#30D158', pulse: false };
    case CARD_PHASE.ERROR: return { color: '#FF453A', pulse: false };
    case CARD_PHASE.RECONNECTING: return { color: '#8E8E93', pulse: true };
    case CARD_PHASE.LIVE: return { color: '#30D158', pulse: true };
    default: return { color: '#8E8E93', pulse: false };
  }
}
