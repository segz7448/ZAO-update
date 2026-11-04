import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import {
  createDictationState,
  reduceDictation,
  displayText,
  isRecordingUi,
  joinTranscript,
} from './dictationMachine';

/**
 * Wire expo-speech-recognition into the dictation state machine.
 * Safe when the native module is missing (Expo Go / stale binary):
 * start() surfaces a friendly alert instead of crashing.
 */
let ExpoSpeechRecognitionModule = null;
let useSpeechRecognitionEvent = () => {};

try {
  // eslint-disable-next-line global-require
  const mod = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = mod.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = mod.useSpeechRecognitionEvent;
} catch (_) {
  ExpoSpeechRecognitionModule = null;
}

function showDeniedAlert() {
  Alert.alert(
    'Microphone access needed',
    'Enable microphone and speech recognition in Settings so ZAO can dictate into the composer.',
    [
      { text: 'Not now', style: 'cancel' },
      {
        text: 'Open Settings',
        onPress: () => {
          if (Platform.OS === 'ios') Linking.openURL('app-settings:');
          else Linking.openSettings?.();
        },
      },
    ],
  );
}

function showMissingNativeAlert() {
  Alert.alert(
    'Dictation needs a native rebuild',
    'expo-speech-recognition is installed but this binary was built without it. Run a native rebuild (expo prebuild + run) to enable the mic.',
  );
}

/**
 * @param {{ onCommit?: (text: string, meta?: { send?: boolean }) => void, onDenied?: () => void }} opts
 */
export function useDictation({ onCommit, onDenied } = {}) {
  const [state, dispatch] = useReducer(reduceDictation, undefined, createDictationState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const sendAfterStop = useRef(false);
  const deniedAlerted = useRef(false);

  const finish = useCallback((from) => {
    const text = joinTranscript(from.prefix, from.partial);
    const shouldSend = sendAfterStop.current;
    sendAfterStop.current = false;
    dispatch({ type: 'ENDED' });
    dispatch({ type: 'CLEAR_COMMITTED' });
    onCommit?.(text, { send: shouldSend });
  }, [onCommit]);

  useSpeechRecognitionEvent('start', () => {
    if (stateRef.current.status === 'requesting') {
      dispatch({ type: 'PERMISSION_GRANTED' });
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    const text = event?.results?.[0]?.transcript || '';
    if (event?.isFinal) dispatch({ type: 'FINAL', text });
    else dispatch({ type: 'PARTIAL', text });
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    dispatch({ type: 'LEVEL', level: event?.value });
  });

  useSpeechRecognitionEvent('error', (event) => {
    const code = event?.error;
    if (code === 'not-allowed') {
      dispatch({ type: 'PERMISSION_DENIED', error: event?.message || code });
      return;
    }
    // Abort/no-speech on stop are benign — still finalize.
    if (stateRef.current.status === 'stopping' || code === 'aborted' || code === 'no-speech') {
      finish(stateRef.current);
      return;
    }
    dispatch({ type: 'ERROR', code, error: code, message: event?.message });
    finish(stateRef.current);
  });

  useSpeechRecognitionEvent('end', () => {
    if (stateRef.current.status === 'idle') return;
    finish(stateRef.current);
  });

  useEffect(() => {
    if (state.status !== 'denied') {
      deniedAlerted.current = false;
      return;
    }
    if (deniedAlerted.current) return;
    deniedAlerted.current = true;
    onDenied?.();
    showDeniedAlert();
    dispatch({ type: 'DISMISS_DENIED' });
  }, [state.status, onDenied]);

  const start = useCallback(async (draftBase = '') => {
    if (!ExpoSpeechRecognitionModule) {
      showMissingNativeAlert();
      return false;
    }
    dispatch({ type: 'START', draftBase });
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm?.granted) {
        dispatch({ type: 'PERMISSION_DENIED', error: 'not-allowed' });
        return false;
      }
      dispatch({ type: 'PERMISSION_GRANTED' });
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 80 },
      });
      return true;
    } catch (e) {
      dispatch({ type: 'ERROR', message: e?.message || 'start-failed' });
      return false;
    }
  }, []);

  const stop = useCallback(({ andSend = false } = {}) => {
    if (!isRecordingUi(stateRef.current)) return;
    sendAfterStop.current = !!andSend;
    dispatch({ type: 'STOP' });
    try {
      ExpoSpeechRecognitionModule?.stop?.();
    } catch (_) {
      finish(stateRef.current);
    }
  }, [finish]);

  return {
    state,
    liveText: displayText(state),
    isRecording: isRecordingUi(state),
    start,
    stop,
  };
}
