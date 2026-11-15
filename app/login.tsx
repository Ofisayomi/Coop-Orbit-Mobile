import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useToast } from '@/context/ToastContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { AccountService } from '@/services/accountService';
import {
  ensureFreshTokenAfterBiometrics,
  getStoredTokens,
  setBiometricSessionVerified,
  trySilentRefresh
} from '@/services/authService';
import { consumePendingNotificationRoute, registerDeviceTokenWithBackend } from '@/services/expo-notification';
import { exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';


const LoginScreen = () => {
  const router = useRouter();
  const { error: redirectError } = useLocalSearchParams<{ error?: string }>();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);

  // WebView state
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");

  // Track app lifecycle
  const appState = useRef(AppState.currentState);
  const oauthStateRef = useRef<string | null>(null);
  const codeVerifierRef = useRef<string | null>(null);
  const isProcessingCallbackRef = useRef(false);
  const isPromptingRef = useRef(false);
  const showWebViewRef = useRef(false);
  // Latest Keycloak page the WebView is on (e.g. the OTP screen). Restored
  // after backgrounding so the user resumes mid-flow instead of restarting
  // at the username screen.
  const currentUrlRef = useRef<string | null>(null);
  // Bumped to remount the WebView if iOS kills its content process while
  // the app is backgrounded.
  const [webViewKey, setWebViewKey] = useState(0);

  useEffect(() => {
    // Add app state listener
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

    setOrgName(SecureStore.getItem('org_name') ?? '');

    return () => {
      subscription.remove();
    };
  }, []);

  // Keycloak configuration
  const keycloakUrl = process.env.EXPO_PUBLIC_KEYCLOAK_URL;
  const keycloakRealm = process.env.EXPO_PUBLIC_KEYCLOAK_REALM;
  const keycloakClientId = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || 'coop-assist-mobile';

  const redirectUri = makeRedirectUri({
    scheme: 'com.onersofties.coopassistmobile',
    path: 'oauth'
  });

  // How long a login left hanging (e.g. user switched to the authenticator
  // app for a 2FA code and the OS killed ours) is still resumed instead of
  // dropped. Matches the 10-minute OAuth timeout in login.browser.tsx.
  const OAUTH_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

  const cleanupAuthSession = async () => {
    oauthStateRef.current = null;
    codeVerifierRef.current = null;
    currentUrlRef.current = null;
    isProcessingCallbackRef.current = false;
    await Promise.all([
      SecureStore.deleteItemAsync('oauth_state'),
      SecureStore.deleteItemAsync('code_verifier'),
      SecureStore.deleteItemAsync('oauth_auth_url'),
      SecureStore.deleteItemAsync('oauth_current_url'),
      SecureStore.deleteItemAsync('oauth_started_at'),
    ]);
  };

  // Restore OAuth session state on mount. If the app was backgrounded or
  // killed mid-login (e.g. user switched to the authenticator app for 2FA),
  // reopen the browser on the exact Keycloak page the user left (usually the
  // OTP screen) instead of dropping them back on the Sign In button or
  // restarting at the username screen. Reloading the initial auth URL would
  // start a new Keycloak session; the saved page URL carries the in-progress
  // session (session_code/execution/tab_id) and resumes it.
  useEffect(() => {
    const restoreAuthSession = async () => {
      try {
        const [storedState, storedVerifier, storedAuthUrl, storedCurrentUrl, storedStartedAt] = await Promise.all([
          SecureStore.getItemAsync('oauth_state'),
          SecureStore.getItemAsync('code_verifier'),
          SecureStore.getItemAsync('oauth_auth_url'),
          SecureStore.getItemAsync('oauth_current_url'),
          SecureStore.getItemAsync('oauth_started_at'),
        ]);
        if (storedState) oauthStateRef.current = storedState;
        if (storedVerifier) codeVerifierRef.current = storedVerifier;
        const resumeUrl = storedCurrentUrl ?? storedAuthUrl;
        if (storedState && storedVerifier && resumeUrl) {
          const ageMs = Date.now() - Number(storedStartedAt ?? Date.now());
          if (Number.isFinite(ageMs) && ageMs < OAUTH_SESSION_TIMEOUT_MS) {
            currentUrlRef.current = resumeUrl;
            setAuthUrl(resumeUrl);
            setShowWebView(true);
            setLoading(true);
            return;
          }
          // Stale login attempt: drop it so the user starts fresh.
          await cleanupAuthSession();
        }
      } catch (err) {
        console.error('Error restoring auth session:', err);
      }
    };
    restoreAuthSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for error messages from redirects (e.g. from httpClient 401 or dashboard guard)
  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (redirectError && redirectError !== lastErrorRef.current) {
      lastErrorRef.current = redirectError;
      showToast(redirectError, 'error');
    }
  }, [redirectError, showToast]);

  const hasAutoPromptedRef = useRef(false);

  // Post-auth landing: a notification tap that detoured through login
  // (cold start, expired session) still lands on its exact screen instead
  // of the dashboard. Falls back to the tabs home when there is no tap.
  const navigateAfterAuth = async () => {
    setBiometricSessionVerified(true);
    void registerDeviceTokenWithBackend();
    const pending = await consumePendingNotificationRoute();
    if (pending) {
      router.replace(pending);
    } else {
      router.replace('/(tabs)');
    }
  };

  const performFingerprintLogin = async () => {
    // Only one biometric prompt at a time (auto-prompt vs manual tap race).
    if (isPromptingRef.current) return;
    isPromptingRef.current = true;
    try {
      setLoading(true);
      // Validate the stored session BEFORE showing the fingerprint modal.
      // Prompting first and failing afterwards looks like a biometric
      // failure and interrupts users who must sign in with credentials
      // (e.g. mid-login after switching to the authenticator app for 2FA).
      const hasSession = await trySilentRefresh();
      if (!hasSession) {
        setCanUseBiometrics(false);
        showToast('Your session has expired. Please sign in with your username and password.', 'info');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock with Fingerprint',
        fallbackLabel: 'Use Password',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Requirement 2: After authentication with fingerprint, if the token is about to expire,
        // use refresh token to update token so user will not be logged out abruptly
        const tokenResult = await ensureFreshTokenAfterBiometrics(120);

        if (tokenResult.success) {
          await navigateAfterAuth();
        } else {
          showToast(
            tokenResult.error || 'Your session has expired. Please sign in with username and password.',
            'error'
          );
          setCanUseBiometrics(false);
        }
      } else {
        // Fingerprint failed or was cancelled
        if (result.error === 'user_cancel' || result.error === 'app_cancel') {
          showToast('Fingerprint unlock cancelled. Please sign in with your credentials.', 'warning');
        } else if (result.error === 'user_fallback') {
          showToast('Please sign in with your username and password.', 'info');
        } else {
          showToast('Biometric authentication failed. Please sign in with username and password.', 'error');
        }
      }
    } catch (error) {
      console.error('Biometric authentication error:', error);
      showToast('Biometric authentication error. Please sign in with your credentials.', 'error');
    } finally {
      isPromptingRef.current = false;
      setLoading(false);
    }
  };

  const checkBiometrics = useCallback(async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const isSupported = compatible && enrolled;
      setIsBiometricSupported(isSupported);

      const enabled = await SecureStore.getItemAsync('biometrics_enabled');
      const isEnabled = enabled === 'true';
      setIsBiometricEnabled(isEnabled);

      const { refreshToken } = await getStoredTokens();
      const hasStoredSession = Boolean(refreshToken);

      if (isSupported && isEnabled && hasStoredSession) {
        setCanUseBiometrics(true);

        // Never auto-prompt while a sign-in is in progress (Keycloak WebView
        // open, callback being processed, or a pending OAuth state restored
        // after the OS killed the app in the background — e.g. the user
        // switched to their authenticator app for a 2FA code). An unsolicited
        // fingerprint challenge here covers the login flow and can only fail,
        // forcing the authentication to restart.
        const [pendingState, pendingVerifier] = await Promise.all([
          SecureStore.getItemAsync('oauth_state'),
          SecureStore.getItemAsync('code_verifier'),
        ]);
        const oauthInProgress =
          showWebViewRef.current ||
          isProcessingCallbackRef.current ||
          oauthStateRef.current != null ||
          codeVerifierRef.current != null ||
          pendingState != null ||
          pendingVerifier != null;
        if (oauthInProgress) {
          return;
        }

        // Requirement 1: After user activates fingerprint on their device,
        // ask for fingerprint before allowing logged in user to see their dashboard
        if (!hasAutoPromptedRef.current) {
          hasAutoPromptedRef.current = true;
          setTimeout(() => {
            void performFingerprintLogin();
          }, 350);
        }
      } else {
        setCanUseBiometrics(false);
      }
    } catch (err) {
      console.error('Error checking biometrics:', err);
      setCanUseBiometrics(false);
    }
  }, []);

  useEffect(() => {
    void checkBiometrics();
  }, [checkBiometrics]);

  // Mirror WebView visibility for the biometric auto-prompt guard above.
  useEffect(() => {
    showWebViewRef.current = showWebView;
  }, [showWebView]);

  // Helper function to generate a random string for PKCE/state.
  // Uses expo-crypto random bytes (not Math.random) so the verifier and
  // state are unpredictable.
  const generateRandomString = async (length: number) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = await Crypto.getRandomBytesAsync(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(bytes[i] % charset.length);
    }
    return result;
  };

  // Helper function to generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    const codeVerifier = await generateRandomString(64);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: 'base64' as any }
    );
    const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { codeVerifier, codeChallenge };
  };

  const generateState = () => generateRandomString(32);

  const handleOAuthCallback = async (code: string) => {
    if (isProcessingCallbackRef.current) return;
    isProcessingCallbackRef.current = true;

    try {
      let verifier = codeVerifierRef.current;
      if (!verifier) {
        verifier = await SecureStore.getItemAsync('code_verifier');
      }

      if (!verifier) throw new Error('Code verifier not found');

      const discovery = {
        authorizationEndpoint: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`,
        tokenEndpoint: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
      };

      const tokenResponse = await exchangeCodeAsync(
        {
          clientId: keycloakClientId,
          code: code,
          redirectUri: redirectUri,
          extraParams: { code_verifier: verifier }
        },
        discovery as any
      );

      await SecureStore.setItemAsync('access_token', tokenResponse.accessToken);
      if (tokenResponse.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', tokenResponse.refreshToken);
      }

      const orgInfo = await AccountService.getOrganizationInfo();
      await SecureStore.setItemAsync('org_name', orgInfo?.organizationName ?? '');

      setShowWebView(false);
      await cleanupAuthSession();
      await promptEnableBiometricsIfNeeded();
    } catch (error) {
      console.error('Token exchange failed:', error);
      setShowWebView(false);
      await cleanupAuthSession();
      setLoading(false);
      showToast('Authentication failed. Please try again.', 'error');
    }
  };

  const promptEnableBiometricsIfNeeded = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const alreadyEnabled = await SecureStore.getItemAsync('biometrics_enabled');

    if (compatible && enrolled && alreadyEnabled !== 'true') {
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Enable Fingerprint Login?',
          'Would you like to use your fingerprint to log in quickly next time?',
          [
            { text: 'Not Now', style: 'cancel', onPress: () => resolve() },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm fingerprint',
                  });
                  if (result.success) {
                    await SecureStore.setItemAsync('biometrics_enabled', 'true');
                    setIsBiometricEnabled(true);
                  }
                } catch (err) {
                  console.error('Biometrics error:', err);
                } finally {
                  resolve();
                }
              },
            },
          ]
        );
      });
    }

    await navigateAfterAuth();
  };


  const onLogin = async () => {
    setLoading(true);
    // Starting a manual sign-in cancels the pending auto biometric challenge
    // so it can't pop over the Keycloak WebView (e.g. while fetching 2FA).
    hasAutoPromptedRef.current = true;
    isProcessingCallbackRef.current = false;

    try {
      const { codeVerifier, codeChallenge } = await generatePKCE();
      codeVerifierRef.current = codeVerifier;

      const state = await generateState();
      oauthStateRef.current = state;

      const baseUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`;
      const params = new URLSearchParams({
        client_id: keycloakClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile offline_access',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      const fullAuthUrl = `${baseUrl}?${params.toString()}`;

      // Persist the whole attempt so backgrounding the app (e.g. switching
      // to the authenticator app for 2FA) or an OS kill doesn't lose it.
      // oauth_current_url tracks the exact Keycloak page reached below, so a
      // return resumes mid-flow (OTP screen), not at the username screen.
      currentUrlRef.current = fullAuthUrl;
      await Promise.all([
        SecureStore.setItemAsync('oauth_state', state),
        SecureStore.setItemAsync('code_verifier', codeVerifier),
        SecureStore.setItemAsync('oauth_auth_url', fullAuthUrl),
        SecureStore.setItemAsync('oauth_current_url', fullAuthUrl),
        SecureStore.setItemAsync('oauth_started_at', Date.now().toString()),
      ]);

      setAuthUrl(fullAuthUrl);
      setShowWebView(true);
    } catch (error) {
      console.error('OAuth error:', error);
      setLoading(false);
      showToast('Could not initialize login flow. Please try again.', 'error');
    }
  };

  const onNavigationStateChange = (navState: any) => {
    const { url } = navState;
    if (url.startsWith(redirectUri)) {
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;

      if (code && state && state === oauthStateRef.current) {
        handleOAuthCallback(code);
      } else if (parsed.queryParams?.error) {
        setShowWebView(false);
        setLoading(false);
        void cleanupAuthSession();
        showToast(`Authentication failed: ${parsed.queryParams.error}`, 'error');
      }
      return;
    }
    // Track the latest Keycloak page (username → password → OTP). Saved on
    // every step so coming back from the authenticator app resumes exactly
    // where the user left off instead of restarting at the username screen.
    if (keycloakUrl && url.startsWith(keycloakUrl) && currentUrlRef.current !== url) {
      currentUrlRef.current = url;
      void SecureStore.setItemAsync('oauth_current_url', url);
    }
  };

  const onFingerprintLogin = async () => {
    await performFingerprintLogin();
  };

  const logoSource = colorScheme === 'dark'
    ? require('@/assets/images/splash.png')
    : require('@/assets/images/logo_light.png');

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#121212' : '#FFFFFF' }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: 'transparent', borderRadius: 12 }]}>
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
          </View>
          <View style={styles.brandContainer}>
            <View style={styles.brandInner}>
              <Text style={[styles.brandTitle, { color: colorScheme === 'dark' ? '#90CDF4' : '#173581' }]}>
                {orgName}
              </Text>
              <Text style={[styles.brandSubtitle, { color: colorScheme === 'dark' ? '#94A3B8' : '#64748B' }]}>
                {/* powered by Coop Orbit */}
              </Text>
            </View>
          </View>
          <Text style={[styles.secureAccess, { color: colorScheme === 'dark' ? '#A0AEC0' : '#4A5568' }]}>Secure Space Access</Text>
        </View>

        <View style={[styles.welcomeBanner, { backgroundColor: colorScheme === 'dark' ? '#1A202C' : '#EBF8FF', borderColor: colorScheme === 'dark' ? '#2D3748' : '#90CDF4' }]}>
          <Text style={[styles.welcomeText, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1A202C' }]}>Welcome Back</Text>
        </View>

        <View style={styles.form}>
          {canUseBiometrics && (
            <View style={styles.biometricSection}>
              <TouchableOpacity style={[styles.biometricCircle, { borderColor: colorScheme === 'dark' ? '#90CDF4' : '#173581', backgroundColor: colorScheme === 'dark' ? '#1A202C' : '#fff' }]} onPress={onFingerprintLogin}>
                <Ionicons name="finger-print-outline" size={40} color={colorScheme === 'dark' ? '#90CDF4' : '#173581'} />
              </TouchableOpacity>
              <Text style={styles.biometricText}>Tap to use biometric login</Text>
            </View>
          )}

          <TouchableOpacity style={styles.signInButton} onPress={onLogin} disabled={loading}>
            {loading && !showWebView ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Integrated WebView Modal */}
        <Modal
          visible={showWebView}
          animationType="slide"
          onRequestClose={() => {
            setShowWebView(false);
            setLoading(false);
            // Explicit cancel: drop the saved attempt so it isn't resumed.
            void cleanupAuthSession();
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#121212' : '#fff' }}>
            <View style={[styles.webViewHeader, { borderBottomColor: colorScheme === 'dark' ? '#2D3748' : '#E2E8F0' }]}>
              <TouchableOpacity onPress={() => { setShowWebView(false); setLoading(false); void cleanupAuthSession(); }}>
                <Ionicons name="close" size={28} color={colorScheme === 'dark' ? '#fff' : '#173581'} />
              </TouchableOpacity>
              <Text style={[styles.webViewTitle, { color: colorScheme === 'dark' ? '#fff' : '#1A202C' }]}>Secure Sign In</Text>
              <View style={{ width: 28 }} />
            </View>
            {authUrl && (
              <WebView
                key={webViewKey}
                source={{ uri: authUrl }}
                onNavigationStateChange={onNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                // Persistent storage (NOT incognito): the Keycloak session
                // cookie must survive backgrounding the app to fetch a 2FA
                // code from the authenticator app. An incognito WebView keeps
                // it in RAM only, so returning to the app loses the login
                // progress and drops the user back on the Sign In button.
                sharedCookiesEnabled={true}
                thirdPartyCookiesEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <ActivityIndicator style={styles.webViewLoading} size="large" color="#173581" />
                )}
                // iOS may terminate the web content process while the app is
                // backgrounded; reload the exact page left (usually the OTP
                // screen), not the initial auth URL which restarts at the
                // username screen.
                onContentProcessDidTerminate={() => {
                  const resumeUrl = currentUrlRef.current;
                  if (resumeUrl && resumeUrl !== authUrl) {
                    setAuthUrl(resumeUrl);
                  } else {
                    setWebViewKey((k) => k + 1);
                  }
                }}
              />
            )}
          </SafeAreaView>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 60,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoContainer: {
    padding: 10,
    borderRadius: 12,
  },
  logo: {
    width: 300,
    height: 200,
  },
  brandContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  brandInner: {
    alignItems: 'flex-end',
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'right',
  },
  secureAccess: {
    fontSize: 14,
    color: '#4A5568',
    marginTop: 8,
  },
  welcomeBanner: {
    backgroundColor: '#EBF8FF',
    paddingVertical: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#90CDF4',
    borderStyle: 'dashed',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1A202C',
  },
  form: {
    width: '100%',
  },
  biometricSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  biometricCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#173581',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  biometricText: {
    fontSize: 12,
    color: '#718096',
  },
  signInButton: {
    backgroundColor: '#173581',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  webViewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  webViewLoading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -12,
    marginTop: -12,
  }
});
