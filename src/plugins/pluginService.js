/**
 * Installed plugins — SQLite metadata. Secrets never stored here.
 * Ownership: created plugins stay private to ownerId. Shared installs
 * are source='shared' and read-only (instructions).
 */
import * as Crypto from 'expo-crypto';
import { getDb } from '../db/database';
import { validatePluginManifest } from './schema';
import { PLUGIN_TEMPLATES } from './catalog';
import { getOrCreateOwnerId } from './ownerId';

async function ensurePluginsTable() {
  const db = await getDb();
  if (!db) throw new Error('DB_OPEN_FAILED');
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      instructions TEXT NOT NULL,
      required_connectors TEXT,
      allowed_tools TEXT,
      triggers TEXT,
      example_prompts TEXT,
      enabled INTEGER DEFAULT 1,
      usage_count INTEGER DEFAULT 0,
      source TEXT,
      template_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // Ownership / share columns (idempotent ALTERs)
  const alters = [
    'ALTER TABLE plugins ADD COLUMN owner_id TEXT',
    'ALTER TABLE plugins ADD COLUMN allow_reshare INTEGER DEFAULT 0',
    'ALTER TABLE plugins ADD COLUMN share_token TEXT',
    'ALTER TABLE plugins ADD COLUMN shared_from_token TEXT',
    'ALTER TABLE plugins ADD COLUMN permissions TEXT',
    'ALTER TABLE plugins ADD COLUMN install_stats TEXT',
  ];
  for (const sql of alters) {
    try { await db.execAsync(sql); } catch (_) { /* already exists */ }
  }
  return db;
}

function rowToPlugin(row) {
  if (!row) return null;
  const parse = (v, fallback) => {
    try { return v ? JSON.parse(v) : fallback; } catch (_) { return fallback; }
  };
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    description: row.description || '',
    instructions: row.instructions,
    requiredConnectors: parse(row.required_connectors, []),
    allowedTools: parse(row.allowed_tools, []),
    triggers: parse(row.triggers, [{ type: 'manual' }]),
    examplePrompts: parse(row.example_prompts, []),
    permissions: parse(row.permissions, []),
    enabled: !!row.enabled,
    usageCount: row.usage_count || 0,
    source: row.source || 'custom',
    templateId: row.template_id || null,
    ownerId: row.owner_id || null,
    allowReshare: !!row.allow_reshare,
    shareToken: row.share_token || null,
    sharedFromToken: row.shared_from_token || null,
    installStats: parse(row.install_stats, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readOnly: row.source === 'shared',
  };
}

async function newId() {
  const bytes = await Crypto.getRandomBytesAsync(12);
  return `plg_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function listPlugins({ source } = {}) {
  const db = await ensurePluginsTable();
  let rows;
  if (source) {
    rows = await db.getAllAsync(`SELECT * FROM plugins WHERE source = ? ORDER BY updated_at DESC`, [source]);
  } else {
    rows = await db.getAllAsync(`SELECT * FROM plugins ORDER BY updated_at DESC`);
  }
  return { success: true, data: rows.map(rowToPlugin) };
}

export async function listCreatedPlugins() {
  return listPlugins({ source: 'created' });
}

export async function listInstalledPlugins() {
  const db = await ensurePluginsTable();
  const rows = await db.getAllAsync(
    `SELECT * FROM plugins WHERE source IN ('template','shared','custom','created') ORDER BY updated_at DESC`
  );
  return { success: true, data: rows.map(rowToPlugin) };
}

export async function getPlugin(id) {
  const db = await ensurePluginsTable();
  const row = await db.getFirstAsync(`SELECT * FROM plugins WHERE id = ?`, [id]);
  return { success: true, data: rowToPlugin(row) };
}

export async function getPluginByName(name) {
  const db = await ensurePluginsTable();
  const row = await db.getFirstAsync(
    `SELECT * FROM plugins WHERE lower(name) = lower(?) AND enabled = 1`,
    [String(name || '').trim()]
  );
  return { success: true, data: rowToPlugin(row) };
}

export async function installPlugin(manifest, {
  source = 'custom',
  templateId = null,
  knownTools,
  ownerId = null,
  allowReshare = false,
  shareToken = null,
  sharedFromToken = null,
} = {}) {
  const v = validatePluginManifest(manifest, { knownTools });
  if (!v.ok) return { success: false, error: 'INVALID_MANIFEST', errors: v.errors };
  const m = v.normalized;
  const id = await newId();
  const now = Date.now();
  const db = await ensurePluginsTable();
  let owner = ownerId;
  if (source === 'created' && !owner) {
    owner = await getOrCreateOwnerId();
  }
  await db.runAsync(
    `INSERT INTO plugins (
      id, name, icon, description, instructions, required_connectors, allowed_tools,
      triggers, example_prompts, permissions, enabled, usage_count, source, template_id,
      owner_id, allow_reshare, share_token, shared_from_token, install_stats, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id, m.name, m.icon, m.description, m.instructions,
      JSON.stringify(m.requiredConnectors), JSON.stringify(m.allowedTools),
      JSON.stringify(m.triggers), JSON.stringify(m.examplePrompts),
      JSON.stringify(m.permissions || []),
      source, templateId,
      owner, allowReshare ? 1 : 0, shareToken, sharedFromToken,
      now, now,
    ]
  );
  return getPlugin(id);
}

