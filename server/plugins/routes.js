/**
 * Plugin share REST + public /p/:token page.
 */
const { createPluginShareStore } = require('./store');
const path = require('path');

function publicView(snap, { includeManifest = true } = {}) {
  if (!snap) return null;
  return {
    token: snap.token,
    id: snap.id,
    pluginId: snap.pluginId,
    ownerId: snap.ownerId,
    ownerName: snap.ownerName,
    allowReshare: !!snap.allowReshare,
    revoked: !!snap.revoked,
    createdAt: snap.createdAt,
    manifest: includeManifest ? snap.manifest : undefined,
    stats: createStats(snap),
  };
}

function createStats(snap) {
  const installs = Object.values(snap.installs || {});
  return {
    installs: installs.length,
    active: installs.filter((i) => i.active).length,
  };
}

function registerPluginShareRoutes(app, { dataDir } = {}) {
  const dir = dataDir || path.join(__dirname, '..', 'data');
  const store = createPluginShareStore(dir);

  // --- Authenticated owner APIs ---
  app.post('/plugins/:id/share', (req, res) => {
    try {
      const pluginId = req.params.id;
      const { ownerId, ownerName, manifest, allowReshare } = req.body || {};
      const snap = store.createShare({ pluginId, ownerId, ownerName, manifest, allowReshare });
      const base = `${req.protocol}://${req.get('host')}`;
      res.json({
        success: true,
        data: {
          token: snap.token,
          id: snap.id,
          url: `${base}/p/${snap.token}`,
          deepLink: `zao://plugin/${snap.token}`,
          allowReshare: snap.allowReshare,
        },
      });
    } catch (e) {
      res.status(400).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/plugins/share/:token/revoke', (req, res) => {
    try {
      const { ownerId } = req.body || {};
      const snap = store.revokeShare(req.params.token, ownerId);
      res.json({ success: true, data: publicView(snap) });
    } catch (e) {
      const status = e.code === 'FORBIDDEN' ? 403 : e.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ success: false, error: e.code || e.message });
    }
  });

  app.get('/plugins/:id/share/stats', (req, res) => {
    const ownerId = req.query.ownerId;
    if (!ownerId) return res.status(400).json({ success: false, error: 'OWNER_REQUIRED' });
    const stats = store.getStatsForPlugin(req.params.id, ownerId);
    const shares = store.listSharesForPlugin(req.params.id, ownerId);
    res.json({ success: true, data: { ...stats, shares } });
  });

  app.post('/plugins/share/:token/install', (req, res) => {
    try {
      const { recipientId } = req.body || {};
      const result = store.recordInstall(req.params.token, recipientId);
      res.json({
        success: true,
        data: {
          created: result.created,
          stats: result.stats,
          snapshot: publicView(result.snap),
        },
      });
    } catch (e) {
      const status = e.code === 'REVOKED' ? 410 : e.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/plugins/share/:token/uninstall', (req, res) => {
    try {
      const { recipientId } = req.body || {};
      const result = store.recordUninstall(req.params.token, recipientId);
      res.json({ success: true, data: { changed: result.changed, stats: result.stats } });
    } catch (e) {
      const status = e.code === 'NOT_FOUND' ? 404 : 400;
      res.status(status).json({ success: false, error: e.code || e.message });
    }
  });

  // Authenticated fetch of snapshot (also available publicly via /p/:token.json)
  app.get('/plugins/share/:token', (req, res) => {
    const snap = store.getShare(req.params.token);
    if (!snap) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    if (snap.revoked) return res.status(410).json({ success: false, error: 'REVOKED' });
    res.json({ success: true, data: publicView(snap) });
  });

  // --- Public web fallback (no auth) — registered via separate public router ---
  return {
    store,
    publicHandlers: {
      page: (req, res) => {
        const snap = store.getShare(req.params.token);
        if (!snap || snap.revoked) {
          res.status(404).type('html').send(`<!doctype html><html><body style="font-family:system-ui;padding:40px">
            <h1>Plugin unavailable</h1><p>This share link is missing or was revoked.</p></body></html>`);
          return;
        }
        const m = snap.manifest || {};
        const deep = `zao://plugin/${snap.token}`;
        const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({
          '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[c]));
        res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(m.name)} · ZAO plugin</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0b0b0f;color:#f5f5f7;display:flex;min-height:100vh;align-items:center;justify-content:center}
  .card{max-width:420px;width:90%;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:20px;padding:28px;backdrop-filter:blur(20px)}
  h1{margin:0 0 8px;font-size:24px} p{opacity:.8;line-height:1.45}
  .meta{font-size:13px;opacity:.6;margin:12px 0 20px}
  a.btn{display:block;text-align:center;background:#0A84FF;color:#fff;text-decoration:none;padding:14px 18px;border-radius:12px;font-weight:700}
</style></head><body><div class="card">
  <h1>${esc(m.name || 'Shared plugin')}</h1>
  <p>${esc(m.description || '')}</p>
  <div class="meta">Shared by ${esc(snap.ownerName)} · ${esc((m.allowedTools||[]).length)} tools</div>
  <a class="btn" href="${deep}">Open in ZAO</a>
  <p style="font-size:12px;margin-top:16px;opacity:.5">Or copy: ${esc(deep)}</p>
</div></body></html>`);
      },
      json: (req, res) => {
        const snap = store.getShare(req.params.token);
        if (!snap) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
        if (snap.revoked) return res.status(410).json({ success: false, error: 'REVOKED' });
        res.json({ success: true, data: publicView(snap) });
      },
    },
  };
}

module.exports = { registerPluginShareRoutes };
