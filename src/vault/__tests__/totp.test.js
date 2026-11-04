import { totp, hotp, base32Decode, totpProgress } from '../totp';

/** RFC 6238 Appendix B seed (ASCII). */
const SEED20 = Uint8Array.from(Buffer.from('12345678901234567890', 'ascii'));
const SEED32 = Uint8Array.from(Buffer.from('12345678901234567890123456789012', 'ascii'));
const SEED64 = Uint8Array.from(Buffer.from('1234567890123456789012345678901234567890123456789012345678901234', 'ascii'));

describe('RFC 6238 TOTP vectors (SHA-1, 8 digits)', () => {
  const cases = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [now, expected] of cases) {
    test(`T=${now} → ${expected}`, async () => {
      const r = await totp(SEED20, { now, digits: 8, algorithm: 'SHA1', step: 30 });
      expect(r.code).toBe(expected);
    });
  }
});

describe('RFC 6238 TOTP vectors (SHA-256 / SHA-512)', () => {
  test('SHA-256 at T=59', async () => {
    const r = await totp(SEED32, { now: 59, digits: 8, algorithm: 'SHA256', step: 30 });
    expect(r.code).toBe('46119246');
  });
  test('SHA-512 at T=59', async () => {
    const r = await totp(SEED64, { now: 59, digits: 8, algorithm: 'SHA512', step: 30 });
    expect(r.code).toBe('90693936');
  });
});

describe('helpers', () => {
  test('base32Decode ignores padding/spaces', () => {
    const a = base32Decode('MFRGG');
    const b = base32Decode('mf rg g===');
    expect(Array.from(a)).toEqual(Array.from(b));
  });
  test('totpProgress clamps', () => {
    expect(totpProgress(15, 30)).toBeCloseTo(0.5);
    expect(totpProgress(-1, 30)).toBe(0);
    expect(totpProgress(40, 30)).toBe(1);
  });
});
