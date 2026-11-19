import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PIN_HASH_KEY = 'app_pin_hash';
const PIN_SALT_KEY = 'app_pin_salt';
const PIN_LENGTH_KEY = 'app_pin_length';

/** Relogin PIN is always 4 digits — the user is never offered a length choice. */
export const APP_PIN_LENGTH = 4;

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

/**
 * PIN length for the lock screen. Reads the stored value so a legacy 6-digit
 * PIN from before the fixed-length change still verifies; all newly set PINs
 * are 4 digits. Falls back to 4 when nothing is stored.
 */
export async function getAppPinLength(): Promise<number> {
  try {
    const stored = await SecureStore.getItemAsync(PIN_LENGTH_KEY);
    const parsed = stored != null ? Number(stored) : NaN;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : APP_PIN_LENGTH;
  } catch {
    return APP_PIN_LENGTH;
  }
}

/** Persist a new 4-digit PIN (hashed with a random salt — the raw PIN is never stored). */
export async function setAppPin(pin: string): Promise<void> {
  const salt = await randomSalt();
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_SALT_KEY, salt);
  await SecureStore.setItemAsync(PIN_HASH_KEY, hash);
  await SecureStore.setItemAsync(PIN_LENGTH_KEY, String(APP_PIN_LENGTH));
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
