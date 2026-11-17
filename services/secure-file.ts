import { cacheDirectory, downloadAsync, getInfoAsync, makeDirectoryAsync } from 'expo-file-system/legacy';

import { getValidAccessToken } from './authService';
import { resolveFileUrl } from './http-client';

const SECURE_FILE_DIR = 'secure-files';
const memoryCache = new Map<string, string>();

function sanitizeFileName(path: string): string {
  const base = path.split('?')[0].split('/').filter(Boolean).pop() || 'file';
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64);
  return safe.includes('.') ? safe : `${safe}.bin`;
}

/**
 * Resolve a protected backend file path (e.g. `/api/Files/{id}`) to a local
 * `file://` URI that image components can load.
 *
 * File downloads go through the authenticated API client path (bearer token
 * with silent refresh), which is why plain `<Image source={{ uri }} />`
 * calls 401: image components never send the Authorization header.
 * Results are cached on disk (and memoized in memory) per backend path.
 */
export async function getSecureFileUri(relativeOrAbsoluteUrl: string | null | undefined): Promise<string | null> {
  if (!relativeOrAbsoluteUrl) return null;
  if (relativeOrAbsoluteUrl.startsWith('file://') || relativeOrAbsoluteUrl.startsWith('data:')) {
    return relativeOrAbsoluteUrl;
  }

  const cached = memoryCache.get(relativeOrAbsoluteUrl);
  if (cached) {
    try {
      const info = await getInfoAsync(cached);
      if (info.exists) return cached;
    } catch {
      // Fall through and re-download.
    }
    memoryCache.delete(relativeOrAbsoluteUrl);
  }

  const absoluteUrl = resolveFileUrl(relativeOrAbsoluteUrl);
  if (!absoluteUrl) return null;

  const token = await getValidAccessToken();
  const dir = `${cacheDirectory}${SECURE_FILE_DIR}`;
  try {
    const dirInfo = await getInfoAsync(dir);
    if (!dirInfo.exists) {
      await makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {
    // Directory will be created implicitly on some platforms; continue.
  }

  const target = `${dir}/${sanitizeFileName(relativeOrAbsoluteUrl)}`;
  const result = await downloadAsync(absoluteUrl, target, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    throw new Error('Unable to load attachment');
  }

  memoryCache.set(relativeOrAbsoluteUrl, result.uri);
  return result.uri;
}

/** Drop one cached file (e.g. after a profile photo is replaced). */
export async function evictSecureFile(relativeOrAbsoluteUrl: string | null | undefined): Promise<void> {
  if (!relativeOrAbsoluteUrl) return;
  memoryCache.delete(relativeOrAbsoluteUrl);
}
