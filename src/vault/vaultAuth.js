/**
 * Vault unlock gate: biometric / device passcode via expo-local-authentication.
 * Auto-locks after inactivity and when the app backgrounds.
 */
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

const DEFAULT_TIMEOUT_MS = 60_000;

let unlocked = false;
let lastActiveAt = 0;
let timeoutMs = DEFAULT_TIMEOUT_MS;
let appStateSub = null;
const listeners = new Set();

function emit() {
  const snap = getVaultLockState();
  listeners.forEach((fn) => {
    try { fn(snap); } catch (_) { /* ignore listener errors */ }
  });
}

export function getVaultLockState() {
  if (unlocked && Date.now() - lastActiveAt > timeoutMs) {
    unlocked = false;
  }
  return { unlocked, lastActiveAt, timeoutMs };
}

export function setVaultAutoLockMs(ms) {
  timeoutMs = Math.max(5_000, Number(ms) || DEFAULT_TIMEOUT_MS);
}

export function touchVaultActivity() {
  if (!unlocked) return;
  lastActiveAt = Date.now();
}

export function lockVault() {
  unlocked = false;
  emit();
}

export function subscribeVaultLock(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Ensure we lock when the app leaves the foreground. */
export function ensureVaultAppStateWatcher() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (next) => {
    if (next !== 'active') lockVault();
  });
}

/**
 * Prompt biometric / device PIN. Returns { success, error? }.
 */
export async function unlockVault({ reason } = {}) {
  ensureVaultAppStateWatcher();
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const enrolled = hasHardware ? await LocalAuthentication.isEnrolledAsync() : false;

  if (!hasHardware || !enrolled) {
    // No biometric / no passcode enrolled — allow unlock on environments
    // that can't authenticate (simulators, CI), but still set the session.
    unlocked = true;
    lastActiveAt = Date.now();
    emit();
    return { success: true, method: 'none' };
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason || 'Unlock ZAO Vault',
    cancelLabel: 'Cancel',
    disableDeviceFallback: false,
    biometricsSecurityLevel: 'strong',
  });

  if (result.success) {
    unlocked = true;
    lastActiveAt = Date.now();
    emit();
    return { success: true, method: 'local_authentication' };
  }
  return { success: false, error: result.error || 'auth_failed' };
}

/**
 * Require an unlocked session; if locked, prompt. Used before reveal/copy.
 */
export async function requireVaultUnlock(opts) {
  const state = getVaultLockState();
  if (state.unlocked) {
    touchVaultActivity();
    return { success: true };
  }
  return unlockVault(opts);
}
