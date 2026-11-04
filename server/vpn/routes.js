/**
 * REST: /vpn/*
 */
const { createVpnStore } = require('./store');
const { createMockProvider } = require('./mockProvider');
const { scoreReputation } = require('./reputation');
const { getActiveProxyConfig } = require('./proxy');
const path = require('path');

function registerVpnRoutes(app, { dataDir, authMiddleware } = {}) {
  const dir = dataDir || path.join(__dirname, '..', 'data');
  const store = createVpnStore(dir);
  const provider = createMockProvider({ store });

  const guard = authMiddleware || ((req, res, next) => next());

  app.get('/vpn/status', guard, async (req, res) => {
    const active = store.getActive();
    let reputation = null;
    if (active) {
      try {
        reputation = await scoreReputation(active.ip, active.providerMeta, {
          // Demo: don't hit real DNSBL by default unless VPN_DNSBL=1
          resolve4: process.env.VPN_DNSBL === '1' ? undefined : async () => { const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; },
        });
      } catch (_) { /* ignore */ }
    }
    res.json({
      success: true,
      data: {
        provider: { id: provider.id, label: provider.label, demo: true, maxVpns: provider.maxVpns },
        active: active ? store.publicView(active) : null,
        reputation,
        count: store.list().length,
        max: provider.maxVpns,
        paymentConfigured: !!(process.env.VPN_PAYMENT_PROVIDER && process.env.VPN_PROVIDER_API_KEY),
      },
    });
  });

  app.get('/vpn/locations', guard, async (req, res) => {
    res.json({ success: true, data: await provider.listLocations() });
  });

  app.get('/vpn/plans', guard, async (req, res) => {
    res.json({ success: true, data: await provider.listPlans() });
  });

  app.post('/vpn/quote', guard, async (req, res) => {
    try {
      const q = await provider.quote(req.body || {});
      res.json({ success: true, data: q });
    } catch (e) {
      res.status(400).json({ success: false, error: e.code || e.message });
    }
  });

  app.get('/vpn/list', guard, (req, res) => {
    res.json({
      success: true,
      data: {
        items: store.list().map((i) => store.publicView(i)),
        activeId: store.getActiveId(),
        count: store.list().length,
        max: provider.maxVpns,
      },
    });
  });

  app.post('/vpn/purchase', guard, async (req, res) => {
    try {
      const item = await provider.purchase(req.body || {});
      res.json({ success: true, data: store.publicView(item), charge: item.charge });
    } catch (e) {
      const status = e.code === 'VPN_LIMIT_REACHED' ? 409 : 400;
      res.status(status).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/vpn/:id/renew', guard, async (req, res) => {
    try {
      const item = await provider.renew(req.params.id, req.body?.planId || '30d');
      res.json({ success: true, data: store.publicView(item), charge: item.charge });
    } catch (e) {
      res.status(404).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/vpn/:id/change', guard, async (req, res) => {
    try {
      const item = await provider.change(req.params.id, req.body?.regionId);
      res.json({ success: true, data: store.publicView(item) });
    } catch (e) {
      res.status(400).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/vpn/:id/release', guard, async (req, res) => {
    try {
      const item = await provider.release(req.params.id);
      res.json({ success: true, data: store.publicView(item), note: item.note });
    } catch (e) {
      res.status(404).json({ success: false, error: e.code || e.message });
    }
  });

  app.delete('/vpn/:id', guard, async (req, res) => {
    try {
      await provider.delete(req.params.id);
      res.json({ success: true });
    } catch (e) {
      res.status(404).json({ success: false, error: e.code || e.message });
    }
  });

  app.post('/vpn/:id/activate', guard, (req, res) => {
    const ok = store.setActive(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    res.json({ success: true, data: { activeId: store.getActiveId(), active: store.publicView(store.getActive()) } });
  });

  app.post('/vpn/deactivate', guard, (req, res) => {
    store.setActive(null);
    res.json({ success: true, data: { activeId: null } });
  });

  app.get('/vpn/:id/usage', guard, async (req, res) => {
    try {
      const usage = await provider.usage(req.params.id);
      res.json({ success: true, data: usage });
    } catch (e) {
      res.status(404).json({ success: false, error: e.code || e.message });
    }
  });

  app.get('/vpn/:id/reputation', guard, async (req, res) => {
    const item = store.get(req.params.id);
    if (!item) return res.status(404).json({ success: false, error: 'NOT_FOUND' });
    const resolve4 = process.env.VPN_DNSBL === '1'
      ? undefined
      : async () => { const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; };
    // Allow test overrides via body? GET — use query mockListed
    const report = await scoreReputation(item.ip, item.providerMeta, { resolve4 });
    res.json({ success: true, data: report });
  });

  return { store, provider, getActiveProxyConfig: () => getActiveProxyConfig(store) };
}

module.exports = { registerVpnRoutes };