export async function installTemplate(templateId, { knownTools } = {}) {
  const tpl = PLUGIN_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) return { success: false, error: 'TEMPLATE_NOT_FOUND' };
  return installPlugin(tpl, { source: 'template', templateId, knownTools });
}

/**
 * Install from a shared snapshot. Recipients get source='shared' (read-only).
 * Reshare only if the original owner allowed it.
 */
export async function installSharedPlugin(snapshot, { knownTools, recipientId } = {}) {
  if (!snapshot?.manifest) return { success: false, error: 'NO_SNAPSHOT' };
  if (snapshot.revoked) return { success: false, error: 'REVOKED' };
  const allowReshare = !!snapshot.allowReshare;
  return installPlugin(snapshot.manifest, {
    source: 'shared',
    knownTools,
    ownerId: snapshot.ownerId,
    allowReshare,
    sharedFromToken: snapshot.token,
  });
}

export async function updatePlugin(id, patch, { knownTools } = {}) {
  const existing = await getPlugin(id);
  if (!existing.data) return { success: false, error: 'NOT_FOUND' };
  if (existing.data.readOnly || existing.data.source === 'shared') {
    // Shared plugins: only enable/disable/remove — no instruction edits
    if (patch.instructions || patch.name || patch.allowedTools || patch.requiredConnectors) {
      return { success: false, error: 'READ_ONLY_SHARED' };
    }
  }
  const next = { ...existing.data, ...patch };
  const v = validatePluginManifest(next, { knownTools });
  if (!v.ok) return { success: false, error: 'INVALID_MANIFEST', errors: v.errors };
  const m = v.normalized;
  const db = await ensurePluginsTable();
  await db.runAsync(
    `UPDATE plugins SET name=?, icon=?, description=?, instructions=?, required_connectors=?, allowed_tools=?, triggers=?, example_prompts=?, permissions=?, allow_reshare=?, updated_at=? WHERE id=?`,
    [
      m.name, m.icon, m.description, m.instructions,
      JSON.stringify(m.requiredConnectors), JSON.stringify(m.allowedTools),
      JSON.stringify(m.triggers), JSON.stringify(m.examplePrompts),
      JSON.stringify(m.permissions || []),
      patch.allowReshare != null ? (patch.allowReshare ? 1 : 0) : (existing.data.allowReshare ? 1 : 0),
      Date.now(), id,
    ]
  );
  return getPlugin(id);
}

export async function setPluginAllowReshare(id, allow) {
  const db = await ensurePluginsTable();
  await db.runAsync(
    `UPDATE plugins SET allow_reshare = ?, updated_at = ? WHERE id = ? AND source = 'created'`,
    [allow ? 1 : 0, Date.now(), id]
  );
  return getPlugin(id);
}

export async function setPluginShareToken(id, token) {
  const db = await ensurePluginsTable();
  await db.runAsync(
    `UPDATE plugins SET share_token = ?, updated_at = ? WHERE id = ?`,
    [token || null, Date.now(), id]
  );
  return getPlugin(id);
}

export async function setPluginInstallStats(id, stats) {
  const db = await ensurePluginsTable();
  await db.runAsync(
    `UPDATE plugins SET install_stats = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(stats || null), Date.now(), id]
  );
  return getPlugin(id);
}

export async function setPluginEnabled(id, enabled) {
  const db = await ensurePluginsTable();
  await db.runAsync(`UPDATE plugins SET enabled = ?, updated_at = ? WHERE id = ?`, [enabled ? 1 : 0, Date.now(), id]);
  return getPlugin(id);
}

export async function deletePlugin(id) {
  const existing = await getPlugin(id);
  const db = await ensurePluginsTable();
  await db.runAsync(`DELETE FROM plugins WHERE id = ?`, [id]);
  return { success: true, data: existing.data };
}

export async function bumpPluginUsage(id) {
  const db = await ensurePluginsTable();
  await db.runAsync(
    `UPDATE plugins SET usage_count = usage_count + 1, updated_at = ? WHERE id = ?`,
    [Date.now(), id]
  );
  return getPlugin(id);
}

export function pluginToManifest(plugin) {
  if (!plugin) return null;
  return {
    name: plugin.name,
    icon: plugin.icon,
    description: plugin.description,
    instructions: plugin.instructions,
    requiredConnectors: plugin.requiredConnectors || [],
    allowedTools: plugin.allowedTools || [],
    triggers: plugin.triggers || [{ type: 'manual' }],
    examplePrompts: plugin.examplePrompts || [],
    permissions: plugin.permissions || [],
  };
}
