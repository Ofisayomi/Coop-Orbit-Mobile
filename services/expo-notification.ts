import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { getStoredTokens, getValidAccessToken } from './authService';
import { getOrCreateDeviceId } from './device';
import { apiClient } from './http-client';

export const NotificationType = {
    LOAN_REQUEST: 'loan_request',
    GUARANTOR_REQUEST: 'guarantor_request',
    GUARANTOR_ACTION: 'guarantor_action',
    GUARANTOR_APPROVED: 'guarantor_approved',
    LOAN_ACTED: 'loan_acted',
    LOAN_STATUS: 'loan_status',
    PAYMENT_REQUEST: 'payment_request',
    SUPPORT_TICKET: 'support_ticket',
} as const;

export type NotificationPayload = Record<string, unknown>;

// Configure foreground notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        // shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowList: true,
        shouldShowBanner: true,
    }),
});

/**
 * Exact in-app destination for a notification type. Kept as route literals
 * so expo-router's typed routes still check the push/replace calls.
 */
export type NotificationRoute =
    | { pathname: '/loan-details'; params: { id: string } }
    | { pathname: '/loans'; params?: undefined }
    | { pathname: '/guarantor-requests'; params?: undefined }
    | { pathname: '/payment-requests'; params?: undefined }
    | { pathname: '/support-tickets'; params?: undefined }
    | { pathname: '/ticket-detail'; params: { id: string } };

const PENDING_NOTIFICATION_ROUTE_KEY = 'pending_notification_route';
// A tap that is never followed by a login (e.g. user dismisses it) must not
// reroute a much later sign-in.
const PENDING_ROUTE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Map a notification data payload to its exact screen. Returns null for
 * unknown types (caller stays where it is).
 */
export function resolveNotificationRoute(data: NotificationPayload): NotificationRoute | null {
    const type = data.type as string | undefined;
    const id = (data.id || data.loanId) as string | undefined;

    console.log('[Notification] Resolving route for notification payload:', { type, id, data });

    switch (type) {
        case NotificationType.LOAN_REQUEST:
        case NotificationType.GUARANTOR_APPROVED:
        case NotificationType.LOAN_ACTED:
        case NotificationType.LOAN_STATUS:
            return id ? { pathname: '/loan-details', params: { id } } : { pathname: '/loans' };

        case NotificationType.GUARANTOR_REQUEST:
            return { pathname: '/guarantor-requests' };

        case NotificationType.GUARANTOR_ACTION:
            return id ? { pathname: '/loan-details', params: { id } } : { pathname: '/guarantor-requests' };

        case NotificationType.PAYMENT_REQUEST:
            return { pathname: '/payment-requests' };

        case NotificationType.SUPPORT_TICKET: {
            const ticketId = data.ticketId as string | undefined;
            return ticketId ? { pathname: '/ticket-detail', params: { id: ticketId } } : { pathname: '/support-tickets' };
        }

        default:
            console.log('[Notification] Unhandled notification type:', type);
            return null;
    }
}

/**
 * Remember where a tap should land. A login or fingerprint detour
 * (cold start, expired session) replaces the navigation stack and would
 * otherwise strand the user on the dashboard; the post-auth flow consumes
 * this and lands on the exact screen instead.
 */
export async function savePendingNotificationRoute(route: NotificationRoute): Promise<void> {
    try {
        await SecureStore.setItemAsync(
            PENDING_NOTIFICATION_ROUTE_KEY,
            JSON.stringify({ ...route, savedAt: Date.now() })
        );
    } catch (error) {
        console.error('[Notification] Error saving pending notification route:', error);
    }
}

/**
 * Take the saved destination (once) for post-auth navigation. Expired or
 * missing entries resolve to null so only a fresh tap reroutes a sign-in.
 */
export async function consumePendingNotificationRoute(): Promise<NotificationRoute | null> {
    try {
        const raw = await SecureStore.getItemAsync(PENDING_NOTIFICATION_ROUTE_KEY);
        if (!raw) return null;
        await SecureStore.deleteItemAsync(PENDING_NOTIFICATION_ROUTE_KEY);
        const parsed = JSON.parse(raw) as { pathname?: unknown; params?: unknown; savedAt?: unknown };
        if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > PENDING_ROUTE_TTL_MS) {
            return null;
        }
        switch (parsed.pathname) {
            case '/loan-details': {
                const params = parsed.params as { id?: unknown } | undefined;
                if (typeof params?.id !== 'string' || !params.id) return null;
                return { pathname: '/loan-details', params: { id: params.id } };
            }
            case '/loans':
                return { pathname: '/loans' };
            case '/guarantor-requests':
                return { pathname: '/guarantor-requests' };
            case '/payment-requests':
                return { pathname: '/payment-requests' };
            case '/support-tickets':
                return { pathname: '/support-tickets' };
            case '/ticket-detail': {
                const params = parsed.params as { id?: unknown } | undefined;
                if (typeof params?.id !== 'string' || !params.id) return null;
                return { pathname: '/ticket-detail', params: { id: params.id } };
            }
            default:
                return null;
        }
    } catch (error) {
        console.error('[Notification] Error consuming pending notification route:', error);
        return null;
    }
}

/**
 * Clear a saved tap destination without consuming it (e.g. on logout, so a
 * later sign-in never lands on someone else's notification).
 */
