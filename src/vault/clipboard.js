/**
 * Copy-to-clipboard with automatic clear after 30s so secrets don't linger.
 */
import * as Clipboard from 'expo-clipboard';

let clearTimer = null;
let lastCopied = null;

export async function copySecret(value, { clearAfterMs = 30_000 } = {}) {
  const text = String(value ?? '');
  await Clipboard.setStringAsync(text);
  lastCopied = text;
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(async () => {
    try {
      const current = await Clipboard.getStringAsync();
      if (current === lastCopied) await Clipboard.setStringAsync('');
    } catch (_) { /* ignore */ }
    lastCopied = null;
    clearTimer = null;
  }, clearAfterMs);
  return { success: true, clearsInMs: clearAfterMs };
}

export function cancelClipboardClear() {
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = null;
  lastCopied = null;
}
