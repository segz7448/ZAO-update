/**
 * GitHub account connection — OAuth device flow (preferred) or PAT fallback.
 * Persists via storeApiKey('github') + vault connector item sync.
 */
import { storeApiKey, deleteApiKey, getApiKey, updatePreferences } from '../db/database';
import {
  createIdleState,
  requestDeviceCode,
  pollUntilDone,
  getGithubOAuthClientId,
  GITHUB_DEVICE_VERIFY_URL,
} from './githubOAuth';
import { syncGithubConnectorVaultItem, removeGithubConnectorVaultItem } from '../vault/vaultService';

const API_BASE = 'https://api.github.com';

export async function fetchGithubUser(token) {
  const response = await fetch(`${API_BASE}/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      success: false,
      error: { status: response.status, message: json.message || `HTTP ${response.status}` },
    };
  }
  const scopes = response.headers?.get?.('x-oauth-scopes') || null;
  return {
    success: true,
    data: {
      login: json.login,
      name: json.name || null,
      avatarUrl: json.avatar_url || null,
      htmlUrl: json.html_url || null,
      scopes: scopes ? scopes.split(',').map((s) => s.trim()).filter(Boolean) : [],
      id: json.id,
    },
  };
}

export async function getGithubConnectionStatus() {
  const key = await getApiKey('github');
  const token = key?.data?.key_value || null;
  if (!token) {
    return {
      configured: false,
      clientConfigured: !!getGithubOAuthClientId(),
      account: null,
    };
  }
  const user = await fetchGithubUser(token);
  return {
    configured: true,
    clientConfigured: !!getGithubOAuthClientId(),
    account: user.success
      ? { ...user.data, tokenPresent: true }
      : { login: null, name: null, avatarUrl: null, scopes: [], tokenPresent: true, error: user.error },
  };
}

export async function connectGithubWithToken(token, { username } = {}) {
  const trimmed = String(token || '').trim();
  if (!trimmed) return { success: false, error: { message: 'Token required' } };
  const user = await fetchGithubUser(trimmed);
  if (!user.success) return { success: false, error: user.error };
  await storeApiKey('github', trimmed, true);
  const login = username || user.data.login;
  await updatePreferences({ github_username: login, github_tools_enabled: true });
  await syncGithubConnectorVaultItem({
    token: trimmed,
    login: user.data.login,
    name: user.data.name,
    avatarUrl: user.data.avatarUrl,
    scopes: user.data.scopes,
  });
  return { success: true, data: user.data };
}

export async function disconnectGithub() {
  await deleteApiKey('github');
  await updatePreferences({ github_username: null });
  await removeGithubConnectorVaultItem();
  return { success: true };
}

/**
 * Run the full device-flow connect. `onState` receives each DeviceFlowState.
 * Returns { success, data?, error?, state }.
 */
export async function connectGithubWithDeviceFlow({ onState, signal, sleep, fetchImpl } = {}) {
  if (!getGithubOAuthClientId()) {
    const state = { ...createIdleState(), status: 'not_configured' };
    onState?.(state);
    return { success: false, error: { message: 'Connector not configured yet' }, state };
  }
  let state = await requestDeviceCode({ fetchImpl });
  onState?.(state);
  if (state.status !== 'awaiting_user') {
    return { success: false, error: { message: state.errorDescription || state.error }, state };
  }
  state = await pollUntilDone(state, { onTick: onState, signal, sleep, fetchImpl });
  if (state.status !== 'connected' || !state.accessToken) {
    return {
      success: false,
      error: { message: state.errorDescription || state.error || 'Not connected' },
      state,
    };
  }
  const saved = await connectGithubWithToken(state.accessToken);
  return { ...saved, state };
}

export { createIdleState, GITHUB_DEVICE_VERIFY_URL, getGithubOAuthClientId };
