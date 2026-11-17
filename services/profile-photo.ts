import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { withExternalActivity } from './authService';

/** Profile photos must not exceed 200KB once decoded (mirrors the backend limit). */
export const MAX_PROFILE_PHOTO_BYTES = 200 * 1024;

export const ALLOWED_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png'];

export interface ProfilePhotoFile {
  uri: string;
  name: string;
  mimeType: string;
  /** Base64 data-URL ready for the API (`data:image/...;base64,...`). */
  dataUrl: string;
}

export interface PickPhotoResult {
  photo?: ProfilePhotoFile;
  error?: string;
}

/**
 * Let the user pick a JPEG/PNG photo (max 200KB decoded) and read it as a
 * base64 data-URL for upload. Returns `{ photo }` on success, `{ error }` on
 * rejection, or `{}` when the user cancels.
 */
export async function pickProfilePhoto(): Promise<PickPhotoResult> {
  const result = await withExternalActivity(() => DocumentPicker.getDocumentAsync({
    type: ['image/jpeg', 'image/png'],
    copyToCacheDirectory: true,
    multiple: false,
  }));
  if (result.canceled || !result.assets?.length) return {};

  const asset = result.assets[0];
  const mimeType = asset.mimeType || 'image/jpeg';
  if (!ALLOWED_PROFILE_PHOTO_TYPES.includes(mimeType)) {
    return { error: 'Profile photo must be a JPEG or PNG image.' };
  }
  if (asset.size != null && asset.size > MAX_PROFILE_PHOTO_BYTES) {
    return { error: 'Profile photo must not be more than 200KB.' };
  }

  let base64: string;
  try {
    base64 = await readAsStringAsync(asset.uri, { encoding: EncodingType.Base64 });
  } catch {
    return { error: 'Could not read the selected photo.' };
  }

  if (Math.floor(base64.length * 0.75) > MAX_PROFILE_PHOTO_BYTES) {
    return { error: 'Profile photo must not be more than 200KB.' };
  }

  return {
    photo: {
      uri: asset.uri,
      name: asset.name || 'profile-photo.jpg',
      mimeType,
      dataUrl: `data:${mimeType};base64,${base64}`,
    },
  };
}
