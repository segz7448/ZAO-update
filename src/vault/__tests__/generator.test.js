import { generatePassword } from '../generator';
import { scorePassword, findReusedSecrets, isWeakScore } from '../strength';

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (n) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i += 1) out[i] = (i * 37 + 11) % 256;
    return out;
  },
}));

describe('generatePassword', () => {
  test('respects length and classes', async () => {
    const r = await generatePassword({ length: 24, symbols: true, digits: true });
    expect(r.password).toHaveLength(24);
    expect(r.entropyBits).toBeGreaterThan(100);
    expect(/\d/.test(r.password)).toBe(true);
    expect(/[^A-Za-z0-9]/.test(r.password)).toBe(true);
  });

  test('can omit symbols', async () => {
    const r = await generatePassword({ length: 16, symbols: false, digits: true });
    expect(/[^A-Za-z0-9]/.test(r.password)).toBe(false);
  });
});

describe('scorePassword / reuse', () => {
  test('common passwords are weak', () => {
    const s = scorePassword('password');
    expect(s.score).toBeLessThanOrEqual(1);
    expect(isWeakScore(s.score)).toBe(true);
  });

  test('long mixed password scores high', () => {
    const s = scorePassword('Tr0ub4dor&3-Extra-Length!');
    expect(s.score).toBeGreaterThanOrEqual(3);
  });

  test('findReusedSecrets marks duplicates', () => {
    const reused = findReusedSecrets([
      { id: 'a', secret: 'same' },
      { id: 'b', secret: 'same' },
      { id: 'c', secret: 'other' },
    ]);
    expect(reused.has('a')).toBe(true);
    expect(reused.has('b')).toBe(true);
    expect(reused.has('c')).toBe(false);
  });
});
