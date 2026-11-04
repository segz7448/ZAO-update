/**
 * Parse password-manager CSV exports (Chrome/Google, 1Password, Bitwarden, LastPass).
 * Columns normalized to: url, username, password, name, notes, totp (optional).
 */

const HEADER_ALIASES = {
  url: ['url', 'login uri', 'uri', 'web site', 'website', 'login url', 'origin'],
  username: ['username', 'login username', 'user', 'login', 'email', 'user name', 'account'],
  password: ['password', 'login password', 'pass', 'passwd'],
  name: ['name', 'title', 'login name', 'account name', 'label'],
  notes: ['notes', 'note', 'comments', 'extra', 'remark'],
  totp: ['totp', 'login totp', 'otpauth', 'otp', 'one-time password', '2fa', 'twofactorsecret', 'totp secret'],
};

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function mapHeaders(headers) {
  const map = {};
  const norm = headers.map(normalizeHeader);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = norm.findIndex((h) => aliases.includes(h));
    if (idx >= 0) map[field] = idx;
  }
  return map;
}

/** Minimal RFC4180-ish CSV split (handles quotes and commas). */
export function parseCsvRows(text) {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let inQuotes = false;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuotes = false; i += 1; continue;
      }
      cell += ch; i += 1; continue;
    }
    if (ch === '"') { inQuotes = true; i += 1; continue; }
    if (ch === ',') { row.push(cell); cell = ''; i += 1; continue; }
    if (ch === '\n') {
      row.push(cell); cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = []; i += 1; continue;
    }
    if (ch === '\r') { i += 1; continue; }
    cell += ch; i += 1;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.length > 1 || row[0] !== '') rows.push(row);
  }
  return rows;
}

function detectFormat(headers) {
  const n = headers.map(normalizeHeader);
  if (n.includes('login uri') || n.includes('login username')) return 'bitwarden';
  if (n.includes('title') && n.includes('url') && n.includes('username')) return '1password';
  if (n.includes('name') && n.includes('url') && n.includes('username') && n.includes('password')) {
    if (n.includes('extra') || n.includes('grouping')) return 'lastpass';
    return 'chrome';
  }
  if (n.includes('origin') && n.includes('username') && n.includes('password')) return 'chrome';
  return 'generic';
}

/**
 * @returns {{
 *   success: boolean,
 *   error?: string,
 *   format?: string,
 *   items?: Array<{
 *     name: string, url: string, username: string, password: string,
 *     notes: string, totp: string|null, selected: boolean
 *   }>
 * }}
 */
export function parsePasswordCsv(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return { success: false, error: 'EMPTY_CSV' };
  const headers = rows[0];
  const map = mapHeaders(headers);
  if (map.password == null && map.username == null && map.url == null) {
    return { success: false, error: 'UNRECOGNIZED_HEADERS' };
  }
  const format = detectFormat(headers);
  const items = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cols = rows[r];
    const get = (field) => {
      const idx = map[field];
      if (idx == null) return '';
      return String(cols[idx] ?? '').trim();
    };
    const url = get('url');
    const username = get('username');
    const password = get('password');
    const name = get('name') || url || username || `Item ${r}`;
    const notes = get('notes');
    const totp = get('totp') || null;
    if (!url && !username && !password && !notes) continue;
    items.push({
      name,
      url,
      username,
      password,
      notes,
      totp: totp || null,
      selected: true,
      row: r,
    });
  }
  if (!items.length) return { success: false, error: 'NO_ROWS' };
  return { success: true, format, items };
}

export function importSelectionSummary(items) {
  const selected = (items || []).filter((i) => i.selected);
  return {
    total: (items || []).length,
    selected: selected.length,
    withTotp: selected.filter((i) => i.totp).length,
  };
}
