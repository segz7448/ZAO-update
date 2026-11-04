/**
 * Lightweight password strength scoring + reuse detection helpers.
 * Not a substitute for zxcvbn; good enough for an in-vault badge.
 */

const COMMON = new Set([
  'password', 'password1', '123456', '12345678', 'qwerty', 'abc123',
  'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon',
  'login', 'princess', 'football', 'baseball', 'starwars', 'passw0rd',
]);

/**
 * @param {string} password
 * @returns {{ score: 0|1|2|3|4, label: 'very weak'|'weak'|'fair'|'strong'|'excellent', tips: string[] }}
 */
export function scorePassword(password) {
  const p = String(password || '');
  const tips = [];
  let score = 0;
  if (p.length >= 8) score += 1; else tips.push('Use at least 8 characters');
  if (p.length >= 12) score += 1;
  if (p.length >= 16) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1; else tips.push('Mix upper and lower case');
  if (/\d/.test(p)) score += 1; else tips.push('Add a digit');
  if (/[^A-Za-z0-9]/.test(p)) score += 1; else tips.push('Add a symbol');

  // Penalize commons / repeats
  if (COMMON.has(p.toLowerCase())) {
    score = Math.min(score, 1);
    tips.push('This password is commonly used');
  }
  if (/(.)\1{3,}/.test(p)) {
    score = Math.max(0, score - 1);
    tips.push('Avoid repeated characters');
  }
  if (/^(0123|1234|2345|3456|4567|5678|6789|abcd|qwer)/i.test(p)) {
    score = Math.max(0, score - 1);
    tips.push('Avoid sequential patterns');
  }

  const clamped = Math.max(0, Math.min(4, score <= 1 ? 0 : score === 2 ? 1 : score === 3 ? 2 : score === 4 ? 3 : 4));
  // Remap raw points (0..6ish) into 0..4
  let band;
  if (score <= 1) band = 0;
  else if (score === 2) band = 1;
  else if (score === 3) band = 2;
  else if (score === 4) band = 3;
  else band = 4;

  const labels = ['very weak', 'weak', 'fair', 'strong', 'excellent'];
  return { score: /** @type {0|1|2|3|4} */ (band), label: labels[band], tips: tips.slice(0, 3) };
}

/** True when the same secret value appears more than once among items. */
export function findReusedSecrets(itemsWithSecrets) {
  const seen = new Map();
  const reusedIds = new Set();
  for (const item of itemsWithSecrets || []) {
    const secret = item?.secret;
    if (!secret || typeof secret !== 'string') continue;
    const key = `v:${secret}`;
    if (seen.has(key)) {
      reusedIds.add(item.id);
      reusedIds.add(seen.get(key));
    } else {
      seen.set(key, item.id);
    }
  }
  return reusedIds;
}

export function isWeakScore(score) {
  return score <= 1;
}
