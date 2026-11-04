/**
 * Concurrent chat-run controller (Muse / Grok Bot style).
 *
 * One active run at a time for the conversation. Mid-run user messages are
 * appended to the UI immediately and enqueued as steers that the agent loop
 * drains at the next step boundary. Stop is scoped to the active run only —
 * queued steers stay as chat bubbles; saying "continue" later starts a new
 * run that sees the full history (including those bubbles).
 */

export function initialRunState() {
  return {
    activeRunId: null,
    cancelRunId: null,
    pendingSteers: [],
  };
}

export function startRun(state, runId) {
  if (!runId) throw new Error('startRun requires a runId');
  return {
    ...state,
    activeRunId: runId,
    cancelRunId: null,
    pendingSteers: [],
  };
}

/** Stop ONLY the currently active run. No-op if idle. */
export function requestStop(state) {
  if (!state.activeRunId) return state;
  return { ...state, cancelRunId: state.activeRunId };
}

export function isRunCancelled(state, runId) {
  return !!runId && state.cancelRunId === runId;
}

/**
 * Accept a mid-run user message as steering. Returns { state, accepted }.
 * Rejected when there is no active run (caller should start a new one).
 */
export function enqueueSteer(state, { id, text }) {
  if (!state.activeRunId) return { state, accepted: false };
  const entry = { id: id || `steer_${Date.now()}`, text: String(text || '').trim() };
  if (!entry.text) return { state, accepted: false };
  return {
    state: { ...state, pendingSteers: [...state.pendingSteers, entry] },
    accepted: true,
  };
}

/** Drain and clear the steer queue (agent loop step boundary). */
export function drainSteers(state) {
  if (!state.pendingSteers.length) return { state, steers: [] };
  return {
    state: { ...state, pendingSteers: [] },
    steers: state.pendingSteers.slice(),
  };
}

/**
 * End a run. Ignores stale ends from a previous run after a newer one
 * started (should not happen with one-at-a-time, but defensive).
 * Leftover undrained steers are dropped from the controller (bubbles stay
 * in chat history for a later "continue").
 */
export function endRun(state, runId) {
  if (state.activeRunId !== runId) return state;
  return {
    ...state,
    activeRunId: null,
    cancelRunId: null,
    pendingSteers: [],
  };
}

export function coalesceSteerText(steers) {
  return (steers || [])
    .map((s) => (s && s.text ? String(s.text).trim() : ''))
    .filter(Boolean)
    .join('\n');
}
