/**
 * Crypto-secure password generator (expo-crypto getRandomBytesAsync).
 */
import * as Crypto from 'expo-crypto';
import { scorePassword } from './strength';

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';

/**
 * @param {{ length?: number, lower?: boolean, upper?: boolean, digits?: boolean, symbols?: boolean }} [opts]
 */
export async function generatePassword(opts = {}) {
  const length = Math.max(4, Math.min(128, opts.length ?? 20));
  let alphabet = '';
  if (opts.lower !== false) alphabet += LOWER;
  if (opts.upper !== false) alphabet += UPPER;
  if (opts.digits !== false) alphabet += DIGITS;
  if (opts.symbols) alphabet += SYMBOLS;
  if (!alphabet) alphabet = LOWER + UPPER + DIGITS;

  const bytes = await Crypto.getRandomBytesAsync(length * 2);
  let password = '';
  for (let i = 0; password.length < length; i += 1) {
    const b = bytes[i % bytes.length];
    // Rejection sampling to avoid modulo bias.
    if (b >= 256 - (256 % alphabet.length)) continue;
    password += alphabet[b % alphabet.length];
  }

  // Guarantee at least one of each selected class when length allows.
  const required = [];
  if (opts.lower !== false) required.push(LOWER);
  if (opts.upper !== false) required.push(UPPER);
  if (opts.digits !== false) required.push(DIGITS);
  if (opts.symbols) required.push(SYMBOLS);
  const chars = password.split('');
  for (let i = 0; i < required.length && i < chars.length; i += 1) {
    const set = required[i];
    const rb = await Crypto.getRandomBytesAsync(2);
    chars[i] = set[rb[0] % set.length];
  }
  // Shuffle
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const rb = await Crypto.getRandomBytesAsync(1);
    const j = rb[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  password = chars.join('');
  const strength = scorePassword(password);
  const entropyBits = Math.log2(alphabet.length) * length;
  return { password, strength, entropyBits, alphabetSize: alphabet.length, length };
}
