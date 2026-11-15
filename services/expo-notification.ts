import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { getStoredTokens } from './authService';
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
 * Navigate to the appropriate screen based on the notification data payload.
 */
export function navigateForNotificationData(data: NotificationPayload): void {
    const type = data.type as string | undefined;
    const id = (data.id || data.loanId) as string | undefined;

    console.log('[Notification] Navigating for notification payload:', { type, id, data });

    switch (type) {
        case NotificationType.LOAN_REQUEST:
        case NotificationType.GUARANTOR_APPROVED:
            if (id) {
                router.push({ pathname: '/loan-details', params: { id } });
            } else {
                router.push('/loans');
            }
            break;

        case NotificationType.LOAN_ACTED:
        case NotificationType.LOAN_STATUS:
            if (id) {
                router.push({ pathname: '/loan-details', params: { id } });
            } else {
                router.push('/loans');
            }
            break;

        case NotificationType.GUARANTOR_REQUEST:
            router.push('/guarantor-requests');
            break;

        case NotificationType.GUARANTOR_ACTION:
            if (id) {
                router.push({ pathname: '/loan-details', params: { id } });
            } else {
                router.push('/guarantor-requests');
            }
            break;

        case NotificationType.PAYMENT_REQUEST:
            router.push('/payment-requests');
            break;

        default:
            console.log('[Notification] Unhandled notification type:', type);
            break;
    }
}

/**
 * Handle user interacting with/tapping a notification
 */
function handleNotificationResponse(response: Notifications.NotificationResponse): void {
    const data = response.notification.request.content.data as NotificationPayload | undefined;
    if (!data) return;

    navigateForNotificationData(data);
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
 */
export async function registerDeviceTokenWithBackend(): Promise<boolean> {
    try {
        const { accessToken } = await getStoredTokens();
        if (!accessToken) {
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

/**
 * Check if the app was opened directly from a notification tap when cold-started.
 */
export async function handleInitialNotificationResponse(): Promise<void> {
    try {
        const lastResponse = await Notifications.getLastNotificationResponseAsync();
        if (lastResponse) {
            const data = lastResponse.notification.request.content.data as NotificationPayload | undefined;
            if (data) {
                navigateForNotificationData(data);
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
