import { router } from 'expo-router';

import { AuthError, fetchWithTimeout, getValidAccessToken, logout } from './authService';
import { showGlobalToast } from '@/context/ToastContext';

/** API calls time out instead of hanging forever on a dead connection. */
const API_TIMEOUT_MS = 30000;

type RequestInterceptor = (config: RequestInit & { url: string }) => Promise<RequestInit & { url: string }>;
type ResponseInterceptor = (response: Response, config: RequestInit & { url: string }) => Promise<Response>;

/**
 * Authenticated HTTP client with automatic token refresh.
 *
 * Usage:
 *   const data = await apiClient.get('/api/endpoint');
 *   const result = await apiClient.post('/api/endpoint', { body: JSON.stringify({...}) });
 */
class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = '') {
        this.baseUrl = baseUrl;
    }

    private async getAuthHeaders(): Promise<Record<string, string>> {
        try {
            const token = await getValidAccessToken();
            return {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            };
        } catch (error) {
            if (error instanceof AuthError && error.kind === 'network') {
                // Transient: keep the session, let the caller show a retry UI.
                throw error;
            }
            // Dead session or misconfigured build - logout and redirect to login
            console.error('Failed to get valid access token, redirecting to login:', error);
            const message = error instanceof AuthError ? error.message : 'Session expired. Please sign in with your credentials.';
            await this.handleAuthFailure(message);
            throw error instanceof AuthError ? error : new AuthError('no-session', message);
        }
    }

    private async handleAuthFailure(errorMessage = 'Session expired. Please sign in with your credentials.'): Promise<void> {
        try {
            await logout();
        } catch (error) {
            console.error('Error during logout on auth failure:', error);
        }
        showGlobalToast(errorMessage, 'error');
        // Redirect to login screen
        router.replace({
            pathname: '/login',
            params: { error: errorMessage },
        });
    }

    async request(url: string, options: RequestInit = {}): Promise<Response> {
        let cleanUrl = url;
        if (this.baseUrl.endsWith('/api') && cleanUrl.startsWith('/api/')) {
            cleanUrl = cleanUrl.substring(4);
        }
        const fullUrl = cleanUrl.startsWith('http') ? cleanUrl : `${this.baseUrl}${cleanUrl}`;

        try {
            const authHeaders = await this.getAuthHeaders();
            const config: RequestInit = {
                ...options,
                headers: {
                    ...authHeaders,
                    ...(options.headers || {}),
                },
            };

            let response: Response;
            try {
                response = await fetchWithTimeout(fullUrl, config, API_TIMEOUT_MS);
            } catch (error) {
                if (error instanceof AuthError && error.kind === 'network') {
                    // Transient connectivity problem: warn, keep the session.
                    showGlobalToast(error.message, 'warning');
                }
                throw error;
            }

            // If we get 401, try one more time with a fresh token
            if (response.status === 401) {
                console.warn('Got 401, attempting token refresh and retry...');
                try {
                    // Single-flight: concurrent 401s share one Keycloak refresh.
                    const { refreshAccessToken } = await import('./authService');
                    const newToken = await refreshAccessToken();

                    const retryConfig: RequestInit = {
                        ...options,
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${newToken}`,
                            ...(options.headers || {}),
                        },
                    };

                    const retryResponse = await fetchWithTimeout(fullUrl, retryConfig, API_TIMEOUT_MS);

                    if (retryResponse.status === 401) {
                        // Still 401 after refresh, auth has fully failed
                        await this.handleAuthFailure('Authentication expired. Please sign in again.');
                        throw new AuthError('refresh-rejected', 'Authentication expired. Please sign in again.');
                    }

                    return retryResponse;
                } catch (refreshError) {
                    if (refreshError instanceof AuthError && refreshError.kind === 'network') {
                        showGlobalToast(refreshError.message, 'warning');
                        throw refreshError;
                    }
                    const message =
                        refreshError instanceof AuthError
                            ? refreshError.message
                            : 'Session expired. Please sign in with your credentials.';
                    await this.handleAuthFailure(message);
                    throw refreshError instanceof AuthError
                        ? refreshError
                        : new AuthError('no-session', message);
                }
            }

            return response;
        } catch (error) {
            // Typed auth errors already produced their toast/redirect above.
            throw error;
        }
    }

    async get(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'POST' });
    }

    async put(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'PUT' });
    }

    async patch(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'PATCH' });
    }

    async delete(url: string, options: RequestInit = {}): Promise<Response> {
        return this.request(url, { ...options, method: 'DELETE' });
    }
}

// Export a singleton instance pre-configured with your base API URL
const BASE_API_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';
export const apiClient = new ApiClient(BASE_API_URL);
export default apiClient;

/**
 * Resolve a backend file path (e.g. `/api/Files/{id}`) to an absolute URL
 * the Image component can load. Pass-through for absolute URLs.
 */
export function resolveFileUrl(path?: string | null): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const root = BASE_API_URL.replace(/\/api\/?$/, '');
    return `${root}${path.startsWith('/') ? path : `/${path}`}`;
}
