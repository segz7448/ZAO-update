/**
 * App client for server /vpn/* endpoints.
 * Uses the same backend base URL + auth as backendClient.
 */
import { usePreferencesStore } from '../store/preferencesStore';

function connection() {
  const prefs = usePreferencesStore.getState().preferences || {};
  const baseUrl = (prefs.backend_vm_url || '').replace(/\/+$/, '') || null;
  return {
    baseUrl,
    token: prefs.backend_auth_token || null,
  };
}

async function vpnFetch(path, { method = 'GET', body } = {}) {
  const { baseUrl, token } = connection();
  if (!baseUrl) {
    return { success: false, error: 'NOT_CONFIGURED', offline: true };
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: json.error || `HTTP_${res.status}`, ...json };
    }
    return json.success === false ? json : { success: true, ...json };
  } catch (e) {
    return { success: false, error: 'NETWORK', message: e.message, offline: true };
  }
}

export const vpnClient = {
  status: () => vpnFetch('/vpn/status'),
  locations: () => vpnFetch('/vpn/locations'),
  plans: () => vpnFetch('/vpn/plans'),
  quote: (body) => vpnFetch('/vpn/quote', { method: 'POST', body }),
  list: () => vpnFetch('/vpn/list'),
  purchase: (body) => vpnFetch('/vpn/purchase', { method: 'POST', body }),
  renew: (id, planId) => vpnFetch(`/vpn/${id}/renew`, { method: 'POST', body: { planId } }),
  change: (id, regionId) => vpnFetch(`/vpn/${id}/change`, { method: 'POST', body: { regionId } }),
  release: (id) => vpnFetch(`/vpn/${id}/release`, { method: 'POST', body: {} }),
  remove: (id) => vpnFetch(`/vpn/${id}`, { method: 'DELETE' }),
  activate: (id) => vpnFetch(`/vpn/${id}/activate`, { method: 'POST', body: {} }),
  deactivate: () => vpnFetch('/vpn/deactivate', { method: 'POST', body: {} }),
  usage: (id) => vpnFetch(`/vpn/${id}/usage`),
  reputation: (id) => vpnFetch(`/vpn/${id}/reputation`),
};

export const VPN_MAX = 5;