export async function clearPendingNotificationRoute(): Promise<void> {
    try {
        await SecureStore.deleteItemAsync(PENDING_NOTIFICATION_ROUTE_KEY);
    } catch (error) {
        console.error('[Notification] Error clearing pending notification route:', error);
    }
}

/**
 * Navigate to the appropriate screen based on the notification data payload.
 * With a live session the tap lands immediately; otherwise the destination
 * is persisted and the login flow consumes it after auth, so the user still
 * reaches the exact screen instead of the dashboard.
 */
export async function navigateForNotificationData(data: NotificationPayload): Promise<void> {
    const route = resolveNotificationRoute(data);
    if (!route) return;
    await savePendingNotificationRoute(route);
    try {
        const { refreshToken, accessToken } = await getStoredTokens();
        if (refreshToken || accessToken) {
            router.push(route);
            return;
        }
    } catch (error) {
        console.error('[Notification] Error reading stored tokens:', error);
    }
    router.replace('/login');
}

/**
 * Handle user interacting with/tapping a notification
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as NotificationPayload | undefined;
    if (!data) return;

    void navigateForNotificationData(data);
}

/**
 * Request notification permissions and obtain the Expo Push Token.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
    if (!Device.isDevice) {
        console.warn('[Push] Push notifications require a physical device');
        return null;
    }

    try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.warn('[Push] Failed to get push token permission!');
            return null;
        }

        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#002B49',
            });
        }

        return tokenData.data;
    } catch (error) {
        console.error('[Push] Error getting Expo push token:', error);
        return null;
    }
}

/**
 * Register device push token with the backend API for the currently authenticated user.
 * Runs after the first successful login (and as a safety net on dashboard mount):
 * the session is proven via the refresh flow, not the SecureStore access token,
 * which is intentionally never persisted there.
 */
export async function registerDeviceTokenWithBackend(): Promise<boolean> {
    try {
        try {
            await getValidAccessToken();
        } catch {
            console.log('[Push] User not logged in, skipping device registration.');
            return false;
        }

        const pushToken = await registerForPushNotificationsAsync();
        if (!pushToken) {
            console.warn('[Push] Unable to obtain push token.');
            return false;
        }

        const deviceId = await getOrCreateDeviceId();
        console.log('[Push] Registering push token with backend:', { deviceId, pushToken });

        const response = await apiClient.post('/api/devices/register', {
            body: JSON.stringify({
                pushToken,
                deviceId,
            }),
        });

        if (!response.ok) {
            console.warn('[Push] Failed to register push token with backend. Status:', response.status);
            return false;
        }

        console.log('[Push] Successfully registered push token with backend.');
        return true;
    } catch (error) {
        console.error('[Push] Error registering device push token:', error);
        return false;
    }
}

export interface DeviceNotificationStatus {
    registered: boolean;
    isEnabled: boolean;
}

/**
 * Read this device's server-side notification status. Returns null when the
 * session is dead or the backend is unreachable (caller keeps its last state).
 */
export async function getDeviceNotificationStatus(): Promise<DeviceNotificationStatus | null> {
    try {
        const deviceId = await getOrCreateDeviceId();
        const response = await apiClient.get(`/api/devices/status?deviceId=${encodeURIComponent(deviceId)}`);
        if (!response.ok) {
            console.warn('[Push] Failed to load device notification status:', response.status);
            return null;
        }
        const json = (await response.json()) as { registered?: boolean; isEnabled?: boolean };
        return { registered: json.registered === true, isEnabled: json.isEnabled === true };
    } catch (error) {
        console.error('[Push] Error loading device notification status:', error);
        return null;
    }
}

/**
 * Explicit user opt-in/opt-out from Settings. Enabling (re)registers the Expo
 * push token; disabling keeps the server row so one tap re-enables later.
 */
export async function setDeviceNotificationsEnabled(enabled: boolean): Promise<boolean> {
    try {
        const deviceId = await getOrCreateDeviceId();

        let pushToken: string | null = null;
        if (enabled) {
            pushToken = await registerForPushNotificationsAsync();
            if (!pushToken) {
                console.warn('[Push] Cannot enable notifications without a push token.');
                return false;
            }
        }

        const response = await apiClient.put('/api/devices/preference', {
            body: JSON.stringify({
                deviceId,
                pushToken: pushToken ?? undefined,
                isEnabled: enabled,
            }),
        });

        if (!response.ok) {
            console.warn('[Push] Failed to update notification preference:', response.status);
            return false;
        }

        return true;
    } catch (error) {
        console.error('[Push] Error updating notification preference:', error);
        return false;
    }
}

/**
 * Check if the app was opened directly from a notification tap when cold-started.
 */
export async function handleInitialNotificationResponse(): Promise<void> {
    try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
            const data = lastResponse.notification.request.content.data as NotificationPayload | undefined;
            if (data) {
                await navigateForNotificationData(data);
            }
            await Notifications.clearLastNotificationResponseAsync();
        }
    } catch (error) {
        console.error('[Push] Error checking initial notification response:', error);
    }
}

/**
 * Setup listeners for incoming foreground notifications and notification response taps.
 */
export function setupAppNotificationListeners(): () => void {
    const notificationListener = Notifications.addNotificationReceivedListener((notification) => {
        console.log('[Push] Notification received in foreground:', notification.request.content);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('[Push] User interacted with notification:', response.notification.request.content);
        handleNotificationResponse(response);
    });

    // Check cold-start notification
    void handleInitialNotificationResponse();

    return () => {
        notificationListener.remove();
        responseListener.remove();
    };
}
