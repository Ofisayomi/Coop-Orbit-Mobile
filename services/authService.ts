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
export async function refreshAccessToken(): Promise<string> {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) {
        throw new Error('No refresh token stored.');
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
        throw new Error(`Token refresh failed: ${response.status} - ${error}`);
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
export async function getValidAccessToken(): Promise<string> {
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

        // Try to use refresh token
        await refreshAccessToken();
        return true;
    } catch {
        return false;
    }
}
