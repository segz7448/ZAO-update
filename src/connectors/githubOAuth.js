/**
 * GitHub OAuth Device Flow (RFC 8628-style as documented by GitHub).
 * Pure state machine + fetch helpers — UI owns presentation.
 *
 * Flow: requestDeviceCode -> show user_code -> pollToken until
 * access_token | expired_token | access_denied | error.
 * Handles slow_down by increasing the poll interval.
 *
 * Client ID comes from app.json extra.githubOAuthClientId (empty by default).
 */
import Constants from 'expo-constants';

export const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
export const GITHUB_DEVICE_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_DEVICE_VERIFY_URL = 'https://github.com/login/device';
export const GITHUB_OAUTH_SCOPES = 'repo read:user user:email';

export function getGithubOAuthClientId() {
  const extra = Constants?.expoConfig?.extra
    || Constants?.manifest?.extra
    || Constants?.manifest2?.extra
    || {};
  const id = (extra.githubOAuthClientId || '').trim();
  return id || null;
}

/** @typedef {'idle'|'awaiting_user'|'polling'|'connected'|'denied'|'expired'|'error'|'not_configured'} DeviceFlowStatus */

/**
 * @typedef {object} DeviceFlowState
 * @property {DeviceFlowStatus} status
 * @property {string|null} userCode
 * @property {string|null} verificationUri
 * @property {string|null} deviceCode
 * @property {number} intervalSec
 * @property {number|null} expiresAt
 * @property {string|null} accessToken
 * @property {string|null} tokenType
 * @property {string|null} scope
 * @property {string|null} error
 * @property {string|null} errorDescription
 */

export function createIdleState() {
  return {
    status: getGithubOAuthClientId() ? 'idle' : 'not_configured',
    userCode: null,
    verificationUri: GITHUB_DEVICE_VERIFY_URL,
    deviceCode: null,
    intervalSec: 5,
    expiresAt: null,
    accessToken: null,
    tokenType: null,
    scope: null,
    error: null,
    errorDescription: null,
  };
}

async function postForm(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body).toString(),
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, json };
}

/**
 * Step 1: ask GitHub for a device + user code.
 * @param {{ clientId?: string, scopes?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function requestDeviceCode(opts = {}) {
  const clientId = (opts.clientId ?? getGithubOAuthClientId()) || null;
  if (!clientId) {
    return { ...createIdleState(), status: 'not_configured', error: 'missing_client_id' };
  }
  const fetchImpl = opts.fetchImpl || fetch;
  const scopes = opts.scopes || GITHUB_OAUTH_SCOPES;
  const response = await fetchImpl(GITHUB_DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ client_id: clientId, scope: scopes }).toString(),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.device_code || !json.user_code) {
    return {
      ...createIdleState(),
      status: 'error',
      error: json.error || 'device_code_failed',
      errorDescription: json.error_description || `HTTP ${response.status}`,
    };
  }
  const intervalSec = Math.max(5, Number(json.interval) || 5);
  const expiresIn = Number(json.expires_in) || 900;
  return {
    status: 'awaiting_user',
    userCode: json.user_code,
    verificationUri: json.verification_uri || GITHUB_DEVICE_VERIFY_URL,
    deviceCode: json.device_code,
    intervalSec,
    expiresAt: Date.now() + expiresIn * 1000,
    accessToken: null,
    tokenType: null,
    scope: json.scope || scopes,
    error: null,
    errorDescription: null,
  };
}

/**
 * Pure reducer for one poll response. Used by pollOnce and unit tests.
 * @param {DeviceFlowState} state
 * @param {object} json  GitHub token endpoint JSON
 */
export function reducePollResponse(state, json) {
  if (!json || typeof json !== 'object') {
    return { ...state, status: 'error', error: 'invalid_response' };
  }
  if (json.access_token) {
    return {
      ...state,
      status: 'connected',
      accessToken: json.access_token,
      tokenType: json.token_type || 'bearer',
      scope: json.scope || state.scope,
      error: null,
      errorDescription: null,
    };
  }
  const err = json.error;
  if (err === 'authorization_pending') {
    return { ...state, status: 'polling', error: null, errorDescription: null };
  }
  if (err === 'slow_down') {
    return {
      ...state,
      status: 'polling',
      intervalSec: (state.intervalSec || 5) + 5,
      error: null,
      errorDescription: null,
    };
  }
  if (err === 'expired_token') {
    return {
      ...state,
      status: 'expired',
      error: 'expired_token',
      errorDescription: json.error_description || 'The device code expired. Start again.',
    };
  }
  if (err === 'access_denied') {
    return {
      ...state,
      status: 'denied',
      error: 'access_denied',
      errorDescription: json.error_description || 'You denied access on GitHub.',
    };
  }
  return {
    ...state,
    status: 'error',
    error: err || 'unknown_error',
    errorDescription: json.error_description || null,
  };
}

/**
 * One token-endpoint poll. Does not sleep — caller owns the interval timer.
 * @param {DeviceFlowState} state
 * @param {{ clientId?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function pollOnce(state, opts = {}) {
  if (!state?.deviceCode) {
    return { ...createIdleState(), status: 'error', error: 'missing_device_code' };
  }
  if (state.expiresAt && Date.now() > state.expiresAt) {
    return {
      ...state,
      status: 'expired',
      error: 'expired_token',
      errorDescription: 'The device code expired. Start again.',
    };
  }
  const clientId = (opts.clientId ?? getGithubOAuthClientId()) || null;
  if (!clientId) {
    return { ...state, status: 'not_configured', error: 'missing_client_id' };
  }
  const fetchImpl = opts.fetchImpl || fetch;
  const response = await fetchImpl(GITHUB_DEVICE_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      device_code: state.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }).toString(),
  });
  const json = await response.json().catch(() => ({}));
  return reducePollResponse({ ...state, status: 'polling' }, json);
}

/**
 * Poll until terminal. Returns final state. `onTick` receives each intermediate state.
 * @param {DeviceFlowState} state
 * @param {{ clientId?: string, fetchImpl?: typeof fetch, sleep?: (ms:number)=>Promise<void>, onTick?: (s:DeviceFlowState)=>void, signal?: { aborted?: boolean } }} [opts]
 */
export async function pollUntilDone(state, opts = {}) {
  const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let current = { ...state, status: 'polling' };
  opts.onTick?.(current);
  while (current.status === 'polling' || current.status === 'awaiting_user') {
    if (opts.signal?.aborted) {
      return { ...current, status: 'error', error: 'aborted', errorDescription: 'Cancelled.' };
    }
    await sleep((current.intervalSec || 5) * 1000);
    if (opts.signal?.aborted) {
      return { ...current, status: 'error', error: 'aborted', errorDescription: 'Cancelled.' };
    }
    current = await pollOnce(current, opts);
    opts.onTick?.(current);
  }
  return current;
}
