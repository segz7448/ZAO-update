import {
  createDictationState,
  reduceDictation,
  displayText,
  isLive,
  isRecordingUi,
  normalizeLevel,
  pushLevel,
  joinTranscript,
  LEVEL_BUFFER,
} from '../dictationMachine';

describe('joinTranscript', () => {
  test('joins with a single space', () => {
    expect(joinTranscript('Hello', 'world')).toBe('Hello world');
    expect(joinTranscript('Hello ', ' world')).toBe('Hello world');
    expect(joinTranscript('', 'hi')).toBe('hi');
    expect(joinTranscript('hi', '')).toBe('hi');
  });
});

describe('normalizeLevel / pushLevel', () => {
  test('maps inaudible to floor', () => {
    expect(normalizeLevel(-2)).toBe(0.08);
    expect(normalizeLevel(0)).toBe(0.08);
  });
  test('maps 10 to 1', () => {
    expect(normalizeLevel(10)).toBe(1);
  });
  test('pushLevel keeps fixed buffer length', () => {
    let levels = Array.from({ length: LEVEL_BUFFER }, () => 0.08);
    for (let i = 0; i < 50; i++) levels = pushLevel(levels, 5);
    expect(levels).toHaveLength(LEVEL_BUFFER);
    expect(levels[levels.length - 1]).toBeCloseTo(0.5);
  });
});

describe('dictationMachine', () => {
  test('idle → requesting on START with draft base', () => {
    const s = reduceDictation(createDictationState(), { type: 'START', draftBase: 'Draft' });
    expect(s.status).toBe('requesting');
    expect(s.prefix).toBe('Draft');
    expect(isRecordingUi(s)).toBe(true);
    expect(isLive(s)).toBe(false);
  });

  test('requesting → recording on PERMISSION_GRANTED', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: '' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    expect(s.status).toBe('recording');
    expect(isLive(s)).toBe(true);
  });

  test('requesting → denied on PERMISSION_DENIED', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: 'Keep' });
    s = reduceDictation(s, { type: 'PERMISSION_DENIED', error: 'not-allowed' });
    expect(s.status).toBe('denied');
    expect(s.prefix).toBe('Keep');
    s = reduceDictation(s, { type: 'DISMISS_DENIED' });
    expect(s.status).toBe('idle');
    expect(s.prefix).toBe('Keep');
  });

  test('ignores START while already live', () => {
    let s = reduceDictation(createDictationState(), { type: 'START' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    const again = reduceDictation(s, { type: 'START', draftBase: 'nope' });
    expect(again).toBe(s);
  });

  test('partials stream into displayText as gray draft', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: 'Hello' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'PARTIAL', text: 'there friend' });
    expect(displayText(s)).toBe('Hello there friend');
    expect(s.partial).toBe('there friend');
  });

  test('FINAL commits segment into prefix and clears partial', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: '' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'PARTIAL', text: 'Segregate probes' });
    s = reduceDictation(s, { type: 'FINAL', text: 'Segregate probes' });
    expect(s.prefix).toBe('Segregate probes');
    expect(s.partial).toBe('');
    s = reduceDictation(s, { type: 'PARTIAL', text: 'from the dashboard' });
    expect(displayText(s)).toBe('Segregate probes from the dashboard');
  });

  test('STOP → ENDED commits leftover partial', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: '' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'PARTIAL', text: 'almost done' });
    s = reduceDictation(s, { type: 'STOP' });
    expect(s.status).toBe('stopping');
    s = reduceDictation(s, { type: 'ENDED' });
    expect(s.status).toBe('idle');
    expect(s.prefix).toBe('almost done');
    expect(displayText(s)).toBe('almost done');
  });

  test('LEVEL updates rolling buffer only while live', () => {
    let s = createDictationState();
    s = reduceDictation(s, { type: 'LEVEL', level: 8 });
    expect(s.levels.every((x) => x === 0.08)).toBe(true);

    s = reduceDictation(s, { type: 'START' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'LEVEL', level: 8 });
    expect(s.levels[s.levels.length - 1]).toBeCloseTo(0.8);
  });

  test('not-allowed ERROR maps to denied', () => {
    let s = reduceDictation(createDictationState(), { type: 'START' });
    s = reduceDictation(s, { type: 'ERROR', code: 'not-allowed', message: 'denied' });
    expect(s.status).toBe('denied');
  });

  test('generic ERROR while recording commits and returns idle', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: 'A' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'PARTIAL', text: 'B' });
    s = reduceDictation(s, { type: 'ERROR', error: 'network', message: 'offline' });
    expect(s.status).toBe('idle');
    expect(s.prefix).toBe('A B');
    expect(s.error).toBe('offline');
  });

  test('CLEAR_COMMITTED resets idle after composer absorbs text', () => {
    let s = reduceDictation(createDictationState(), { type: 'START', draftBase: 'x' });
    s = reduceDictation(s, { type: 'PERMISSION_GRANTED' });
    s = reduceDictation(s, { type: 'FINAL', text: 'y' });
    s = reduceDictation(s, { type: 'STOP' });
    s = reduceDictation(s, { type: 'ENDED' });
    expect(s.prefix).toBe('x y');
    s = reduceDictation(s, { type: 'CLEAR_COMMITTED' });
    expect(s).toEqual(createDictationState());
  });
});
