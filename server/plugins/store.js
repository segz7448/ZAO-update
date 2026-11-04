/**
 * Plugin share store — JSON files under data/plugin-shares/
 * Shares are immutable snapshots. Installs are deduped per recipient.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function createPluginShareStore(dataDir) {
  const root = path.join(dataDir, 'plugin-shares');
  ensureDir(root);
  const indexFile = path.join(root, 'index.json');

  function loadIndex() {
    return readJson(indexFile, { shares: {}, byPlugin: {} });
  }
  function saveIndex(idx) {
    writeJson(indexFile, idx);
  }

  function shareFile(token) {
    return path.join(root, `${token}.json`);
  }

  function newToken() {
    return crypto.randomBytes(24).toString('base64url');
  }

  function createShare({ pluginId, ownerId, ownerName, manifest, allowReshare = false }) {
    if (!pluginId || !ownerId || !manifest) {
      const e = new Error('INVALID_SHARE'); e.code = 'INVALID_SHARE'; throw e;
    }
    const token = newToken();
    const now = Date.now();
    const snap = {
      token,
      id: `shr_${crypto.randomBytes(8).toString('hex')}`,
      pluginId,
      ownerId,
      ownerName: ownerName || 'ZAO user',
      allowReshare: !!allowReshare,
      revoked: false,
      createdAt: now,
      manifest: JSON.parse(JSON.stringify(manifest)), // immutable snapshot
      installs: {}, // recipientId -> { installedAt, active: true }
      installEvents: [], // { at, recipientId, type: 'install'|'uninstall' }
    };
    writeJson(shareFile(token), snap);
    const idx = loadIndex();
    idx.shares[token] = { pluginId, ownerId, createdAt: now };
    if (!idx.byPlugin[pluginId]) idx.byPlugin[pluginId] = [];
    idx.byPlugin[pluginId].push(token);
    saveIndex(idx);
    return snap;
  }

  function getShare(token) {
    if (!token) return null;
    return readJson(shareFile(token), null);
  }

  function saveShare(snap) {
    writeJson(shareFile(snap.token), snap);
  }

  function revokeShare(token, ownerId) {
    const snap = getShare(token);
    if (!snap) { const e = new Error('NOT_FOUND'); e.code = 'NOT_FOUND'; throw e; }
    if (snap.ownerId !== ownerId) { const e = new Error('FORBIDDEN'); e.code = 'FORBIDDEN'; throw e; }
    snap.revoked = true;
    snap.revokedAt = Date.now();
    saveShare(snap);
    return snap;
  }

  function recordInstall(token, recipientId) {
    const snap = getShare(token);
    if (!snap) { const e = new Error('NOT_FOUND'); e.code = 'NOT_FOUND'; throw e; }
    if (snap.revoked) { const e = new Error('REVOKED'); e.code = 'REVOKED'; throw e; }
    if (!recipientId) { const e = new Error('RECIPIENT_REQUIRED'); e.code = 'RECIPIENT_REQUIRED'; throw e; }
    const now = Date.now();
    const existing = snap.installs[recipientId];
    if (existing && existing.active) {
      return { snap, created: false, stats: statsFrom(snap) };
    }
    snap.installs[recipientId] = { installedAt: existing?.installedAt || now, active: true, lastAt: now };
    snap.installEvents.push({ at: now, recipientId, type: 'install' });
    saveShare(snap);
    return { snap, created: true, stats: statsFrom(snap) };
  }

  function recordUninstall(token, recipientId) {
    const snap = getShare(token);
    if (!snap) { const e = new Error('NOT_FOUND'); e.code = 'NOT_FOUND'; throw e; }
    const row = snap.installs[recipientId];
    if (!row || !row.active) return { snap, changed: false, stats: statsFrom(snap) };
    row.active = false;
    row.uninstalledAt = Date.now();
    snap.installEvents.push({ at: Date.now(), recipientId, type: 'uninstall' });
    saveShare(snap);
    return { snap, changed: true, stats: statsFrom(snap) };
  }

  function statsFrom(snap) {
    const installs = Object.values(snap.installs || {});
    const total = installs.length;
    const active = installs.filter((i) => i.active).length;
    // sparkline: last 14 days install counts
    const dayMs = 86400000;
    const now = Date.now();
    const sparkline = [];
    for (let d = 13; d >= 0; d -= 1) {
      const start = now - d * dayMs;
      const end = start + dayMs;
      const count = (snap.installEvents || []).filter(
        (e) => e.type === 'install' && e.at >= start && e.at < end
      ).length;
      sparkline.push(count);
    }
    return { installs: total, active, sparkline };
  }

  function getStatsForPlugin(pluginId, ownerId) {
    const idx = loadIndex();
    const tokens = idx.byPlugin[pluginId] || [];
    let installs = 0;
    let active = 0;
    const sparkline = Array(14).fill(0);
    for (const token of tokens) {
      const snap = getShare(token);
      if (!snap || snap.ownerId !== ownerId) continue;
      const s = statsFrom(snap);
      installs += s.installs;
      active += s.active;
      s.sparkline.forEach((n, i) => { sparkline[i] += n; });
    }
    return { installs, active, sparkline, shareCount: tokens.length };
  }

  function listSharesForPlugin(pluginId, ownerId) {
    const idx = loadIndex();
    return (idx.byPlugin[pluginId] || [])
      .map((token) => getShare(token))
      .filter((s) => s && s.ownerId === ownerId)
      .map((s) => ({
        token: s.token,
        id: s.id,
        revoked: !!s.revoked,
        allowReshare: !!s.allowReshare,
        createdAt: s.createdAt,
        stats: statsFrom(s),
      }));
  }

  return {
    createShare, getShare, revokeShare, recordInstall, recordUninstall,
    getStatsForPlugin, listSharesForPlugin, statsFrom,
  };
}

module.exports = { createPluginShareStore };
