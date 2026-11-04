/**
 * Pure dictation state machine for the Grok-style composer mic.
 * Kept free of React / native modules so unit tests cover every transition.
 *
 * States: idle | requesting | recording | stopping | denied
 *
 * While recording, `prefix` holds text that was already in the composer
 * (plus any finalized speech segments) and `partial` is the live interim
 * transcript shown in gray italics. `levels` is a rolling buffer of
 * normalized 0..1 amplitude samples for the waveform.
 */

export const LEVEL_BUFFER = 32;

export function createDictationState(seed = {}) {
  return {
    status: 'idle',
    prefix: '',
    partial: '',
    levels: Array.from({ length: LEVEL_BUFFER }, () => 0.08),
    error: null,
    ...seed,
  };
}

/** Join two transcript chunks with a single space when both are non-empty. */
export function joinTranscript(a, b) {
  const left = String(a || '').trimEnd();
  const right = String(b || '').trimStart();
  if (!left) return right;
  if (!right) return left;
  return `${left} ${right}`;
}

/** Map native volume (-2..10) to a 0..1 bar height. */
export function normalizeLevel(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0.08;
  // <= 0 is inaudible per expo-speech-recognition docs
  const clamped = Math.max(0, Math.min(10, n));
  return Math.max(0.08, Math.min(1, clamped / 10));
}

export function pushLevel(levels, raw, size = LEVEL_BUFFER) {
  const next = (levels && levels.length ? levels.slice() : Array.from({ length: size }, () => 0.08));
  next.push(normalizeLevel(raw));
  while (next.length > size) next.shift();
  return next;
}

/** Text shown in the composer input for the current machine state. */
export function displayText(state) {
  if (!state) return '';
  if (state.status === 'recording' || state.status === 'stopping' || state.status === 'requesting') {
    return joinTranscript(state.prefix, state.partial);
  }
  return joinTranscript(state.prefix, state.partial);
}

export function isLive(state) {
  return state?.status === 'recording' || state?.status === 'stopping';
}

export function isRecordingUi(state) {
  return state?.status === 'recording' || state?.status === 'stopping' || state?.status === 'requesting';
}

/**
 * @param {ReturnType<typeof createDictationState>} state
 * @param {{ type: string, [k: string]: any }} action
 */
export function reduceDictation(state, action) {
  if (!action || !action.type) return state;

  switch (action.type) {
    case 'START': {
      if (state.status === 'recording' || state.status === 'requesting' || state.status === 'stopping') {
        return state;
      }
      return {
        ...createDictationState(),
        status: 'requesting',
        prefix: String(action.draftBase || ''),
      };
    }

    case 'PERMISSION_GRANTED': {
      if (state.status !== 'requesting') return state;
      return { ...state, status: 'recording', error: null };
    }

    case 'PERMISSION_DENIED': {
      return {
        ...createDictationState(),
        status: 'denied',
        error: action.error || 'not-allowed',
        prefix: state.prefix,
      };
    }

    case 'PARTIAL': {
      if (state.status !== 'recording' && state.status !== 'stopping') return state;
      return { ...state, partial: String(action.text || '') };
    }

    case 'FINAL': {
      if (state.status !== 'recording' && state.status !== 'stopping') return state;
      const prefix = joinTranscript(state.prefix, action.text || '');
      return { ...state, prefix, partial: '' };
    }

    case 'LEVEL': {
      if (state.status !== 'recording' && state.status !== 'stopping' && state.status !== 'requesting') {
        return state;
      }
      return { ...state, levels: pushLevel(state.levels, action.level) };
    }

    case 'STOP': {
      if (state.status !== 'recording' && state.status !== 'requesting') return state;
      // Keep partial so ENDED can commit it if no FINAL arrives.
      return { ...state, status: 'stopping' };
    }

    case 'ENDED': {
      // Commit whatever we have; caller copies displayText into the TextInput.
      const committed = joinTranscript(state.prefix, state.partial);
      return {
        ...createDictationState(),
        status: 'idle',
        prefix: committed,
        partial: '',
      };
    }

    case 'CLEAR_COMMITTED': {
      // After the composer has absorbed the committed text into its own state.
      if (state.status !== 'idle') return state;
      return createDictationState();
    }

    case 'DISMISS_DENIED': {
      if (state.status !== 'denied') return state;
      return createDictationState({ prefix: state.prefix });
    }

    case 'ERROR': {
      // Non-permission errors while live → stop cleanly with whatever we have.
      if (action.error === 'not-allowed' || action.code === 'not-allowed') {
        return reduceDictation(state, { type: 'PERMISSION_DENIED', error: action.message || 'not-allowed' });
      }
      if (state.status === 'idle' || state.status === 'denied') return state;
      const committed = joinTranscript(state.prefix, state.partial);
      return {
        ...createDictationState(),
        status: 'idle',
        prefix: committed,
        error: action.message || action.error || 'error',
      };
    }

    default:
      return state;
  }
}
