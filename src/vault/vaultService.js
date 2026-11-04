/**
 * ZAO credential vault.
 *
 * Secrets live ONLY in expo-secure-store (Keychain / Keystore).
 * SQLite holds non-secret metadata: id, type, title, website, username,
 * tags, timestamps, connector linkage. Secrets never go to logs, activity
 * spans, or the memory system.
 *
 * Connector tokens (e.g. GitHub) are mirrored as managed items in a
 * "Connector tokens" group; the authoritative secret for GitHub tools
 * remains the existing api_keys SecureStore entry (storeApiKey/getApiKey).
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { getDb } from '../db/database';
import { getApiKey, storeApiKey, deleteApiKey } from '../db/database';
import { scorePassword, findReusedSecrets, isWeakScore } from './strength';
import { requireVaultUnlock, touchVaultActivity, getVaultLockState } from './vaultAuth';

export const VAULT_ITEM_TYPES = ['login', 'api_key', 'secure_note', 'ssh_key', 'connector_token', 'authenticator', 'wifi', 'identity'];

const SECRET_PREFIX = 'zao_vault_secret_';

function secretKey(id) {
  return `${SECRET_PREFIX}${id}`;
}

async function ensureVaultTable() {
  const db = await getDb();
  if (!db) throw new Error('DB_OPEN_FAILED');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS vault_items (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      website TEXT,
      username TEXT,
      tags TEXT,
      connector_id TEXT,
      managed_by_connector INTEGER DEFAULT 0,
      has_totp INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_vault_items_type ON vault_items(type);`);
  await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_vault_items_updated ON vault_items(updated_at);`);
  await ensureVaultExtraColumns(db);
  return db;
}

async function ensureVaultExtraColumns(db) {
  try {
    const cols = await db.getAllAsync(`PRAGMA table_info(vault_items)`);
    const names = new Set((cols || []).map((c) => c.name));
    if (!names.has('pinned')) await db.execAsync(`ALTER TABLE vault_items ADD COLUMN pinned INTEGER DEFAULT 0`);
    if (!names.has('sort_order')) await db.execAsync(`ALTER TABLE vault_items ADD COLUMN sort_order INTEGER DEFAULT 0`);
    if (!names.has('issuer')) await db.execAsync(`ALTER TABLE vault_items ADD COLUMN issuer TEXT`);
  } catch (_) { /* older mocks */ }
}

