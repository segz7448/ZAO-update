const {
  reverseIp, cleanPercent, transparencyFromProvider, scoreReputation, checkDnsbls,
} = require('../../../server/vpn/reputation');
const { createMockProvider, MAX_VPNS } = require('../../../server/vpn/mockProvider');
const { createVpnStore } = require('../../../server/vpn/store');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('DNSBL / reputation scoring', () => {
  test('reverseIp', () => {
    expect(reverseIp('1.2.3.4')).toBe('4.3.2.1');
  });

  test('cleanPercent all clean → 100', () => {
    expect(cleanPercent([
      { status: 'clean' }, { status: 'clean' }, { status: 'clean' }, { status: 'clean' },
    ])).toBe(100);
  });

  test('cleanPercent half listed → 50', () => {
    expect(cleanPercent([
      { status: 'clean' }, { status: 'listed' }, { status: 'clean' }, { status: 'listed' },
    ])).toBe(50);
  });

  test('transparency needs_provider when meta empty', () => {
    expect(transparencyFromProvider(null)).toEqual({
      transparencyPercent: null, transparencyStatus: 'needs_provider',
    });
  });

  test('transparency high for residential', () => {
    const t = transparencyFromProvider({ isProxy: true, isHosting: false, providerType: 'residential' });
    expect(t.transparencyStatus).toBe('ok');
    expect(t.transparencyPercent).toBeGreaterThanOrEqual(85);
  });

  test('checkDnsbls uses injected resolver (mock listed/clean)', async () => {
    const resolve4 = async (name) => {
      if (name.includes('spamhaus')) return ['127.0.0.2'];
      const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e;
    };
    const results = await checkDnsbls('1.2.3.4', { resolve4 });
    expect(results.find((r) => r.id === 'spamhaus').status).toBe('listed');
    expect(results.find((r) => r.id === 'spamcop').status).toBe('clean');
  });

  test('scoreReputation trust tones', async () => {
    const resolve4 = async () => { const e = new Error('ENOTFOUND'); e.code = 'ENOTFOUND'; throw e; };
    const good = await scoreReputation('1.2.3.4', { isProxy: true, providerType: 'residential' }, { resolve4 });
    expect(good.trustTone).toBe('ok');
    expect(good.cleanPercent).toBe(100);

    const resolveListed = async () => ['127.0.0.2'];
    const bad = await scoreReputation('1.2.3.4', { isProxy: true, isHosting: true, providerType: 'datacenter' }, { resolve4: resolveListed });
    expect(bad.cleanPercent).toBe(0);
    expect(bad.trustTone).toBe('bad');
    expect(bad.suggestion).toMatch(/Release or Change/);
  });
});

describe('mock provider', () => {
  let dir; let store; let provider;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zao-vpn-'));
    store = createVpnStore(dir);
    provider = createMockProvider({ store });
  });
  afterEach(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });

  test('purchase + limit', async () => {
    for (let i = 0; i < MAX_VPNS; i++) {
      await provider.purchase({ regionId: 'us-ca', planId: '7d' });
    }
    await expect(provider.purchase({ regionId: 'us-ca', planId: '7d' })).rejects.toMatchObject({ code: 'VPN_LIMIT_REACHED' });
  });

  test('quote is demo-labeled', async () => {
    const q = await provider.quote({ regionId: 'us-ny', planId: '30d' });
    expect(q.demo).toBe(true);
    expect(q.amountUsd).toBe(14.99);
  });

  test('release replaces IP', async () => {
    const item = await provider.purchase({ regionId: 'us-tx', planId: '30d' });
    const before = item.ip;
    const next = await provider.release(item.id);
    expect(next.ip).not.toBe(before);
  });
});
