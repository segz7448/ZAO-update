/**
 * Billing / usage stubs for Settings > Usage.
 *
 * No payment provider is wired. GET /billing/usage reports this UTC week's
 * chat-completion request count vs config.BILLING_WEEKLY_REQUEST_LIMIT.
 * GET /billing/subscription returns the config-driven plan placeholder.
 * recordChatCompletion() is called from the completions relay so the
 * meter reflects real traffic when the VM is up.
 */
const fs = require('fs');
const path = require('path');

function startOfUtcWeekMs(now = Date.now()) {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday-start week
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - diff));
  return monday.getTime();
}

function endOfUtcWeekMs(now = Date.now()) {
  return startOfUtcWeekMs(now) + 7 * 24 * 60 * 60 * 1000;
}

function loadMeter(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {}
  return { weekStart: startOfUtcWeekMs(), requests: 0, tokensIn: 0, tokensOut: 0 };
}

function saveMeter(filePath, meter) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(meter, null, 2));
  } catch (_) {}
}

function ensureCurrentWeek(meter) {
  const weekStart = startOfUtcWeekMs();
  if (meter.weekStart !== weekStart) {
    return { weekStart, requests: 0, tokensIn: 0, tokensOut: 0 };
  }
  return meter;
}

function registerBillingRoutes(app, config, log, { dataDir } = {}) {
  const meterPath = path.join(dataDir || path.join(__dirname, 'data'), 'billing-meter.json');

  function readMeter() {
    return ensureCurrentWeek(loadMeter(meterPath));
  }

  function recordChatCompletion({ tokensIn = 0, tokensOut = 0 } = {}) {
    const meter = readMeter();
    meter.requests += 1;
    meter.tokensIn += Number(tokensIn) || 0;
    meter.tokensOut += Number(tokensOut) || 0;
    saveMeter(meterPath, meter);
    return meter;
  }

  app.get('/billing/usage', (req, res) => {
    const meter = readMeter();
    const limit = Math.max(1, Number(config.BILLING_WEEKLY_REQUEST_LIMIT) || 100);
    const used = meter.requests;
    const percent = Math.min(100, Math.round((used / limit) * 100));
    const resetsAt = endOfUtcWeekMs();
    const daysLeft = Math.max(0, Math.ceil((resetsAt - Date.now()) / (24 * 60 * 60 * 1000)));
    res.json({
      success: true,
      data: {
        percent,
        used,
        limit,
        unit: 'requests',
        resetsAt,
        resetsInDays: daysLeft,
        tokensIn: meter.tokensIn,
        tokensOut: meter.tokensOut,
        weekStart: meter.weekStart,
        source: 'server',
      },
    });
  });

  app.get('/billing/subscription', (req, res) => {
    const priceLabel = config.BILLING_PLAN_PRICE_LABEL || null;
    const period = config.BILLING_PLAN_PERIOD || 'month';
    // Placeholder renew date: end of next calendar month from now (config-driven display only).
    const renews = new Date();
    renews.setUTCMonth(renews.getUTCMonth() + 1);
    renews.setUTCDate(1);
    renews.setUTCHours(0, 0, 0, 0);
    res.json({
      success: true,
      data: {
        planId: config.BILLING_PLAN_ID || 'pro',
        plan: config.BILLING_PLAN_NAME || 'Pro',
        priceLabel, // null/empty => UI shows "Set in server config"
        period,
        renewsAt: renews.getTime(),
        status: config.BILLING_PLAN_STATUS || 'active',
        placeholder: true,
        source: 'server',
      },
    });
  });

  log?.('Billing routes registered: GET /billing/usage, GET /billing/subscription');

  return { recordChatCompletion, readMeter };
}

module.exports = { registerBillingRoutes, startOfUtcWeekMs, endOfUtcWeekMs };
