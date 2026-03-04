import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trySilentRefresh } from '@/services/authService';
// import { authorize } from 'react-native-app-auth';
import { exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';


const LoginScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Track app lifecycle for 2FA handling
  const appState = useRef(AppState.currentState);
  const authStartTimeRef = useRef<number | null>(null);
  const oauthStateRef = useRef<string | null>(null);
  const codeVerifierRef = useRef<string | null>(null);
  const deeplinkSubscriptionRef = useRef<Linking.EventSubscription | null>(null);
  const isProcessingCallbackRef = useRef(false);

  // Warm up the browser to improve performance and session reliability
  useEffect(() => {
    if (Platform.OS === 'android') {
      WebBrowser.warmUpAsync();
    }
    
    // Add app state listener to handle backgrounding
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('App has come to the foreground!');
      }
      appState.current = nextAppState;
    });

    return () => {
      if (Platform.OS === 'android') {
        WebBrowser.coolDownAsync();
      }
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

  // Restore OAuth session state on mount (in case app was killed during 2FA)
  useEffect(() => {
    const restoreAuthSession = async () => {
      try {
        const [storedState, storedVerifier] = await Promise.all([
          SecureStore.getItemAsync('oauth_state'),
          SecureStore.getItemAsync('code_verifier'),
        ]);
        if (storedState) oauthStateRef.current = storedState;
        if (storedVerifier) codeVerifierRef.current = storedVerifier;
      } catch (err) {
        console.error('Error restoring auth session:', err);
      }
    };
    restoreAuthSession();
  }, []);

  useEffect(() => {
    checkBiometrics();
  }, []);

  // Helper function to generate a random string for PKCE (43-128 chars)
  // Using only alphanumeric characters to avoid any potential encoding issues with -._~
  const generateRandomString = (length: number) => {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  };

  // Helper function to generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    // Generate a code verifier (spec recommends 43-128 chars)
    const codeVerifier = generateRandomString(64);

    // Generate SHA256 hash of code verifier and encode as base64url
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: 'base64' as any }
    );

    // Convert base64 to base64url (RFC 7636)
    const codeChallenge = hash
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

    return { codeVerifier, codeChallenge };
  };

  // Helper function to generate random state parameter
  const generateState = () => {
    return generateRandomString(32);
  }

  // Set up deep link listener for OAuth callback
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log('Deep link received:', url);
      
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;

      // Ensure we have a code and the state matches what we sent
      if (code && state && state === oauthStateRef.current) {
        if (isProcessingCallbackRef.current) {
          console.log('Already processing a callback, ignoring duplicate');
          return;
        }
        console.log('OAuth code received via deep link');
        handleOAuthCallback(code);
      } else if (parsed.queryParams?.error) {
        const error = parsed.queryParams.error as string;
        console.error('OAuth error:', error);
        setLoading(false);
        cleanupAuthSession();
        Alert.alert('Authentication Failed', `Error: ${error}`);
      }
    };

    // Listen for deep links
    deeplinkSubscriptionRef.current = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url != null) {
        handleDeepLink({ url });
      }
    });

    // Set up a timeout for the OAuth flow (10 minutes)
    const timeoutId = setInterval(() => {
      if (loading && authStartTimeRef.current) {
        const elapsedTime = Date.now() - authStartTimeRef.current;
        if (elapsedTime > 10 * 60 * 1000) {
          console.warn('OAuth timeout: No callback received after 10 minutes');
          setLoading(false);
          cleanupAuthSession();

          Alert.alert(
            'Authentication Timeout',
            'Authentication took too long and was cancelled. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    }, 30000);

    return () => {
      deeplinkSubscriptionRef.current?.remove();
      clearInterval(timeoutId);
    };
  }, [loading]);

  const cleanupAuthSession = async () => {
    authStartTimeRef.current = null;
    codeVerifierRef.current = null;
    oauthStateRef.current = null;
    isProcessingCallbackRef.current = false;
    await Promise.all([
      SecureStore.deleteItemAsync('oauth_state'),
      SecureStore.deleteItemAsync('code_verifier'),
    ]);
  };

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const isSupported = compatible && enrolled;
    setIsBiometricSupported(isSupported);

    const enabled = await SecureStore.getItemAsync('biometrics_enabled');
    const isEnabled = enabled === 'true';
    setIsBiometricEnabled(isEnabled);

    // Only show biometric button if it's supported, enabled by user,
    // AND there is a valid or refreshable session.
    if (isSupported && isEnabled) {
      setLoading(true);
      try {
        const canRefresh = await trySilentRefresh();
        setCanUseBiometrics(canRefresh);
      } catch (err) {
        console.error('Error checking silent refresh for biometric display:', err);
        setCanUseBiometrics(false);
      } finally {
        setLoading(false);
      }
    } else {
      setCanUseBiometrics(false);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    if (isProcessingCallbackRef.current) return;
    isProcessingCallbackRef.current = true;
    
    try {
      // Ensure we have the code verifier
      let verifier = codeVerifierRef.current;
      if (!verifier) {
        console.log('Code verifier missing from ref, trying SecureStore...');
        verifier = await SecureStore.getItemAsync('code_verifier');
      }

      if (!verifier) {
        throw new Error('Code verifier not found. Session may have expired.');
      }

      const discovery = {
        authorizationEndpoint: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`,
        tokenEndpoint: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
      };

      console.log('Exchanging code for tokens...');
      // Exchange code for tokens
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId: keycloakClientId,
          code: code,
          redirectUri: redirectUri,
          extraParams: {
            code_verifier: verifier,
          }
        },
        discovery as any
      );

      // Store tokens
      await SecureStore.setItemAsync('access_token', tokenResponse.accessToken);
      if (tokenResponse.refreshToken) {
        await SecureStore.setItemAsync('refresh_token', tokenResponse.refreshToken);
      }

      console.log('Token exchange successful');

      // Close browser and cleanup session
      WebBrowser.dismissBrowser();
      await cleanupAuthSession();

      // After first login, prompt user to enable biometrics for future sessions
      await promptEnableBiometricsIfNeeded();
    } catch (error) {
      console.error('Token exchange failed:', error);
      await cleanupAuthSession();
      setLoading(false);
      WebBrowser.dismissBrowser();

      Alert.alert(
        'Authentication Error',
        'Failed to complete authentication. PKCE verification or network error. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * After a successful first login, if the device supports biometrics and it's not
   * yet enabled, ask the user if they'd like to use fingerprint login next time.
   */
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
                    promptMessage: 'Confirm your fingerprint to enable biometric login',
                  });
                  if (result.success) {
                    await SecureStore.setItemAsync('biometrics_enabled', 'true');
                    setIsBiometricEnabled(true);
                  }
                } catch (err) {
                  console.error('Error enabling biometrics:', err);
                } finally {
                  resolve();
                }
              },
            },
          ]
        );
      });
    }

    router.replace('/(tabs)');
  };


  const onLogin = async () => {
    setLoading(true);
    authStartTimeRef.current = Date.now();
    isProcessingCallbackRef.current = false;
    
    try {
      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      codeVerifierRef.current = codeVerifier;

      // Generate state parameter
      const state = generateState();
      oauthStateRef.current = state;

      // Persist state and verifier for app-switching robustness
      await Promise.all([
        SecureStore.setItemAsync('oauth_state', state),
        SecureStore.setItemAsync('code_verifier', codeVerifier),
      ]);

      // Build OAuth authorization URL
      const authUrl = `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/auth`;
      const params = new URLSearchParams({
        client_id: keycloakClientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile offline_access',
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const oauthUrl = `${authUrl}?${params.toString()}`;
      console.log('Opening OAuth URL:', oauthUrl);

      let result;
      if (Platform.OS === 'android') {
        // On Android, openBrowserAsync with showInRecents: true is the only way
        // to ensure the browser doesn't close when switching to a 2FA app.
        result = await WebBrowser.openBrowserAsync(oauthUrl, {
          showInRecents: true,
        });
      } else {
        // On iOS, openAuthSessionAsync is standard and handles automatic return.
        result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);
      }

      console.log('Browser session result:', result);

      if (result.type === 'success') {
        const url = result.url;
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string;
        const returnedState = parsed.queryParams?.state as string;

        if (code && returnedState === oauthStateRef.current) {
          await handleOAuthCallback(code);
        } else {
          throw new Error('Invalid state or missing authorization code');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // On Android, the result might be 'dismiss' as soon as the app backgrounds.
        // We wait for the Linking listener to catch the redirect.
        setTimeout(() => {
          if (!isProcessingCallbackRef.current) {
            console.log('Browser closed/dismissed by user');
            setLoading(false);
          }
        }, 3000);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      await cleanupAuthSession();
      setLoading(false);

      Alert.alert(
        'Authentication Error',
        'An error occurred during authentication. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const onFingerprintLogin = async () => {
    try {
      // Step 1: Prompt for biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with Biometrics',
        fallbackLabel: 'Use Passcode',
      });

      console.log('Biometric auth result:', result);
      if (result.success) {
        setLoading(true);
        try {
          // Step 2: Retrieve the refresh token from Secure Hardware storage
          // Step 3: Send refresh token to Keycloak for a fresh access token (silent refresh)
          const isAuthenticated = await trySilentRefresh();
          if (isAuthenticated) {
            // Step 4: Keycloak returned a fresh access token — navigate to dashboard
            router.replace('/(tabs)');
          } else {
            Alert.alert(
              'Session Expired',
              'Your session has expired. Please log in with your credentials.',
              [{ text: 'OK' }]
            );
          }
        } catch (authError) {
          console.error('Silent refresh failed during biometric login:', authError);
          Alert.alert(
            'Session Expired',
            'Your session has expired. Please log in with your credentials.',
            [{ text: 'OK' }]
          );
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      Alert.alert('Error', 'Biometric authentication failed.');
    }
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
            <Image
              source={logoSource}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.secureAccess, { color: colorScheme === 'dark' ? '#A0AEC0' : '#4A5568' }]}>Secure Space Access</Text>
        </View>

        <View style={[styles.welcomeBanner, { backgroundColor: colorScheme === 'dark' ? '#1A202C' : '#EBF8FF', borderColor: colorScheme === 'dark' ? '#2D3748' : '#90CDF4' }]}>
          <Text style={[styles.welcomeText, { color: colorScheme === 'dark' ? '#FFFFFF' : '#1A202C' }]}>Welcome Back</Text>
        </View>

        <View style={styles.form}>
          {/* <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colorScheme === 'dark' ? '#E2E8F0' : '#2D3748' }]}>Username</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colorScheme === 'dark' ? '#2D3748' : '#F7FAFC', color: colorScheme === 'dark' ? '#FFFFFF' : '#1A202C', borderColor: colorScheme === 'dark' ? '#4A5568' : '#E2E8F0' }]}
              placeholder="Enter your username or email"
              placeholderTextColor="#A0AEC0"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
            />
          </View> */}

          {/* <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colorScheme === 'dark' ? '#E2E8F0' : '#2D3748' }]}>Password</Text>
            <View style={[styles.passwordWrapper, { backgroundColor: colorScheme === 'dark' ? '#2D3748' : '#F7FAFC', borderColor: colorScheme === 'dark' ? '#4A5568' : '#E2E8F0' }]}>
              <TextInput
                style={[styles.input, { flex: 1, borderWidth: 0, backgroundColor: 'transparent', color: colorScheme === 'dark' ? '#FFFFFF' : '#1A202C' }]}
                placeholder="Enter your password"
                placeholderTextColor="#A0AEC0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#A0AEC0" />
              </TouchableOpacity>
            </View>
          </View> */}

          {/* <TouchableOpacity style={styles.forgotPassword}>
            <Text style={[styles.forgotPasswordText, { color: colorScheme === 'dark' ? '#90CDF4' : '#173581' }]}>Forgot Password?</Text>
          </TouchableOpacity> */}

          {canUseBiometrics && (
            <View style={styles.biometricSection}>
              <TouchableOpacity style={[styles.biometricCircle, { borderColor: colorScheme === 'dark' ? '#90CDF4' : '#173581', backgroundColor: colorScheme === 'dark' ? '#1A202C' : '#fff' }]} onPress={onFingerprintLogin}>
                <Ionicons name="finger-print-outline" size={40} color={colorScheme === 'dark' ? '#90CDF4' : '#173581'} />
              </TouchableOpacity>
              <Text style={styles.biometricText}>Tap to use biometric login</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.signInButton}
            onPress={onLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContent}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>
                  {authStartTimeRef.current && Date.now() - authStartTimeRef.current > 3000 
                    ? 'Waiting for 2FA...' 
                    : 'Signing In...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* <View style={styles.footer}>
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.createAccount}>Create Account</Text>
            </Text>
          </View> */}
        </View>
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
  secureAccess: {
    fontSize: 14,
    color: '#4A5568',
    marginTop: 8,
  },
  welcomeBanner: {
    backgroundColor: '#EBF8FF', // Light Blue background
    paddingVertical: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#90CDF4', // Sky Blue border
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
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 14,
    color: '#1A202C',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#173581',
    fontSize: 14,
    fontWeight: '500',
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
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#718096',
  },
  createAccount: {
    color: '#1A202C',
    fontWeight: 'bold',
  },
});
