import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';

/** Keycloak configuration is read per call via {@link getKeycloakConfig} so a missing build setting fails fast. */

interface JWTPayload {
    exp: number;
    iat: number;
    sub: string;
    [key: string]: any;
}

/**
 * Typed authentication failure. `message` is always a user-facing string so
 * callers can surface it directly in a toast; `kind` tells the caller whether
 * the session is dead (log out) or the problem is transient (warn and retry).
 */
export type AuthErrorKind = 'no-session' | 'refresh-rejected' | 'network' | 'config';

export class AuthError extends Error {
    kind: AuthErrorKind;
    /** 'warning' for transient problems, 'error' when the user must sign in again. */
    severity: 'warning' | 'error';

    constructor(kind: AuthErrorKind, userMessage: string) {
        super(userMessage);
        this.name = 'AuthError';
        this.kind = kind;
        this.severity = kind === 'network' ? 'warning' : 'error';
    }
}

export interface KeycloakConfig {
    url: string;
    realm: string;
    clientId: string;
}

/** Read and validate Keycloak configuration. Throws a `config` AuthError when incomplete. */
export function getKeycloakConfig(): KeycloakConfig {
    const url = process.env.EXPO_PUBLIC_KEYCLOAK_URL;
    const realm = process.env.EXPO_PUBLIC_KEYCLOAK_REALM;
    const clientId = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID;
    if (!url || !realm || !clientId) {
        throw new AuthError('config', 'Sign-in is not configured on this build. Please contact support.');
    }
    return { url, realm, clientId };
}

export function getTokenEndpoint(): string {
    const config = getKeycloakConfig();
    return `${config.url}/realms/${config.realm}/protocol/openid-connect/token`;
}

function getLogoutEndpoint(): string {
    const config = getKeycloakConfig();
    return `${config.url}/realms/${config.realm}/protocol/openid-connect/logout`;
}

/** fetch with a timeout. Abort/timeout and transport failures surface as `network` AuthErrors. */
export async function fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs = 25000,
): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
        if (error instanceof AuthError) throw error;
        const aborted = (error as Error)?.name === 'AbortError';
        throw new AuthError(
            'network',
            aborted
                ? 'The request timed out. Please check your connection and try again.'
                : 'Could not reach the server. Please check your connection and try again.',
        );
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Access tokens live in memory (never on disk) and are refreshed silently.
 * The refresh token stays in SecureStore so a cold start can re-authenticate.
 */
let _memoryAccessToken: string | null = null;

export function setCachedAccessToken(token: string | null): void {
    _memoryAccessToken = token;
}

export function getCachedAccessToken(): string | null {
    return _memoryAccessToken;
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
 * Single-flight guard for token refresh. Keycloak rotates refresh tokens on
 * use, so concurrent refreshes would race: the losers present an already
 * rotated-out token and get `invalid_grant` (or trigger reuse revocation).
 * All concurrent callers share one in-flight refresh instead.
 */
let inflightRefresh: Promise<string> | null = null;

/**
 * Use the refresh token to obtain a new access token from Keycloak.
 * Resolves with the new access token; throws a typed {@link AuthError}:
 * - `no-session` when there is no refresh token to use,
 * - `refresh-rejected` when Keycloak rejects it (expired/revoked session),
 * - `network` when Keycloak is unreachable or a non-auth error occurs.
 */
export function refreshAccessToken(): Promise<string> {
    if (!inflightRefresh) {
        inflightRefresh = performRefresh().finally(() => {
            inflightRefresh = null;
        });
    }
    return inflightRefresh;
}

async function performRefresh(): Promise<string> {
    const { refreshToken } = await getStoredTokens();
    if (!refreshToken) {
        throw new AuthError('no-session', 'Your session has expired. Please sign in again.');
    }

    const clientId = getKeycloakConfig().clientId;
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        refresh_token: refreshToken,
    }).toString();

    let response: Response;
    try {
        response = await fetchWithTimeout(
            getTokenEndpoint(),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            },
            25000,
        );
    } catch (error) {
        if (error instanceof AuthError) throw error;
        throw new AuthError('network', 'Could not reach the sign-in server. Please check your connection and try again.');
    }

    if (!response.ok) {
        // Keycloak answers an expired/revoked/rotated-out refresh token with
        // 400 invalid_grant. Anything else is treated as transient.
        if (response.status === 400 || response.status === 401) {
            let detail = '';
            try {
                detail = await response.text();
            } catch {
                // Ignore body read failures; the status already decides.
            }
            console.warn('Keycloak rejected the refresh token:', response.status, detail);
            throw new AuthError('refresh-rejected', 'Your session has expired. Please sign in again.');
        }
        console.warn('Keycloak token endpoint returned HTTP', response.status);
        throw new AuthError('network', 'The sign-in server is having issues. Please try again in a moment.');
    }

    const data = await response.json();
    if (!data?.access_token) {
        throw new AuthError('refresh-rejected', 'Your session has expired. Please sign in again.');
    }

    // Keycloak rotates the refresh token on every use: persist it, keep the
    // access token in memory only.
    if (data.refresh_token) {
        await SecureStore.setItemAsync('refresh_token', data.refresh_token);
    }
    setCachedAccessToken(data.access_token as string);

    return data.access_token as string;
}

/**
 * Get a valid access token. If the current one is expired/expiring, refresh it.
 * Never resolves null: throws a typed {@link AuthError} instead.
 */
