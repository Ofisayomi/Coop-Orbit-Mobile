import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'app_pin_hash';
const PIN_SALT_KEY = 'app_pin_salt';
const PIN_LENGTH_KEY = 'app_pin_length';

export type PinLength = 4 | 6;

async function randomSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

/** True when the user has set an app PIN (required once, right after first login). */
export async function hasAppPin(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(PIN_HASH_KEY)) != null;
  } catch {
    return false;
  }
}

export async function getAppPinLength(): Promise<PinLength> {
  try {
    return (await SecureStore.getItemAsync(PIN_LENGTH_KEY)) === '6' ? 6 : 4;
  } catch {
    return 4;
  }
}

/** Persist a new PIN (hashed with a random salt — the raw PIN is never stored). */
export async function setAppPin(pin: string, length: PinLength): Promise<void> {
  const salt = await randomSalt();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(length));
}

/** Verify a PIN entry against the stored hash (timing-safe enough for device auth). */
export async function verifyAppPin(pin: string): Promise<boolean> {
  try {
    const [hash, salt] = await Promise.all([
      SecureStore.getItemAsync(PIN_HASH_KEY),
      SecureStore.getItemAsync(PIN_SALT_KEY),
    ]);
    if (!hash || !salt) return false;
    return (await hashPin(pin, salt)) === hash;
  } catch {
    return false;
  }
}

/** Remove the stored PIN (used on max-retries lockout so setup runs again after login). */
export async function clearAppPin(): Promise<void> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(PIN_HASH_KEY),
      SecureStore.deleteItemAsync(PIN_SALT_KEY),
      SecureStore.deleteItemAsync(PIN_LENGTH_KEY),
    ]);
  } catch {
    // Best effort.
  }
}