function rowToMeta(row) {
  if (!row) return null;
  let tags = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch (_) { tags = []; }
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    website: row.website || null,
    username: row.username || null,
    tags,
    connectorId: row.connector_id || null,
    managedByConnector: !!row.managed_by_connector,
    hasTotp: !!row.has_totp,
    pinned: !!row.pinned,
    sortOrder: row.sort_order || 0,
    issuer: row.issuer || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Secret payload shapes (JSON in SecureStore):
 *  login:           { password, totpSecret? }
 *  api_key:         { token }
 *  secure_note:     { body }
 *  ssh_key:         { privateKey, publicKey?, passphrase? }
 *  connector_token: { token, scopes?, login?, name?, avatarUrl? }  // managed
 *  authenticator:   { secret, algorithm?, digits?, period?, counter?, otpType? }
 *  wifi:            { ssid, password, security? }
 *  identity:        { fullName?, email?, phone?, address?, notes? }
 */
async function writeSecret(id, payload) {
  await SecureStore.setItemAsync(secretKey(id), JSON.stringify(payload));
}

async function readSecret(id) {
  const raw = await SecureStore.getItemAsync(secretKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function deleteSecret(id) {
  try { await SecureStore.deleteItemAsync(secretKey(id)); } catch (_) { /* already gone */ }
}

async function newId() {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return `v_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

/** List metadata only (never secrets). */
export async function listVaultItems({ type, query, includeConnectorManaged = true } = {}) {
  const db = await ensureVaultTable();
  let rows = await db.getAllAsync(`SELECT * FROM vault_items ORDER BY updated_at DESC`);
  let items = rows.map(rowToMeta);
  if (!includeConnectorManaged) items = items.filter((i) => !i.managedByConnector);
  if (type && type !== 'all') items = items.filter((i) => i.type === type);
  const q = String(query || '').trim().toLowerCase();
  if (q) {
    items = items.filter((i) =>
      (i.title || '').toLowerCase().includes(q)
      || (i.username || '').toLowerCase().includes(q)
      || (i.website || '').toLowerCase().includes(q)
      || (i.tags || []).some((t) => String(t).toLowerCase().includes(q))
    );
  }
  return { success: true, data: items };
}

export async function getVaultItemMeta(id) {
  const db = await ensureVaultTable();
  const row = await db.getFirstAsync(`SELECT * FROM vault_items WHERE id = ?`, [id]);
  return { success: true, data: rowToMeta(row) };
}

/**
 * Reveal secret — requires unlock. Never logs the value.
 */
export async function revealVaultSecret(id, { reason } = {}) {
  const auth = await requireVaultUnlock({ reason: reason || 'Reveal vault secret' });
  if (!auth.success) return { success: false, error: auth.error || 'locked', data: null };
  touchVaultActivity();
  const secret = await readSecret(id);
  if (!secret) return { success: false, error: 'NOT_FOUND', data: null };
  return { success: true, data: secret };
}

export async function createVaultItem({ type, title, website, username, tags, secret, connectorId, managedByConnector, hasTotp, issuer, pinned }) {
  if (!VAULT_ITEM_TYPES.includes(type)) return { success: false, error: 'INVALID_TYPE' };
  if (!title || !String(title).trim()) return { success: false, error: 'TITLE_REQUIRED' };
  if (!secret || typeof secret !== 'object') return { success: false, error: 'SECRET_REQUIRED' };

  const id = await newId();
  const now = Date.now();
  await writeSecret(id, secret);
  const db = await ensureVaultTable();
  await ensureVaultExtraColumns(db);
  await db.runAsync(
    `INSERT INTO vault_items (id, type, title, website, username, tags, connector_id, managed_by_connector, has_totp, created_at, updated_at, pinned, sort_order, issuer)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, type, String(title).trim(), website || null, username || null,
      JSON.stringify(tags || []), connectorId || null, managedByConnector ? 1 : 0,
      hasTotp || secret.totpSecret || type === 'authenticator' ? 1 : 0, now, now,
      pinned ? 1 : 0, 0, issuer || null,
    ]
  );
  return getVaultItemMeta(id);
}

export async function updateVaultItem(id, { title, website, username, tags, secret, hasTotp }) {
  const existing = await getVaultItemMeta(id);
  if (!existing.data) return { success: false, error: 'NOT_FOUND' };
  if (existing.data.managedByConnector && secret) {
    return { success: false, error: 'MANAGED_BY_CONNECTOR' };
  }
  const db = await ensureVaultTable();
  const now = Date.now();
  if (secret) await writeSecret(id, secret);
  await db.runAsync(
    `UPDATE vault_items SET title = ?, website = ?, username = ?, tags = ?, has_totp = ?, updated_at = ? WHERE id = ?`,
    [
      title != null ? String(title).trim() : existing.data.title,
      website !== undefined ? website : existing.data.website,
      username !== undefined ? username : existing.data.username,
      JSON.stringify(tags !== undefined ? tags : existing.data.tags),
      hasTotp != null ? (hasTotp ? 1 : 0) : (existing.data.hasTotp ? 1 : 0),
      now, id,
    ]
  );
  return getVaultItemMeta(id);
}

export async function deleteVaultItem(id) {
  const meta = await getVaultItemMeta(id);
  if (!meta.data) return { success: false, error: 'NOT_FOUND' };
  if (meta.data.managedByConnector) {
    return { success: false, error: 'MANAGED_BY_CONNECTOR', message: 'Disconnect the connector instead.' };
  }
  await deleteSecret(id);
  const db = await ensureVaultTable();
  await db.runAsync(`DELETE FROM vault_items WHERE id = ?`, [id]);
  return { success: true };
}

/**
 * Security summary for the vault hero card. Reveals secrets only after unlock
 * to score weakness / reuse — callers must already be unlocked or we skip
 * secret-dependent checks.
 */
export async function getVaultSecuritySummary() {
  const listed = await listVaultItems({ includeConnectorManaged: true });
  const items = listed.data || [];
  const summary = {
    total: items.length,
    byType: {},
    weakCount: 0,
    reusedCount: 0,
    connectorManaged: items.filter((i) => i.managedByConnector).length,
    unlocked: getVaultLockState().unlocked,
  };
  for (const it of items) summary.byType[it.type] = (summary.byType[it.type] || 0) + 1;

  if (!summary.unlocked) return { success: true, data: summary };

  const withSecrets = [];
  for (const it of items) {
    if (it.type !== 'login' && it.type !== 'api_key') continue;
    const secret = await readSecret(it.id);
    if (!secret) continue;
    const value = secret.password || secret.token || '';
    if (value) {
      const scored = scorePassword(value);
      if (isWeakScore(scored.score)) summary.weakCount += 1;
      withSecrets.push({ id: it.id, secret: value });
    }
  }
  summary.reusedCount = findReusedSecrets(withSecrets).size;
  return { success: true, data: summary };
}

/**
 * Upsert the GitHub connector_token vault item after a successful connect.
 * Keeps api_keys ('github') as the tool-facing source of truth.
 */
export async function syncGithubConnectorVaultItem(account) {
  const db = await ensureVaultTable();
  const existing = await db.getFirstAsync(
    `SELECT * FROM vault_items WHERE connector_id = ? AND managed_by_connector = 1`,
    ['github']
  );
  const secret = {
    token: account.token,
    scopes: account.scopes || null,
    login: account.login || null,
    name: account.name || null,
    avatarUrl: account.avatarUrl || null,
  };
  const title = account.login ? `GitHub · ${account.login}` : 'GitHub';
  const now = Date.now();
  if (existing) {
    await writeSecret(existing.id, secret);
    await db.runAsync(
      `UPDATE vault_items SET title = ?, username = ?, updated_at = ? WHERE id = ?`,
      [title, account.login || null, now, existing.id]
    );
    return getVaultItemMeta(existing.id);
  }
  return createVaultItem({
    type: 'connector_token',
    title,
    username: account.login || null,
    website: 'https://github.com',
    tags: ['connector', 'github'],
    connectorId: 'github',
    managedByConnector: true,
    secret,
  });
}

export async function removeGithubConnectorVaultItem() {
  const db = await ensureVaultTable();
  const existing = await db.getFirstAsync(
    `SELECT * FROM vault_items WHERE connector_id = ? AND managed_by_connector = 1`,
    ['github']
  );
  if (!existing) return { success: true };
  await deleteSecret(existing.id);
  await db.runAsync(`DELETE FROM vault_items WHERE id = ?`, [existing.id]);
  return { success: true };
}

/**
 * Migrate any legacy plaintext api_keys.key_value leftovers into SecureStore
 * (no-op when already migrated) and ensure a vault connector item exists when
 * a GitHub token is configured.
 */
export async function migrateGithubTokenIntoVault(username) {
  const key = await getApiKey('github');
  const token = key?.data?.key_value;
  if (!token) return { success: true, migrated: false };
  // Re-write through storeApiKey to guarantee SecureStore residency.
  await storeApiKey('github', token, true);
  await syncGithubConnectorVaultItem({
    token,
    login: username || key?.data?.username || null,
    scopes: null,
  });
  return { success: true, migrated: true };
}

/** Convenience: read the GitHub token for tools (unchanged path). */
export async function getGithubTokenFromVault() {
  const key = await getApiKey('github');
  return key?.data?.key_value || null;
}


/** Authenticator items only (type=authenticator), pinned first. */
export async function listAuthenticatorItems({ query } = {}) {
  const listed = await listVaultItems({ type: 'authenticator', query });
  const items = (listed.data || []).slice().sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
    return (a.sortOrder || 0) - (b.sortOrder || 0) || (b.updatedAt - a.updatedAt);
  });
  return { success: true, data: items };
}

