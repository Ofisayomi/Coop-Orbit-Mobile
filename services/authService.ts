import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

const KEYCLOAK_URL = process.env.EXPO_PUBLIC_KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.EXPO_PUBLIC_KEYCLOAK_REALM;
const KEYCLOAK_CLIENT_ID = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID;

const TOKEN_ENDPOINT = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
const LOGOUT_ENDPOINT = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/logout`;

interface JWTPayload {
    exp: number;
    iat: number;
    sub: string;
    [key: string]: any;
}

/**
 * Check if a given JWT token is expired or about to expire (within threshold seconds)
 */
export function isTokenExpiredOrExpiring(token: string, thresholdSeconds = 30): boolean {
    try {
        const decoded = jwtDecode<JWTPayload>(token);
        if (!decoded.exp) return true;
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp - currentTime < thresholdSeconds;
    } catch {
        return true;
    }
}

/**
 * Retrieve stored tokens from secure store
 */
export async function getStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
    const [accessToken, refreshToken] = await Promise.all([
        SecureStore.getItemAsync('access_token'),
        SecureStore.getItemAsync('refresh_token'),
    ]);
    return { accessToken, refreshToken };
}

/**
 * Use the refresh token to obtain a new access token from Keycloak.
 * Returns the new access token on success, throws on failure.
 */
export async function refreshAccessToken(): Promise<string | null> {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) {
        return null;
    }

    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: KEYCLOAK_CLIENT_ID || 'coop-assist-mobile',
        refresh_token: refreshToken,
    }).toString();

    const response = await fetch(TOKEN_ENDPOINT!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
    });

    if (!response.ok) {
        const error = await response.text();
        return null;
    }

    const data = await response.json();

    // Persist new tokens
    await SecureStore.setItemAsync('access_token', data.access_token);
    if (data.refresh_token) {
        await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    }

    return data.access_token;
}

/**
 * Get a valid access token. If the current one is expired/expiring, refresh it.
 * Throws if refresh fails (caller should redirect to login).
 */
export async function getValidAccessToken(): Promise<string | null> {
    const { accessToken } = await getStoredTokens();

    if (accessToken && !isTokenExpiredOrExpiring(accessToken)) {
        return accessToken;
    }

    // Token expired or expiring - try refresh
    return await refreshAccessToken();
}

/**
 * Perform Keycloak logout by invalidating the refresh token server-side,
 * then clear all stored tokens.
 */
export async function logout(): Promise<void> {
    try {
        const { refreshToken } = await getStoredTokens();

        if (refreshToken) {
            const body = new URLSearchParams({
                client_id: KEYCLOAK_CLIENT_ID || 'coop-assist-mobile',
                refresh_token: refreshToken,
            }).toString();

            // Best-effort: logout from Keycloak server
            await fetch(LOGOUT_ENDPOINT!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            });
        }
    } catch (error) {
        console.error('Error during Keycloak logout:', error);
        // Continue clearing local tokens even if server request fails
    } finally {
        // Always clear local tokens
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        // Drop any saved notification destination (canonical key owned by
        // services/expo-notification.ts) so a later sign-in never lands on
        // a stale tap. Kept inline to avoid an import cycle with that module.
        await SecureStore.deleteItemAsync('pending_notification_route');
        setBiometricSessionVerified(false);
    }
}

/**
 * Try to silently authenticate using refresh token.
 * Returns true if successful (tokens refreshed), false if not possible.
 */
export async function trySilentRefresh(): Promise<boolean> {
    try {
        const { refreshToken, accessToken } = await getStoredTokens();

        if (!refreshToken) return false;

        // If access token is still valid, no need to refresh
        if (accessToken && !isTokenExpiredOrExpiring(accessToken)) {
            return true;
        }

        // Try to use refresh token — report whether it actually worked so
        // callers don't offer biometric login for a dead session.
        const newToken = await refreshAccessToken();
        return newToken != null;
    } catch {
        return false;
    }
}

let _isBiometricVerifiedInSession = false;

export function isBiometricSessionVerified(): boolean {
    return _isBiometricVerifiedInSession;
}

export function setBiometricSessionVerified(verified: boolean): void {
    _isBiometricVerifiedInSession = verified;
}

/**
 * How long the app may stay in the background before the biometric
 * session lock re-engages. Short trips away from the app — e.g. tapping a
 * notification, or opening the authenticator app to copy a 2FA code while
 * signing in — must not force re-authentication.
 */
export const APP_LOCK_GRACE_MS = 2 * 60 * 1000;

const APP_BACKGROUNDED_AT_KEY = 'app_backgrounded_at';

let _lastBackgroundedAt: number | null = null;

/**
 * Record the moment the app went to the background. Persisted so the grace
 * period survives an OS process restart (e.g. the app was recycled while
 * the user tapped a notification or fetched a 2FA code).
 */
export async function markAppBackgrounded(now = Date.now()): Promise<void> {
    _lastBackgroundedAt = now;
    try {
        await SecureStore.setItemAsync(APP_BACKGROUNDED_AT_KEY, now.toString());
    } catch (error) {
        console.error('Error persisting app background timestamp:', error);
    }
}

/** Clear the background timestamp (called when returning within the grace period). */
export async function clearAppBackgrounded(): Promise<void> {
    _lastBackgroundedAt = null;
    try {
        await SecureStore.deleteItemAsync(APP_BACKGROUNDED_AT_KEY);
    } catch (error) {
        console.error('Error clearing persisted app background timestamp:', error);
    }
}

/**
 * True when the app was backgrounded longer than the grace period.
 * A fresh launch (no timestamp recorded) counts as expired so a cold
 * start always begins locked; the login screen then unlocks via biometrics.
 */
export function isAppLockExpired(now = Date.now()): boolean {
    if (_lastBackgroundedAt == null) return true;
    return now - _lastBackgroundedAt > APP_LOCK_GRACE_MS;
}

/**
 * True when the app returned within the grace period, reading the persisted
 * timestamp when the in-memory one was lost to a process restart. A return
 * with no recorded backgrounding (genuine cold start) is NOT within grace.
 */
export async function isWithinAppLockGrace(now = Date.now()): Promise<boolean> {
    let backgroundedAt = _lastBackgroundedAt;
    if (backgroundedAt == null) {
        try {
            const stored = await SecureStore.getItemAsync(APP_BACKGROUNDED_AT_KEY);
            const parsed = stored != null ? Number(stored) : NaN;
            backgroundedAt = Number.isFinite(parsed) ? parsed : null;
            _lastBackgroundedAt = backgroundedAt;
        } catch (error) {
            console.error('Error reading persisted app background timestamp:', error);
            return false;
        }
    }
    return backgroundedAt != null && now - backgroundedAt < APP_LOCK_GRACE_MS;
}

/**
 * Verifies and proactively refreshes the access token after biometric authentication.
 * If the current token is missing, expired, or expiring within thresholdSeconds (default 120s),
 * it calls Keycloak using the refresh token to acquire a fresh access token so that
 * the user will not be logged out abruptly while using the app.
 */
export async function ensureFreshTokenAfterBiometrics(thresholdSeconds = 120): Promise<{
    success: boolean;
    refreshed: boolean;
    error?: string;
}> {
    try {
        const { refreshToken, accessToken } = await getStoredTokens();

        if (!refreshToken) {
            setBiometricSessionVerified(false);
            return {
                success: false,
                refreshed: false,
                error: 'No active session found. Please sign in with your username and password.',
            };
        }

        // Check if access token is missing, expired, or about to expire within thresholdSeconds
        const needsRefresh = !accessToken || isTokenExpiredOrExpiring(accessToken, thresholdSeconds);

        if (needsRefresh) {
            try {
                await refreshAccessToken();
                setBiometricSessionVerified(true);
                return { success: true, refreshed: true };
            } catch (refreshErr) {
                console.error('Failed to refresh token after biometrics:', refreshErr);
                await logout();
                setBiometricSessionVerified(false);
                return {
                    success: false,
                    refreshed: false,
                    error: 'Your session has expired. Please sign in with your credentials.',
                };
            }
        }

        // Current access token is still valid
        setBiometricSessionVerified(true);
        return { success: true, refreshed: false };
    } catch (err) {
        console.error('Unexpected error in ensureFreshTokenAfterBiometrics:', err);
        setBiometricSessionVerified(false);
        return {
            success: false,
            refreshed: false,
            error: 'Authentication verification failed. Please sign in with your credentials.',
        };
    }
}
