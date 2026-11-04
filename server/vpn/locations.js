/**
 * Demo location catalog — country → states/regions with demo pricing.
 * Prices are labeled Demo in the UI; no real charge.
 */
const LOCATIONS = [
  {
    countryCode: 'US',
    country: 'United States',
    regions: [
      { id: 'us-ca', name: 'California', city: 'Los Angeles' },
      { id: 'us-tx', name: 'Texas', city: 'Dallas' },
      { id: 'us-ny', name: 'New York', city: 'New York City' },
      { id: 'us-fl', name: 'Florida', city: 'Miami' },
      { id: 'us-wa', name: 'Washington', city: 'Seattle' },
    ],
  },
  {
    countryCode: 'GB',
    country: 'United Kingdom',
    regions: [
      { id: 'gb-eng', name: 'England', city: 'London' },
      { id: 'gb-sct', name: 'Scotland', city: 'Edinburgh' },
    ],
  },
  {
    countryCode: 'DE',
    country: 'Germany',
    regions: [
      { id: 'de-be', name: 'Berlin', city: 'Berlin' },
      { id: 'de-by', name: 'Bavaria', city: 'Munich' },
    ],
  },
  {
    countryCode: 'JP',
    country: 'Japan',
    regions: [
      { id: 'jp-tyo', name: 'Tokyo', city: 'Tokyo' },
      { id: 'jp-osa', name: 'Osaka', city: 'Osaka' },
    ],
  },
  {
    countryCode: 'SG',
    country: 'Singapore',
    regions: [{ id: 'sg-sg', name: 'Singapore', city: 'Singapore' }],
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    regions: [
      { id: 'ca-on', name: 'Ontario', city: 'Toronto' },
      { id: 'ca-bc', name: 'British Columbia', city: 'Vancouver' },
    ],
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    regions: [
      { id: 'au-nsw', name: 'New South Wales', city: 'Sydney' },
      { id: 'au-vic', name: 'Victoria', city: 'Melbourne' },
    ],
  },
  {
    countryCode: 'NL',
    country: 'Netherlands',
    regions: [{ id: 'nl-nh', name: 'North Holland', city: 'Amsterdam' }],
  },
];

const PLANS = [
  { id: '7d', days: 7, label: '7 days', demoPriceUsd: 4.99 },
  { id: '30d', days: 30, label: '30 days', demoPriceUsd: 14.99 },
  { id: '90d', days: 90, label: '90 days', demoPriceUsd: 34.99 },
];

function listLocations() {
  return LOCATIONS.map((c) => ({
    countryCode: c.countryCode,
    country: c.country,
    regions: c.regions.map((r) => ({ ...r })),
  }));
}

function findRegion(regionId) {
  for (const c of LOCATIONS) {
    const r = c.regions.find((x) => x.id === regionId);
    if (r) return { country: c, region: r };
  }
  return null;
}

function listPlans() {
  return PLANS.map((p) => ({ ...p, currency: 'USD', demo: true }));
}

function quote({ regionId, planId }) {
  const hit = findRegion(regionId);
  const plan = PLANS.find((p) => p.id === planId);
  if (!hit || !plan) return null;
  return {
    regionId,
    planId,
    country: hit.country.country,
    countryCode: hit.country.countryCode,
    region: hit.region.name,
    city: hit.region.city,
    days: plan.days,
    amountUsd: plan.demoPriceUsd,
    currency: 'USD',
    demo: true,
    label: `Demo · ${hit.region.city}, ${hit.country.country} · ${plan.label}`,
  };
}

module.exports = { listLocations, listPlans, quote, findRegion, LOCATIONS, PLANS };
