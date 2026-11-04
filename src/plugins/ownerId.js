/**
 * Stable local owner / recipient id for plugin share dedupe.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const KEY = 'zao.plugin.ownerId';

let cached = null;

export async function getOrCreateOwnerId() {
  if (cached) return cached;
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
  } catch (_) { /* ignore */ }
  const bytes = await Crypto.getRandomBytesAsync(16);
  const id = `usr_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
  try { await AsyncStorage.setItem(KEY, id); } catch (_) { /* ignore */ }
  cached = id;
  return id;
}
