/**
 * Client for server plugin share endpoints.
 */
import { usePreferencesStore } from '../store/preferencesStore';
import { getOrCreateOwnerId } from './ownerId';
import {
  installSharedPlugin, pluginToManifest, setPluginShareToken, setPluginInstallStats, getPlugin,
} from './pluginService';

function connection() {
  const prefs = usePreferencesStore.getState().preferences || {};
  const baseUrl = (prefs.backend_vm_url || '').replace(/\/+$/, '') || null;
  return {
    baseUrl,
    token: prefs.backend_auth_token || null,
  };
}

async function api(path, { method = 'GET', body } = {}) {
  const { baseUrl, token } = connection();
  if (!baseUrl) return { success: false, error: 'NOT_CONFIGURED', offline: true };
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
      return { success: false, error: json.error || `HTTP_${res.status}`, status: res.status };
    }
    return json.success === false ? json : { success: true, data: json.data ?? json };
  } catch (e) {
    return { success: false, error: 'NETWORK', message: e.message, offline: true };
  }
}

/** Public fetch (no auth) via /p/:token/json */
export async function fetchSharedPluginPublic(shareToken) {
  const { baseUrl } = connection();
  if (!baseUrl) return { success: false, error: 'NOT_CONFIGURED' };
  try {
    const res = await fetch(`${baseUrl}/p/${encodeURIComponent(shareToken)}/json`);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: json.error || `HTTP_${res.status}`, status: res.status };
    return { success: true, data: json.data };
  } catch (e) {
    return { success: false, error: 'NETWORK', message: e.message };
  }
}

export async function createPluginShare(plugin) {
  if (!plugin || plugin.source !== 'created') {
    return { success: false, error: 'ONLY_OWNER_CAN_SHARE' };
  }
  const ownerId = plugin.ownerId || await getOrCreateOwnerId();
  const prefs = usePreferencesStore.getState().preferences || {};
  const ownerName = prefs.display_name || prefs.user_name || 'ZAO user';
  const result = await api(`/plugins/${encodeURIComponent(plugin.id)}/share`, {
    method: 'POST',
    body: {
      ownerId,
      ownerName,
      manifest: pluginToManifest(plugin),
      allowReshare: !!plugin.allowReshare,
    },
  });
  if (result.success && result.data?.token) {
    await setPluginShareToken(plugin.id, result.data.token);
  }
  return result;
}

export async function revokePluginShare(plugin) {
  if (!plugin?.shareToken) return { success: false, error: 'NO_SHARE' };
  const ownerId = plugin.ownerId || await getOrCreateOwnerId();
  const result = await api(`/plugins/share/${encodeURIComponent(plugin.shareToken)}/revoke`, {
    method: 'POST',
    body: { ownerId },
  });
  if (result.success) {
    await setPluginShareToken(plugin.id, null);
  }
  return result;
}

export async function refreshPluginShareStats(plugin) {
  if (!plugin?.id) return { success: false, error: 'NO_PLUGIN' };
  const ownerId = plugin.ownerId || await getOrCreateOwnerId();
  const result = await api(
    `/plugins/${encodeURIComponent(plugin.id)}/share/stats?ownerId=${encodeURIComponent(ownerId)}`
  );
  if (result.success && result.data) {
    await setPluginInstallStats(plugin.id, {
      installs: result.data.installs || 0,
      active: result.data.active || 0,
      sparkline: result.data.sparkline || [],
    });
    return getPlugin(plugin.id);
  }
  return result;
}

export async function recordSharedInstall(shareToken) {
  const recipientId = await getOrCreateOwnerId();
  return api(`/plugins/share/${encodeURIComponent(shareToken)}/install`, {
    method: 'POST',
    body: { recipientId },
  });
}

export async function recordSharedUninstall(shareToken) {
  const recipientId = await getOrCreateOwnerId();
  return api(`/plugins/share/${encodeURIComponent(shareToken)}/uninstall`, {
    method: 'POST',
    body: { recipientId },
  });
}

import { checkSharedPluginCompatibility } from './shareCompat';
export { checkSharedPluginCompatibility };

export async function installFromShareToken(shareToken, { knownTools } = {}) {
  const fetched = await fetchSharedPluginPublic(shareToken);
  if (!fetched.success) return fetched;
  const snapshot = fetched.data;
  const compat = checkSharedPluginCompatibility(snapshot, { knownTools });
  if (!compat.ok) {
    return { success: false, error: 'INCOMPATIBLE', compat, snapshot };
  }
  const installed = await installSharedPlugin(snapshot, { knownTools });
  if (!installed.success) return installed;
  await recordSharedInstall(shareToken);
  return { success: true, data: installed.data, snapshot };
}

export { connection as getShareConnection };
