/**
 * RFC 6238 TOTP (HMAC-SHA1 / SHA256 / SHA512) implemented locally.
 * Uses expo-crypto for HMAC. Tested against RFC 6238 Appendix B vectors.
 */
import * as Crypto from 'expo-crypto';

const ALGO = {
  SHA1: Crypto.CryptoDigestAlgorithm.SHA1,
  'SHA-1': Crypto.CryptoDigestAlgorithm.SHA1,
  SHA256: Crypto.CryptoDigestAlgorithm.SHA256,
  'SHA-256': Crypto.CryptoDigestAlgorithm.SHA256,
  SHA512: Crypto.CryptoDigestAlgorithm.SHA512,
  'SHA-512': Crypto.CryptoDigestAlgorithm.SHA512,
};

/** Base32 (RFC 4648) decode → Uint8Array. Ignores spaces/padding. */
export function base32Decode(input) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = String(input || '').toUpperCase().replace(/[\s=]+/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (let i = 0; i < cleaned.length; i += 1) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx < 0) throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

/** Counter as 8-byte big-endian. */
export function counterToBytes(counter) {
  const buf = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i -= 1) {
    buf[i] = Number(c & 0xffn);
    c >>= 8n;
  }
  return buf;
}

/**
 * HMAC via expo-crypto.digestStringAsync is hex-of-message only; for HMAC we
 * implement the standard ipad/opad construction on top of digest.
 */
async function hmac(algorithm, keyBytes, messageBytes) {
  const algo = ALGO[algorithm] || Crypto.CryptoDigestAlgorithm.SHA1;
  const blockSize = algorithm.includes('512') ? 128 : 64;
  let key = keyBytes;
  if (key.length > blockSize) {
    const hashed = await Crypto.digestStringAsync(algo, toHex(key), { encoding: Crypto.CryptoEncoding.HEX });
    // digestStringAsync digests the UTF-8 of the hex string — wrong for binary.
    // Use a manual SHA via digest of latin1 workaround: prefer byte API if present.
  }
  // Prefer digestAsync (byte-oriented) when available in this Expo version.
  if (typeof Crypto.digest === 'function' || typeof Crypto.getRandomBytesAsync === 'function') {
    // Implement HMAC with WebCrypto-like subtle if available, else polyfill below.
  }
  return hmacShaPolyfill(algorithm, keyBytes, messageBytes);
}

/**
 * Pure JS HMAC using expo-crypto's digestStringAsync on binary encoded as
 * a latin1-safe path is unreliable. We ship a minimal SHA-1/256/512 via
 * the Web Crypto SubtleCrypto path when present, else a compact SHA-1
 * implementation sufficient for TOTP (RFC vectors use SHA-1/256/512).
 */
async function hmacShaPolyfill(algorithm, keyBytes, messageBytes) {
  if (globalThis.crypto?.subtle?.importKey) {
    const name = algorithm.includes('512') ? 'SHA-512' : algorithm.includes('256') ? 'SHA-256' : 'SHA-1';
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name } },
      false,
      ['sign']
    );
    const sig = await globalThis.crypto.subtle.sign('HMAC', key, messageBytes);
    return new Uint8Array(sig);
  }
  // Fallback: SHA-1 only (enough for typical authenticator secrets).
  if (!algorithm.includes('256') && !algorithm.includes('512')) {
    return hmacSha1(keyBytes, messageBytes);
  }
  throw new Error(`HMAC ${algorithm} requires Web Crypto SubtleCrypto`);
}

/* --- Minimal SHA-1 + HMAC-SHA1 (for Jest / environments without subtle) --- */
function sha1(bytes) {
  const ml = bytes.length;
  const withOne = new Uint8Array(((ml + 9 + 63) >> 6) << 6);
  withOne.set(bytes);
  withOne[ml] = 0x80;
  const bitLen = ml * 8;
  const view = new DataView(withOne.buffer);
  view.setUint32(withOne.length - 4, bitLen >>> 0);
  view.setUint32(withOne.length - 8, Math.floor(bitLen / 0x100000000));

  let h0 = 0x67452301, h1 = 0xEFCDAB89, h2 = 0x98BADCFE, h3 = 0x10325476, h4 = 0xC3D2E1F0;
  const w = new Uint32Array(80);
  for (let i = 0; i < withOne.length; i += 64) {
    for (let j = 0; j < 16; j += 1) w[j] = view.getUint32(i + j * 4);
    for (let j = 16; j < 80; j += 1) {
      const x = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
      w[j] = (x << 1) | (x >>> 31);
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4;
    for (let j = 0; j < 80; j += 1) {
      let f, k;
      if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
      else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
      else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
      else { f = b ^ c ^ d; k = 0xCA62C1D6; }
      const temp = ((a << 5) | (a >>> 27)) + f + e + k + w[j];
      e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp >>> 0;
    }
    h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0; h4 = (h4 + e) >>> 0;
  }
  const out = new Uint8Array(20);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, h0); ov.setUint32(4, h1); ov.setUint32(8, h2);
  ov.setUint32(12, h3); ov.setUint32(16, h4);
  return out;
}

function hmacSha1(keyBytes, messageBytes) {
  const block = 64;
  let key = keyBytes;
  if (key.length > block) key = sha1(key);
  const k = new Uint8Array(block);
  k.set(key);
  const ipad = new Uint8Array(block);
  const opad = new Uint8Array(block);
  for (let i = 0; i < block; i += 1) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  const inner = new Uint8Array(block + messageBytes.length);
  inner.set(ipad); inner.set(messageBytes, block);
  const innerHash = sha1(inner);
  const outer = new Uint8Array(block + innerHash.length);
  outer.set(opad); outer.set(innerHash, block);
  return sha1(outer);
}

/**
 * HOTP (RFC 4226) → digit string.
 * @param {Uint8Array} key
 * @param {number|bigint} counter
 * @param {{ digits?: number, algorithm?: string }} [opts]
 */
export async function hotp(key, counter, opts = {}) {
  const digits = opts.digits || 8;
  const algorithm = opts.algorithm || 'SHA1';
  const hs = await hmacShaPolyfill(algorithm, key, counterToBytes(counter));
  const offset = hs[hs.length - 1] & 0x0f;
  const bin = ((hs[offset] & 0x7f) << 24)
    | ((hs[offset + 1] & 0xff) << 16)
    | ((hs[offset + 2] & 0xff) << 8)
    | (hs[offset + 3] & 0xff);
  const mod = 10 ** digits;
  const code = bin % mod;
  return String(code).padStart(digits, '0');
}

/**
 * TOTP (RFC 6238).
 * @param {string|Uint8Array} secret  base32 string or raw bytes
 * @param {{ now?: number, step?: number, digits?: number, algorithm?: string }} [opts]
 */
export async function totp(secret, opts = {}) {
  const step = opts.step || 30;
  const now = opts.now != null ? opts.now : Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / step);
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const code = await hotp(key, counter, opts);
  const age = now % step;
  return {
    code,
    remaining: step - age,
    step,
    counter,
  };
}

/** Fraction 0..1 of the current step remaining (for countdown rings). */
export function totpProgress(remaining, step = 30) {
  return Math.max(0, Math.min(1, remaining / step));
}