export async function getValidAccessToken(): Promise<string> {
    if (_memoryAccessToken && !isTokenExpiredOrExpiring(_memoryAccessToken)) {
        return _memoryAccessToken;
    }

    // Cold start (or rotated-out memory token): fall back to a stored token
    // once, then promote it to memory. Afterwards everything is in-memory.
    const { accessToken } = await getStoredTokens();
    if (accessToken && !isTokenExpiredOrExpiring(accessToken)) {
        setCachedAccessToken(accessToken);
        return accessToken;
    }

    // Token expired or expiring - try refresh (result stays in memory)
    return refreshAccessToken();
}

/**
 * Perform Keycloak logout by invalidating the refresh token server-side,
 * then clear all stored tokens.
 */
export async function logout(): Promise<void> {
    setCachedAccessToken(null);
    try {
        const { refreshToken } = await getStoredTokens();

        if (refreshToken) {
            let endpoint: string | null = null;
            let clientId = 'coop-assist-mobile';
            try {
                const config = getKeycloakConfig();
                endpoint = `${config.url}/realms/${config.realm}/protocol/openid-connect/logout`;
                clientId = config.clientId;
            } catch {
                // Misconfigured build: skip the server call, still clear local state below.
            }
            if (endpoint) {
                const body = new URLSearchParams({
                    client_id: clientId,
                    refresh_token: refreshToken,
                }).toString();

                // Best-effort: logout from Keycloak server (revokes the session server-side)
                await fetchWithTimeout(
                    endpoint,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body,
                    },
                    15000,
                );
            }
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
 * Tracks an in-flight system UI flow (gallery/document picker, camera) that
 * temporarily backgrounds the app. While set, AppState transitions must NOT
 * arm or trip the biometric app lock — the user never actually left the app,
 * and locking here would bounce them to login and wipe in-progress forms.
 */
let _externalActivityCount = 0;

export function beginExternalActivity(): void {
    _externalActivityCount += 1;
}

export function endExternalActivity(): void {
    _externalActivityCount = Math.max(0, _externalActivityCount - 1);
}

export function isExternalActivityActive(): boolean {
    return _externalActivityCount > 0;
}

/** Run `fn` with the app-lock background/foreground handling suspended. */
export async function withExternalActivity<T>(fn: () => Promise<T>): Promise<T> {
    beginExternalActivity();
    try {
        return await fn();
    } finally {
        endExternalActivity();
    }
}

export type SilentRefreshOutcome = 'ok' | 'no-session' | 'offline';

/**
 * Try to silently authenticate using refresh token.
 * - 'ok': a usable access token exists (refreshed if needed).
 * - 'no-session': no usable session — the caller should send the user to login.
 * - 'offline': the device appears to be offline — keep the user where they
 *   are and surface a warning instead of logging them out.
 */
export async function trySilentRefresh(): Promise<SilentRefreshOutcome> {
    try {
        const { refreshToken, accessToken } = await getStoredTokens();

        if (!refreshToken) return 'no-session';

        // If access token is still valid, no need to refresh
        if (accessToken && !isTokenExpiredOrExpiring(accessToken)) {
            return 'ok';
        }

        // Try to use refresh token — report whether it actually worked so
        // callers don't offer biometric login for a dead session.
        await refreshAccessToken();
        return 'ok';
    } catch (error) {
        if (error instanceof AuthError && error.kind === 'network') return 'offline';
        return 'no-session';
    }
}

let _isBiometricVerifiedInSession = false;

async function getTokenForClaims(): Promise<string | null> {
    try {
        return await getValidAccessToken();
    } catch {
        const { accessToken } = await getStoredTokens();
        return accessToken;
    }
}

export function setBiometricSessionVerified(verified: boolean): void {
    _isBiometricVerifiedInSession = verified;
}

/**
 * Roles allowed to view other members' details and account balances.
 */
export const PRIVILEGED_MEMBER_ROLES = ['Admin', 'Accountant', 'Secretary'];

/**
 * Read the signed-in user's roles out of the Keycloak access token.
 */
export async function getCurrentUserRoles(): Promise<string[]> {
    const accessToken = await getTokenForClaims();
    if (!accessToken) return [];
    try {
        const decoded = jwtDecode<Record<string, any>>(accessToken);
        const realmRoles: string[] = decoded?.realm_access?.roles ?? [];
        const resourceAccess: Record<string, any> = decoded?.resource_access ?? {};
        const clientRoles: string[] = Object.values(resourceAccess).flatMap(
            (entry: any) => entry?.roles ?? []
        );
        const flatRoles: string[] = decoded?.roles ?? [];
        return [...realmRoles, ...clientRoles, ...flatRoles];
    } catch {
        return [];
    }
}

/**
 * Read the signed-in user's id (Keycloak `sub` claim) out of the access token.
 */
export async function getCurrentUserId(): Promise<string | null> {
    const accessToken = await getTokenForClaims();
    if (!accessToken) return null;
    try {
        const decoded = jwtDecode<Record<string, any>>(accessToken);
        return (decoded?.sub as string) ?? null;
    } catch {
        return null;
    }
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
    /** True when the failure is transient (offline) — show a warning, do not log out. */
    offline?: boolean;
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
                if (refreshErr instanceof AuthError && refreshErr.kind === 'network') {
                    // Transient: keep the session; the next request will retry.
                    return {
                        success: false,
                        refreshed: false,
                        error: 'You appear to be offline. Please check your connection and try again.',
                        offline: true,
                    };
                }
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
        if (err instanceof AuthError && err.kind === 'network') {
            return {
                success: false,
                refreshed: false,
                error: 'You appear to be offline. Please check your connection and try again.',
                offline: true,
            };
        }
        setBiometricSessionVerified(false);
        return {
            success: false,
            refreshed: false,
            error: 'Authentication verification failed. Please sign in with your credentials.',
        };
    }
}
