import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';

import { getKeycloakConfig, setCachedAccessToken } from './authService';

/**
 * Shared OAuth/PKCE helpers for the login screens. Both `login.tsx`
 * (in-app WebView) and `login.browser.tsx` (system browser) run the same
 * Keycloak authorization-code flow with PKCE; this module keeps that logic
 * in one place so refresh-relevant fixes land once.
 */

const APP_SCHEME = 'com.onersofties.coopassistmobile';
const OAUTH_PATH = 'oauth';

/** Deep-link URI Keycloak redirects back to after authentication. */
export function makeAppRedirectUri(): string {
    return makeRedirectUri({
        scheme: APP_SCHEME,
        path: OAUTH_PATH,
    });
}

async function generateRandomString(length: number): Promise<string> {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = await Crypto.getRandomBytesAsync(length);
    let result = '';
    for (let i = 0; i < length; i++) {
        result += charset.charAt(bytes[i] % charset.length);
    }
    return result;
}

/** PKCE verifier (64 chars, crypto-secure) and its S256 challenge. */
export async function generatePKCE(): Promise<{ codeVerifier: string; codeChallenge: string }> {
    const codeVerifier = await generateRandomString(64);
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
        encoding: 'base64' as any,
    });
    const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { codeVerifier, codeChallenge };
}

/** Opaque `state` for CSRF protection on the authorization request. */
export function generateState(): Promise<string> {
    return generateRandomString(32);
}

/** Authorization URL for the Keycloak login (and 2FA) pages. */
export function buildAuthorizationUrl(options: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
}): string {
    const config = getKeycloakConfig();
    const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: options.redirectUri,
        response_type: 'code',
        scope: 'openid profile offline_access',
        state: options.state,
        code_challenge: options.codeChallenge,
        code_challenge_method: 'S256',
    });
    return `${config.url}/realms/${config.realm}/protocol/openid-connect/auth?${params.toString()}`;
}

export interface ExchangedTokens {
    accessToken: string;
    refreshToken: string | null;
}

/**
 * Exchange an authorization code for tokens and persist them.
 * Throws a user-facing Error (network/timeout) or rethrows Keycloak errors.
 */
export async function exchangeCodeForTokens(options: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
}): Promise<ExchangedTokens> {
    const config = getKeycloakConfig();
    const discovery = {
        authorizationEndpoint: `${config.url}/realms/${config.realm}/protocol/openid-connect/auth`,
        tokenEndpoint: `${config.url}/realms/${config.realm}/protocol/openid-connect/token`,
    };

    let tokenResponse;
    try {
        tokenResponse = await exchangeCodeAsync(
            {
                clientId: config.clientId,
                code: options.code,
                redirectUri: options.redirectUri,
                extraParams: { code_verifier: options.codeVerifier },
            },
            discovery as any,
        );
    } catch {
        throw new Error('Could not reach the sign-in server. Please check your connection and try again.');
    }

    if (!tokenResponse.accessToken) {
        throw new Error('Sign-in did not return a session. Please try again.');
    }

    // Access token stays in memory only; the refresh token persists securely.
    setCachedAccessToken(tokenResponse.accessToken);
    if (tokenResponse.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', tokenResponse.refreshToken);
    }

    return {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken ?? null,
    };
}

const OAUTH_KEYS = [
    'oauth_state',
    'code_verifier',
    'oauth_auth_url',
    'oauth_current_url',
    'oauth_started_at',
] as const;

export interface StoredOAuthSession {
    state: string | null;
    codeVerifier: string | null;
    authUrl: string | null;
    currentUrl: string | null;
    startedAt: string | null;
}

/** Persist an in-progress authorization attempt so backgrounding the app (e.g. fetching a 2FA code) doesn't lose it. */
export async function saveOAuthSession(session: {
    state: string;
    codeVerifier: string;
    authUrl: string;
    currentUrl?: string;
}): Promise<void> {
    await Promise.all([
        SecureStore.setItemAsync('oauth_state', session.state),
        SecureStore.setItemAsync('code_verifier', session.codeVerifier),
        SecureStore.setItemAsync('oauth_auth_url', session.authUrl),
        SecureStore.setItemAsync('oauth_current_url', session.currentUrl ?? session.authUrl),
        SecureStore.setItemAsync('oauth_started_at', Date.now().toString()),
    ]);
}

export async function restoreOAuthSession(): Promise<StoredOAuthSession> {
    const [state, codeVerifier, authUrl, currentUrl, startedAt] = await Promise.all(
        OAUTH_KEYS.map((key) => SecureStore.getItemAsync(key)),
    );
    return { state, codeVerifier, authUrl, currentUrl, startedAt };
}

export async function clearOAuthSession(): Promise<void> {
    await Promise.all(OAUTH_KEYS.map((key) => SecureStore.deleteItemAsync(key)));
}