export async function setVaultItemPinned(id, pinned) {
  const db = await ensureVaultTable();
  await ensureVaultExtraColumns(db);
  await db.runAsync(`UPDATE vault_items SET pinned = ?, updated_at = ? WHERE id = ?`, [pinned ? 1 : 0, Date.now(), id]);
  return getVaultItemMeta(id);
}

export async function reorderVaultItems(orderedIds) {
  const db = await ensureVaultTable();
  await ensureVaultExtraColumns(db);
  const now = Date.now();
  for (let i = 0; i < orderedIds.length; i += 1) {
    await db.runAsync(`UPDATE vault_items SET sort_order = ?, updated_at = ? WHERE id = ?`, [i, now, orderedIds[i]]);
  }
  return { success: true };
}

export async function bumpAuthenticatorCounter(id) {
  const meta = await getVaultItemMeta(id);
  if (!meta.data || meta.data.type !== 'authenticator') return { success: false, error: 'NOT_FOUND' };
  const auth = await requireVaultUnlock({ reason: 'Advance HOTP counter' });
  if (!auth.success) return { success: false, error: auth.error || 'locked' };
  const secret = await readSecret(id);
  if (!secret || secret.otpType !== 'hotp') return { success: false, error: 'NOT_HOTP' };
  secret.counter = (Number(secret.counter) || 0) + 1;
  await writeSecret(id, secret);
  const db = await ensureVaultTable();
  await db.runAsync(`UPDATE vault_items SET updated_at = ? WHERE id = ?`, [Date.now(), id]);
  return { success: true, data: { counter: secret.counter } };
}

export { getApiKey, storeApiKey, deleteApiKey };

