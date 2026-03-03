export const KEYCLOAK_CONFIG = {
  issuer: 'http://localhost:8080/realms/coop-assist-backend', // Update with your Keycloak URL
  clientId: 'coop-assist-mobile', // Update with your Client ID
  redirectUri: 'exp://localhost:19000', // Update based on your environment
  scopes: ['openid', 'profile', 'email'],
};

export const STORAGE_KEYS = {
  USER_TOKENS: 'user_tokens',
  BIOMETRICS_ENABLED: 'biometrics_enabled',
};
