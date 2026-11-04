/**
 * otpauth:// URI parser for TOTP and HOTP (Google Authenticator style).
 * Handles URL-encoding, issuer query vs label-prefix rules, algorithm,
 * digits, period, and HOTP counter.
 */
import { base32Decode } from './totp';

const ALGO_MAP = {
  SHA1: 'SHA1',
  'SHA-1': 'SHA1',
  SHA256: 'SHA256',
  'SHA-256': 'SHA256',
  SHA512: 'SHA512',
  'SHA-512': 'SHA512',
};

/**
 * Validate a Base32 secret without throwing (returns { ok, error? }).
 */
export function validateBase32Secret(secret) {
  try {
    const cleaned = String(secret || '').toUpperCase().replace(/[\s=]+/g, '');
    if (!cleaned) return { ok: false, error: 'SECRET_REQUIRED' };
    if (!/^[A-Z2-7]+$/.test(cleaned)) return { ok: false, error: 'INVALID_BASE32' };
    if (cleaned.length < 8) return { ok: false, error: 'SECRET_TOO_SHORT' };
    base32Decode(cleaned);
    return { ok: true, secret: cleaned };
  } catch (e) {
    return { ok: false, error: 'INVALID_BASE32' };
  }
}

/**
 * Parse an otpauth://totp/... or otpauth://hotp/... URI.
 * @returns {{
 *   success: boolean,
 *   error?: string,
 *   data?: {
 *     type: 'totp'|'hotp',
 *     label: string,
 *     account: string,
 *     issuer: string|null,
 *     secret: string,
 *     algorithm: 'SHA1'|'SHA256'|'SHA512',
 *     digits: 6|8,
 *     period: number,
 *     counter: number|null,
 *   }
 * }}
 */
export function parseOtpAuthUri(uri) {
  const raw = String(uri || '').trim();
  if (!raw) return { success: false, error: 'EMPTY_URI' };

  let url;
  try {
    url = new URL(raw);
  } catch (_) {
    return { success: false, error: 'INVALID_URI' };
  }

  if (url.protocol !== 'otpauth:') {
    return { success: false, error: 'NOT_OTPAUTH' };
  }

  const type = (url.hostname || url.host || '').toLowerCase();
  if (type !== 'totp' && type !== 'hotp') {
    return { success: false, error: 'UNSUPPORTED_TYPE' };
  }

  // Path is /Label — may be URL-encoded; strip leading slash
  let labelPath = url.pathname || '';
  if (labelPath.startsWith('/')) labelPath = labelPath.slice(1);
  let labelDecoded = '';
  try {
    labelDecoded = decodeURIComponent(labelPath);
  } catch (_) {
    labelDecoded = labelPath;
  }

  const params = url.searchParams;
  const secretRaw = params.get('secret') || '';
  const secretCheck = validateBase32Secret(secretRaw);
  if (!secretCheck.ok) return { success: false, error: secretCheck.error || 'INVALID_SECRET' };

  let issuerParam = params.get('issuer');
  if (issuerParam) {
    try { issuerParam = decodeURIComponent(issuerParam); } catch (_) { /* keep */ }
  }

  // Label rules: "Issuer:account" or just "account"
  let account = labelDecoded;
  let issuerFromLabel = null;
  const colon = labelDecoded.indexOf(':');
  if (colon > 0) {
    issuerFromLabel = labelDecoded.slice(0, colon).trim();
    account = labelDecoded.slice(colon + 1).trim();
  }

  // Prefer query issuer; fall back to label prefix
  const issuer = (issuerParam && issuerParam.trim()) || issuerFromLabel || null;

  const algoRaw = (params.get('algorithm') || 'SHA1').toUpperCase();
  const algorithm = ALGO_MAP[algoRaw] || ALGO_MAP[algoRaw.replace('-', '')] || null;
  if (!algorithm) return { success: false, error: 'INVALID_ALGORITHM' };

  const digits = Number(params.get('digits') || 6);
  if (digits !== 6 && digits !== 8) return { success: false, error: 'INVALID_DIGITS' };

  let period = Number(params.get('period') || 30);
  if (!Number.isFinite(period) || period <= 0) period = 30;
  if (period !== 30 && period !== 60 && type === 'totp') {
    // Allow other positive periods but prefer 30/60
    if (period < 1 || period > 300) return { success: false, error: 'INVALID_PERIOD' };
  }

  let counter = null;
  if (type === 'hotp') {
    const c = params.get('counter');
    if (c == null || c === '') return { success: false, error: 'COUNTER_REQUIRED' };
    counter = Number(c);
    if (!Number.isFinite(counter) || counter < 0) return { success: false, error: 'INVALID_COUNTER' };
  }

  return {
    success: true,
    data: {
      type,
      label: labelDecoded || (issuer ? `${issuer}:${account}` : account),
      account: account || labelDecoded || 'Account',
      issuer,
      secret: secretCheck.secret,
      algorithm,
      digits,
      period: type === 'totp' ? period : 30,
      counter,
    },
  };
}

/**
 * Build an otpauth:// URI from structured fields (for QR export).
 */
export function buildOtpAuthUri({
  type = 'totp',
  account,
  issuer,
  secret,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  counter = 0,
} = {}) {
  const secretCheck = validateBase32Secret(secret);
  if (!secretCheck.ok) throw new Error(secretCheck.error);
  const label = issuer
    ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account || 'Account')}`
    : encodeURIComponent(account || 'Account');
  const params = new URLSearchParams();
  params.set('secret', secretCheck.secret);
  if (issuer) params.set('issuer', issuer);
  if (algorithm && algorithm !== 'SHA1') params.set('algorithm', algorithm);
  if (digits && digits !== 6) params.set('digits', String(digits));
  if (type === 'totp' && period && period !== 30) params.set('period', String(period));
  if (type === 'hotp') params.set('counter', String(counter || 0));
  return `otpauth://${type}/${label}?${params.toString()}`;
}
