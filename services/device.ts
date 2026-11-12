import * as Application from 'expo-application';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_CACHE_KEY = 'app_device_id';

export async function getOrCreateDeviceId(): Promise<string> {
    // Try retrieving persistent UUID from SecureStore
    let deviceId = await SecureStore.getItemAsync(DEVICE_ID_CACHE_KEY);

    if (!deviceId) {
        // Fallback to native hardware Android/iOS ID or generate a new UUID
        deviceId =
            Platform.OS === 'android'
                ? Application.androidId
                : await Application.getIosIdForVendorAsync();

        if (!deviceId) {
            deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        }

        await SecureStore.setItemAsync(DEVICE_ID_CACHE_KEY, deviceId);
    }

    return deviceId;
}