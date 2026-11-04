/**
 * On-device demo VPN store used when the backend is unreachable.
 * Same shapes as the server demo provider so the UI is fully interactive.
 * Clearly labeled Demo — no real charge, no real tunnel from the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'zao_vpn_demo_v1';
const MAX = 5;

const LOCATIONS = [
  { countryCode: 'US', country: 'United States', regions: [
    { id: 'us-ca', name: 'California', city: 'Los Angeles' },
    { id: 'us-tx', name: 'Texas', city: 'Dallas' },
    { id: 'us-ny', name: 'New York', city: 'New York City' },
    { id: 'us-fl', name: 'Florida', city: 'Miami' },
    { id: 'us-wa', name: 'Washington', city: 'Seattle' },
  ]},
  { countryCode: 'GB', country: 'United Kingdom', regions: [
    { id: 'gb-eng', name: 'England', city: 'London' },
    { id: 'gb-sct', name: 'Scotland', city: 'Edinburgh' },
  ]},
  { countryCode: 'DE', country: 'Germany', regions: [
    { id: 'de-be', name: 'Berlin', city: 'Berlin' },
    { id: 'de-by', name: 'Bavaria', city: 'Munich' },
  ]},
  { countryCode: 'JP', country: 'Japan', regions: [
    { id: 'jp-tyo', name: 'Tokyo', city: 'Tokyo' },
    { id: 'jp-osa', name: 'Osaka', city: 'Osaka' },
  ]},
  { countryCode: 'SG', country: 'Singapore', regions: [
    { id: 'sg-sg', name: 'Singapore', city: 'Singapore' },
  ]},
  { countryCode: 'CA', country: 'Canada', regions: [
    { id: 'ca-on', name: 'Ontario', city: 'Toronto' },
    { id: 'ca-bc', name: 'British Columbia', city: 'Vancouver' },
  ]},
  { countryCode: 'AU', country: 'Australia', regions: [
    { id: 'au-nsw', name: 'New South Wales', city: 'Sydney' },
    { id: 'au-vic', name: 'Victoria', city: 'Melbourne' },
  ]},
  { countryCode: 'NL', country: 'Netherlands', regions: [
    { id: 'nl-nh', name: 'North Holland', city: 'Amsterdam' },
  ]},
];

const PLANS = [
  { id: '7d', days: 7, label: '7 days', demoPriceUsd: 4.99, currency: 'USD', demo: true },
  { id: '30d', days: 30, label: '30 days', demoPriceUsd: 14.99, currency: 'USD', demo: true },
  { id: '90d', days: 90, label: '90 days', demoPriceUsd: 34.99, currency: 'USD', demo: true },
];

async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return { items: [], activeId: null };
}

async function save(state) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

function findRegion(regionId) {
  for (const c of LOCATIONS) {
    const r = c.regions.find((x) => x.id === regionId);
    if (r) return { country: c, region: r };
  }
  return null;
}

function demoIp(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `198.51.${h % 200}.${(h >> 8) % 200 + 1}`;
}

function publicItem(item) {
  if (!item) return null;
  const { proxy, ...rest } = item;
  return { ...rest, proxy: proxy ? { server: proxy.server, username: proxy.username, hasPassword: true } : null };
}

export const localVpn = {
  MAX,
  async locations() { return { success: true, data: LOCATIONS }; },
  async plans() { return { success: true, data: PLANS }; },
  async quote({ regionId, planId }) {
    const hit = findRegion(regionId);
    const plan = PLANS.find((p) => p.id === planId);
    if (!hit || !plan) return { success: false, error: 'INVALID_QUOTE' };
    return {
      success: true,
      data: {
        regionId, planId,
        country: hit.country.country, countryCode: hit.country.countryCode,
        region: hit.region.name, city: hit.region.city,
        days: plan.days, amountUsd: plan.demoPriceUsd, currency: 'USD', demo: true,
        label: `Demo · ${hit.region.city}, ${hit.country.country} · ${plan.label}`,
      },
    };
  },
  async list() {
    const st = await load();
    return {
      success: true,
      data: { items: st.items.map(publicItem), activeId: st.activeId, count: st.items.length, max: MAX },
    };
  },
  async status() {
    const st = await load();
    const active = st.items.find((i) => i.id === st.activeId) || null;
    let reputation = null;
    if (active) {
      reputation = {
        ip: active.ip,
        cleanPercent: active._forceLowTrust ? 40 : 100,
        transparencyPercent: 88,
        transparencyStatus: 'ok',
        trustPercent: active._forceLowTrust ? 48 : 94,
        trustTone: active._forceLowTrust ? 'bad' : 'ok',
        dnsbl: [
          { id: 'spamhaus', label: 'Spamhaus ZEN', status: active._forceLowTrust ? 'listed' : 'clean' },
          { id: 'spamcop', label: 'SpamCop', status: 'clean' },
          { id: 'barracuda', label: 'Barracuda', status: active._forceLowTrust ? 'listed' : 'clean' },
          { id: 'sorbs', label: 'SORBS', status: 'clean' },
        ],
        suggestion: active._forceLowTrust ? 'Release or Change this IP so accounts are less likely to be flagged.' : null,
      };
    }
    return {
      success: true,
      data: {
        provider: { id: 'demo', label: 'Demo provider: no real charge', demo: true, maxVpns: MAX },
        active: publicItem(active),
        reputation,
        count: st.items.length,
        max: MAX,
        paymentConfigured: false,
        localDemo: true,
      },
    };
  },
  async purchase({ regionId, planId }) {
    const st = await load();
    if (st.items.length >= MAX) return { success: false, error: 'VPN_LIMIT_REACHED' };
    const q = await this.quote({ regionId, planId });
    if (!q.success) return q;
    const id = `vpn_local_${Date.now().toString(36)}`;
    const now = Date.now();
    const item = {
      id, provider: 'demo', demo: true,
      country: q.data.country, countryCode: q.data.countryCode,
      regionId, region: q.data.region, city: q.data.city,
      ip: demoIp(regionId + id), protocol: 'HTTP', status: 'ready',
      purchasedAt: now, expiresAt: now + q.data.days * 86400000, renewBy: now + q.data.days * 86400000,
      planId, quotaBytes: 50 * 1024 ** 3, usedBytes: 1.2 * 1024 ** 3, bytesUp: 0, bytesDown: 0,
      proxy: { server: 'http://127.0.0.1:18080', username: `demo_${id.slice(-6)}`, password: 'demo' },
      providerMeta: { isProxy: true, isHosting: false, providerType: 'residential' },
    };
    st.items.push(item);
    await save(st);
    return { success: true, data: publicItem(item), charge: { amountUsd: q.data.amountUsd, currency: 'USD', demo: true, label: 'Demo · no real charge' } };
  },
  async renew(id, planId = '30d') {
    const st = await load();
    const item = st.items.find((i) => i.id === id);
    if (!item) return { success: false, error: 'NOT_FOUND' };
    const plan = PLANS.find((p) => p.id === planId) || PLANS[1];
    item.expiresAt = Math.max(item.expiresAt, Date.now()) + plan.days * 86400000;
    item.renewBy = item.expiresAt;
    item.planId = plan.id;
    await save(st);
    return { success: true, data: publicItem(item), charge: { amountUsd: plan.demoPriceUsd, currency: 'USD', demo: true, label: 'Demo · no real charge' } };
  },
  async change(id, regionId) {
    const st = await load();
    const item = st.items.find((i) => i.id === id);
    const hit = findRegion(regionId);
    if (!item || !hit) return { success: false, error: 'NOT_FOUND' };
    item.regionId = regionId;
    item.region = hit.region.name;
    item.city = hit.region.city;
    item.country = hit.country.country;
    item.countryCode = hit.country.countryCode;
    item.ip = demoIp(regionId + Date.now());
    item._forceLowTrust = false;
    await save(st);
    return { success: true, data: publicItem(item) };
  },
  async release(id) {
    const st = await load();
    const item = st.items.find((i) => i.id === id);
    if (!item) return { success: false, error: 'NOT_FOUND' };
    item.ip = demoIp(item.regionId + Date.now());
    item._forceLowTrust = false;
    await save(st);
    return { success: true, data: publicItem(item), note: 'Demo release: IP replaced in the same region.' };
  },
  async remove(id) {
    const st = await load();
    st.items = st.items.filter((i) => i.id !== id);
    if (st.activeId === id) st.activeId = null;
    await save(st);
    return { success: true };
  },
  async activate(id) {
    const st = await load();
    if (!st.items.some((i) => i.id === id)) return { success: false, error: 'NOT_FOUND' };
    st.activeId = id;
    await save(st);
    return { success: true, data: { activeId: id, active: publicItem(st.items.find((i) => i.id === id)) } };
  },
  async deactivate() {
    const st = await load();
    st.activeId = null;
    await save(st);
    return { success: true, data: { activeId: null } };
  },
  async usage(id) {
    const st = await load();
    const item = st.items.find((i) => i.id === id);
    if (!item) return { success: false, error: 'NOT_FOUND' };
    item.bytesDown = (item.bytesDown || 0) + Math.floor(Math.random() * 50000);
    item.bytesUp = (item.bytesUp || 0) + Math.floor(Math.random() * 10000);
    await save(st);
    return {
      success: true,
      data: {
        id, bytesUp: item.bytesUp, bytesDown: item.bytesDown,
        usedBytes: item.usedBytes, quotaBytes: item.quotaBytes,
        upBps: 15000 + Math.floor(Math.random() * 30000),
        downBps: 90000 + Math.floor(Math.random() * 150000),
      },
    };
  },
  async reputation(id) {
    const st = await statusFrom(stLoad => stLoad, id);
    return st;
  },
  /** Dev helper to force low-trust state for mockups / warnings */
  async forceLowTrust(id, on = true) {
    const st = await load();
    const item = st.items.find((i) => i.id === id);
    if (!item) return { success: false, error: 'NOT_FOUND' };
    item._forceLowTrust = !!on;
    await save(st);
    return { success: true };
  },
};

async function statusFrom() { return localVpn.status(); }

export { LOCATIONS as DEMO_LOCATIONS, PLANS as DEMO_PLANS };
