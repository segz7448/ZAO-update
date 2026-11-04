/**
 * Demo VPN/proxy provider adapter.
 * Clearly labeled: no real charge, synthetic IPs and credentials.
 * Gated: real purchase requires VPN_PROVIDER + VPN_PAYMENT config.
 */
const crypto = require('crypto');
const { listLocations, listPlans, quote, findRegion } = require('./locations');

const MAX_VPNS = 5;

function demoIpForRegion(regionId) {
  // Deterministic-ish demo IPv4 in documentation ranges
  const h = crypto.createHash('sha1').update(String(regionId)).digest();
  return `198.51.${h[0] % 200}.${(h[1] % 200) + 1}`;
}

function createMockProvider({ store }) {
  return {
    id: 'demo',
    label: 'Demo provider: no real charge',
    demo: true,
    maxVpns: MAX_VPNS,

    async listLocations() {
      return listLocations();
    },

    async listPlans() {
      return listPlans();
    },

    async quote(input) {
      const q = quote(input);
      if (!q) throw Object.assign(new Error('INVALID_QUOTE'), { code: 'INVALID_QUOTE' });
      return q;
    },

    async purchase({ regionId, planId }) {
      const paymentConfigured = !!(process.env.VPN_PAYMENT_PROVIDER && process.env.VPN_PROVIDER_API_KEY);
      if (!paymentConfigured && process.env.VPN_REQUIRE_PAYMENT === '1') {
        const err = new Error('PAYMENT_NOT_CONFIGURED');
        err.code = 'PAYMENT_NOT_CONFIGURED';
        throw err;
      }
      const owned = store.list();
      if (owned.length >= MAX_VPNS) {
        const err = new Error('VPN_LIMIT_REACHED');
        err.code = 'VPN_LIMIT_REACHED';
        throw err;
      }
      const q = quote({ regionId, planId });
      if (!q) {
        const err = new Error('INVALID_QUOTE');
        err.code = 'INVALID_QUOTE';
        throw err;
      }
      const id = `vpn_${crypto.randomBytes(8).toString('hex')}`;
      const ip = demoIpForRegion(regionId);
      const now = Date.now();
      const expiresAt = now + q.days * 24 * 60 * 60 * 1000;
      const item = {
        id,
        provider: 'demo',
        demo: true,
        country: q.country,
        countryCode: q.countryCode,
        regionId: q.regionId,
        region: q.region,
        city: q.city,
        ip,
        protocol: 'HTTP',
        status: 'ready',
        purchasedAt: now,
        expiresAt,
        renewBy: expiresAt,
        planId: q.planId,
        quotaBytes: 50 * 1024 * 1024 * 1024, // 50 GB demo
        usedBytes: Math.floor(Math.random() * 2 * 1024 * 1024 * 1024),
        bytesUp: 0,
        bytesDown: 0,
        // Demo proxy endpoint — not a real listening proxy
        proxy: {
          server: `http://127.0.0.1:18080`,
          username: `demo_${id.slice(-6)}`,
          password: crypto.randomBytes(12).toString('hex'),
        },
        providerMeta: {
          isProxy: true,
          isHosting: false,
          providerType: 'residential',
        },
      };
      store.add(item);
      return { ...item, quote: q, charge: { amountUsd: q.amountUsd, currency: 'USD', demo: true, label: 'Demo · no real charge' } };
    },

    async renew(id, planId) {
      const item = store.get(id);
      if (!item) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      const plan = listPlans().find((p) => p.id === planId) || listPlans()[1];
      const base = Math.max(item.expiresAt, Date.now());
      item.expiresAt = base + plan.days * 24 * 60 * 60 * 1000;
      item.renewBy = item.expiresAt;
      item.planId = plan.id;
      store.update(item);
      return {
        ...item,
        charge: { amountUsd: plan.demoPriceUsd, currency: 'USD', demo: true, label: 'Demo · no real charge' },
      };
    },

    async change(id, regionId) {
      const item = store.get(id);
      if (!item) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      const hit = findRegion(regionId);
      if (!hit) throw Object.assign(new Error('INVALID_REGION'), { code: 'INVALID_REGION' });
      item.regionId = regionId;
      item.region = hit.region.name;
      item.city = hit.region.city;
      item.country = hit.country.country;
      item.countryCode = hit.country.countryCode;
      item.ip = demoIpForRegion(regionId);
      item.providerMeta = { isProxy: true, isHosting: false, providerType: 'residential' };
      store.update(item);
      return item;
    },

    async release(id) {
      const item = store.get(id);
      if (!item) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      // Replace IP in same region (demo "release")
      item.ip = demoIpForRegion(`${item.regionId}-${Date.now()}`);
      item.providerMeta = { isProxy: true, isHosting: false, providerType: 'residential' };
      item.releasedAt = Date.now();
      store.update(item);
      return { ...item, action: 'replaced', note: 'Demo release: IP replaced in the same region. No refund issued in demo mode.' };
    },

    async delete(id) {
      const ok = store.remove(id);
      if (!ok) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      return { success: true };
    },

    async usage(id) {
      const item = store.get(id);
      if (!item) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
      // Simulate live counters
      item.bytesDown += Math.floor(Math.random() * 40000);
      item.bytesUp += Math.floor(Math.random() * 8000);
      item.usedBytes = Math.min(item.quotaBytes, (item.usedBytes || 0) + item.bytesDown + item.bytesUp);
      store.update(item);
      return {
        id,
        bytesUp: item.bytesUp,
        bytesDown: item.bytesDown,
        usedBytes: item.usedBytes,
        quotaBytes: item.quotaBytes,
        upBps: 12000 + Math.floor(Math.random() * 40000),
        downBps: 80000 + Math.floor(Math.random() * 200000),
      };
    },
  };
}

module.exports = { createMockProvider, MAX_VPNS, demoIpForRegion };
