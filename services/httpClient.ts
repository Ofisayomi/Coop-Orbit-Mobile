import { router } from 'expo-router';

import { getValidAccessToken, logout } from './authService';

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
            // Token refresh failed - logout and redirect to login
            console.error('Failed to get valid access token, redirecting to login:', error);
            await this.handleAuthFailure();
            throw error;
        }
    }

    private async handleAuthFailure(): Promise<void> {
        try {
            await logout();
        } catch (error) {
            console.error('Error during logout on auth failure:', error);
        }
        // Redirect to login screen
        router.replace('/login');
    }

    async request(url: string, options: RequestInit = {}): Promise<Response> {
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        try {
            const authHeaders = await this.getAuthHeaders();
            const config: RequestInit = {
                ...options,
                headers: {
                    ...authHeaders,
                    ...(options.headers || {}),
                },
            };

            const response = await fetch(fullUrl, config);

            // If we get 401, try one more time with a fresh token
            if (response.status === 401) {
                console.warn('Got 401, attempting token refresh and retry...');
                try {
                    // Force refresh the token
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

                    const retryResponse = await fetch(fullUrl, retryConfig);

                    if (retryResponse.status === 401) {
                        // Still 401 after refresh, auth has fully failed
                        await this.handleAuthFailure();
                        throw new Error('Authentication failed after token refresh');
                    }

                    return retryResponse;
                } catch (refreshError) {
                    await this.handleAuthFailure();
                    throw refreshError;
                }
            }

            return response;
        } catch (error) {
            // Re-throw if it's our own auth error
            if ((error as Error).message?.includes('Authentication failed')) {
                throw error;
            }
            // Network or other errors - re-throw as-is
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
