/**
 * ZAO - in-memory store for inline chat Browser Cards.
 *
 * Deliberately NOT persisted (no DB / schema change): cards live for the
 * app session and are fed by the one existing BrowserAgentStream (App.js)
 * via attachBrowserCardStream(). The stream already auto-reconnects on
 * close (browserAgentStream.js), so there is no polling here.
 */
import { create } from 'zustand';
import { reduceCard, initialCard, isTaskStart, TERMINAL_PHASES } from '../services/browserAgent/browserCardState';

let seq = 0;

export const useBrowserCardStore = create((set, get) => ({
  cards: [], // see browserCardState.initialCard
  activeCardId: null,
  _running: false,

  startCard({ conversationId, anchorMessageId, now } = {}) {
    // Finish off any previous still-open card so only one is ever live.
    const id = `bcard_${Date.now().toString(36)}_${++seq}`;
    const card = initialCard({ id, conversationId, anchorMessageId, now });
    set((s) => ({
      cards: [...s.cards.map((c) => (c.id === s.activeCardId && !TERMINAL_PHASES.has(c.phase) ? { ...c, phase: 'stopped', caption: 'Ended' } : c)), card],
      activeCardId: id,
    }));
    return id;
  },

  dispatch(ev) {
    const { activeCardId } = get();
    if (!activeCardId) return;
    set((s) => ({ cards: s.cards.map((c) => (c.id === activeCardId ? reduceCard(c, ev) : c)) }));
  },

  /** Status handling incl. auto-starting a card on idle -> running. */
  handleStatus(status, ctx = {}) {
    const wasRunning = get()._running;
    set({ _running: !!status?.running });
    const active = get().cards.find((c) => c.id === get().activeCardId);
    if (isTaskStart(wasRunning, status) && (!active || TERMINAL_PHASES.has(active.phase))) {
      get().startCard(ctx);
    }
    get().dispatch({ type: 'status', ...status });
  },

  toggleCollapsed(id) {
    set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, collapsed: !c.collapsed } : c)) }));
  },

  reset() { set({ cards: [], activeCardId: null, _running: false }); },
}));

/**
 * Subscribes the card store to an existing BrowserAgentStream instance.
 * getContext() returns { conversationId, anchorMessageId } for where a new
 * card should be anchored (the latest message at task start).
 * Returns an unsubscribe function.
 */
export function attachBrowserCardStream(stream, getContext = () => ({})) {
  const st = () => useBrowserCardStore.getState();
  const offs = [
    stream.on('status', (s) => st().handleStatus(s, getContext())),
    stream.on('frame', (data) => st().dispatch({ type: 'frame', data })),
    stream.on('step', (m) => {
      const s = st();
      const active = s.cards.find((c) => c.id === s.activeCardId);
      if (!active || TERMINAL_PHASES.has(active.phase)) s.startCard(getContext());
      st().dispatch({ type: 'step', at: Date.now(), ...m }); // receive time for the step-history sheet
    }),
    stream.on('taskResult', (r) => st().dispatch({ type: 'taskResult', ...r })),
    stream.on('connectionChange', ({ connected, error }) => st().dispatch({ type: 'connection', connected, error })),
  ];
  return () => offs.forEach((off) => off());
}
