/**
 * IP reputation scoring.
 * - Clean %: fraction of DNSBL lists that do NOT list the IP.
 * - Transparency %: from provider/ip-api style flags (proxy/hosting).
 *   When unavailable → { transparency: null, transparencyStatus: 'needs_provider' }.
 *
 * DNSBL checks use reverse-IP lookups. In tests, inject a resolver.
 */
const dns = require('dns').promises;

const DEFAULT_DNSBLS = [
  { id: 'spamhaus', zone: 'zen.spamhaus.org', label: 'Spamhaus ZEN' },
  { id: 'spamcop', zone: 'bl.spamcop.net', label: 'SpamCop' },
  { id: 'barracuda', zone: 'b.barracudacentral.org', label: 'Barracuda' },
  { id: 'sorbs', zone: 'dnsbl.sorbs.net', label: 'SORBS' },
];

function reverseIp(ip) {
  return String(ip).split('.').reverse().join('.');
}

/**
 * @param {string} ip
 * @param {{ resolve4?: Function, lists?: typeof DEFAULT_DNSBLS }} [opts]
 */
async function checkDnsbls(ip, opts = {}) {
  const lists = opts.lists || DEFAULT_DNSBLS;
  const resolve4 = opts.resolve4 || ((name) => dns.resolve4(name));
  const results = [];
  for (const list of lists) {
    const query = `${reverseIp(ip)}.${list.zone}`;
    let listed = false;
    let error = null;
    try {
      const addrs = await resolve4(query);
      listed = Array.isArray(addrs) && addrs.length > 0;
    } catch (e) {
      // ENOTFOUND / ENODATA = not listed (clean for this list)
      if (e && (e.code === 'ENOTFOUND' || e.code === 'ENODATA' || e.code === 'EREFUSED')) {
        listed = false;
      } else {
        error = e.code || e.message || 'LOOKUP_FAILED';
        listed = false;
      }
    }
    results.push({
      id: list.id,
      label: list.label,
      zone: list.zone,
      listed,
      status: error ? 'error' : listed ? 'listed' : 'clean',
      error,
    });
  }
  return results;
}

/**
 * Compute Clean % from DNSBL results.
 */
function cleanPercent(dnsblResults) {
  if (!dnsblResults?.length) return 0;
  const usable = dnsblResults.filter((r) => r.status !== 'error');
  const base = usable.length ? usable : dnsblResults;
  const clean = base.filter((r) => r.status === 'clean').length;
  return Math.round((clean / base.length) * 100);
}

/**
 * Transparency from provider meta. If proxy/hosting unknown → needs_provider.
 * @param {{ isProxy?: boolean, isHosting?: boolean, isMobile?: boolean, providerType?: string }|null} meta
 */
function transparencyFromProvider(meta) {
  if (!meta || (meta.isProxy == null && meta.isHosting == null && !meta.providerType)) {
    return { transparencyPercent: null, transparencyStatus: 'needs_provider' };
  }
  // Residential / ISP-like → high; hosting/proxy → low
  let score = 100;
  if (meta.isProxy) score -= 45;
  if (meta.isHosting) score -= 35;
  if (meta.providerType === 'residential' || meta.providerType === 'isp') score = Math.max(score, 85);
  if (meta.providerType === 'datacenter') score = Math.min(score, 40);
  score = Math.max(0, Math.min(100, score));
  return { transparencyPercent: score, transparencyStatus: 'ok' };
}

/**
 * Full reputation report for an IP.
 */
async function scoreReputation(ip, providerMeta, opts = {}) {
  const dnsbl = await checkDnsbls(ip, opts);
  const clean = cleanPercent(dnsbl);
  const { transparencyPercent, transparencyStatus } = transparencyFromProvider(providerMeta);
  const trust = transparencyPercent == null
    ? clean
    : Math.round(clean * 0.55 + transparencyPercent * 0.45);
  let trustTone = 'ok';
  if (trust < 50) trustTone = 'bad';
  else if (trust < 70) trustTone = 'warn';
  return {
    ip,
    cleanPercent: clean,
    transparencyPercent,
    transparencyStatus,
    trustPercent: trust,
    trustTone,
    dnsbl,
    suggestion: trust < 70 ? 'Release or Change this IP so accounts are less likely to be flagged.' : null,
  };
}

module.exports = {
  DEFAULT_DNSBLS,
  reverseIp,
  checkDnsbls,
  cleanPercent,
  transparencyFromProvider,
  scoreReputation,
};
