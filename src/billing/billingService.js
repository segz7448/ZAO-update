/**
 * Settings > Usage billing interface.
 *
 * Prefers the VM's GET /billing/* stubs; falls back to a local estimate from
 * this device's usage_log / messages when the backend is unreachable.
 * Plan/pricing are config placeholders — never invent fake store prices.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferencesStore } from '../store/preferencesStore';
import { getUsageCounts, countMessagesSince, countAgentActionsSince } from '../db/database';

export const DEFAULT_WEEKLY_LIMIT = 100;

const SOFT_LIMIT_KEY = 'zao_billing_soft_limit_enabled';
const ALERT_PCT_KEY = 'zao_billing_alert_percent';

function startOfLocalWeekMs(now = Date.now()) {
  const d = new Date(now);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d.getTime();
}

function endOfLocalWeekMs(now = Date.now()) {
  return startOfLocalWeekMs(now) + 7 * 24 * 60 * 60 * 1000;
}

function getConnection() {
  const prefs = usePreferencesStore.getState().preferences || {};
  const baseUrl = prefs.backend_vm_url ? String(prefs.backend_vm_url).replace(/\/+$/, '') : null;
  return { baseUrl, token: prefs.backend_auth_token || null };
}

async function fetchBilling(path) {
  const { baseUrl, token } = getConnection();
  if (!baseUrl || !token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data || json;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function localWeeklyUsage() {
  const since = startOfLocalWeekMs();
  const [counts, messages, actions] = await Promise.all([
    getUsageCounts(since),
    countMessagesSince(since, 'user'),
    countAgentActionsSince(since),
  ]);
  const c = counts.data || {};
  const usedFromEvents = Object.values(c).reduce((a, b) => a + (Number(b) || 0), 0);
  const used = Math.max(Number(messages.data) || 0, usedFromEvents, Number(actions.data) || 0);
  const limit = DEFAULT_WEEKLY_LIMIT;
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const resetsAt = endOfLocalWeekMs();
  const resetsInDays = Math.max(0, Math.ceil((resetsAt - Date.now()) / (24 * 60 * 60 * 1000)));
  return {
    percent,
    used,
    limit,
    unit: 'requests',
    resetsAt,
    resetsInDays,
    source: 'local',
  };
}

function localSubscriptionPlaceholder() {
  const renews = new Date();
  renews.setMonth(renews.getMonth() + 1);
  renews.setDate(1);
  renews.setHours(0, 0, 0, 0);
  return {
    planId: 'pro',
    plan: 'Pro',
    priceLabel: null,
    period: 'month',
    renewsAt: renews.getTime(),
    status: 'active',
    placeholder: true,
    source: 'local',
  };
}

export async function getWeeklyUsage() {
  const remote = await fetchBilling('/billing/usage');
  if (remote && typeof remote.percent === 'number') {
    return {
      percent: remote.percent,
      used: remote.used ?? null,
      limit: remote.limit ?? DEFAULT_WEEKLY_LIMIT,
      unit: remote.unit || 'requests',
      resetsAt: remote.resetsAt || endOfLocalWeekMs(),
      resetsInDays:
        remote.resetsInDays ??
        Math.max(0, Math.ceil(((remote.resetsAt || endOfLocalWeekMs()) - Date.now()) / 86400000)),
      source: remote.source || 'server',
    };
  }
  return localWeeklyUsage();
}

export async function getSubscription() {
  const remote = await fetchBilling('/billing/subscription');
  if (remote && remote.plan) {
    return {
      planId: remote.planId || 'pro',
      plan: remote.plan,
      priceLabel: remote.priceLabel || null,
      period: remote.period || 'month',
      renewsAt: remote.renewsAt || null,
      status: remote.status || 'active',
      placeholder: remote.placeholder !== false,
      source: remote.source || 'server',
    };
  }
  return localSubscriptionPlaceholder();
}

export async function getUsageManagePrefs() {
  try {
    const [soft, alert] = await Promise.all([
      AsyncStorage.getItem(SOFT_LIMIT_KEY),
      AsyncStorage.getItem(ALERT_PCT_KEY),
    ]);
    return {
      softLimitEnabled: soft === '1' || soft === 'true',
      alertPercent: alert != null ? Number(alert) : 80,
    };
  } catch (_) {
    return { softLimitEnabled: false, alertPercent: 80 };
  }
}

export async function setSoftLimitEnabled(enabled) {
  try {
    await AsyncStorage.setItem(SOFT_LIMIT_KEY, enabled ? '1' : '0');
  } catch (_) {}
}

export async function setAlertPercent(pct) {
  try {
    await AsyncStorage.setItem(
      ALERT_PCT_KEY,
      String(Math.max(1, Math.min(100, Number(pct) || 80)))
    );
  } catch (_) {}
}
