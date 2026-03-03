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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
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
  const keycloakClientId = process.env.EXPO_PUBLIC_KEYCLOAK_CLIENT_ID || 'my-mobile-client';

  const redirectUri = makeRedirectUri({
    scheme: 'com.onersofties.coopassistmobile',
    path: 'oauth'
  });

  useEffect(() => {
    checkBiometrics();
  }, []);

  // Helper function to convert hex string to base64url
  const hexToBase64Url = (hexString: string): string => {
    // Convert hex to bytes  
    const bytes: number[] = [];
    for (let i = 0; i < hexString.length; i += 2) {
      bytes.push(parseInt(hexString.substr(i, 2), 16));
    }
    
    // Convert bytes to base64url manually
    const binaryString = String.fromCharCode.apply(null, bytes as any);
    let base64 = '';
    
    // Simple base64 encoding
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    for (let i = 0; i < binaryString.length; i += 3) {
      const b1 = binaryString.charCodeAt(i);
      const b2 = i + 1 < binaryString.length ? binaryString.charCodeAt(i + 1) : 0;
      const b3 = i + 2 < binaryString.length ? binaryString.charCodeAt(i + 2) : 0;
      
      const bitmap = (b1 << 16) | (b2 << 8) | b3;
      
      base64 += chars.charAt((bitmap >> 18) & 63);
      base64 += chars.charAt((bitmap >> 12) & 63);
      if (i + 1 < binaryString.length) {
        base64 += chars.charAt((bitmap >> 6) & 63);
      }
      if (i + 2 < binaryString.length) {
        base64 += chars.charAt(bitmap & 63);
      }
    }
    
    // Convert to base64url (replace +/ with -_ and remove =)
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  // Helper function to generate PKCE code verifier and challenge
  const generatePKCE = async () => {
    // Generate a code verifier as a random string (43-128 chars)
    const random1 = Math.random().toString(36).substring(2);
    const random2 = Date.now().toString(36);
    const random3 = Math.random().toString(36).substring(2);
    const randomString = random1 + random2 + random3;
    
    // Create code verifier (unreserved characters: [A-Z] [a-z] [0-9] - . _ ~)
    const codeVerifier = randomString.substring(0, 128)
      .replace(/[^A-Za-z0-9\-._~]/g, '')
      .substring(0, 128);

    // Generate SHA256 hash of code verifier
    const codeChallengeSha256 = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier
    );

    // Convert hex to base64url
    const codeChallenge = hexToBase64Url(codeChallengeSha256);

    return { codeVerifier, codeChallenge };
  };

  // Helper function to generate random state parameter
  const generateState = () => {
    const random1 = Math.random().toString(36).substring(2);
    const random2 = Date.now().toString(36);
    const random3 = Math.random().toString(36).substring(2);
    const randomString = random1 + random2 + random3;
    
    return randomString.substring(0, 32)
      .replace(/[^A-Za-z0-9\-._~]/g, '')
      .substring(0, 32);
  }
  // Set up deep link listener for OAuth callback
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {
      console.log('Deep link received:', url);
      // If we are already processing a callback from openAuthSessionAsync, ignore this
      if (isProcessingCallbackRef.current) return;

      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;

      if (code && state === oauthStateRef.current) {
        console.log('OAuth code received via deep link');
        handleOAuthCallback(code);
      } else if (parsed.queryParams?.error) {
        const error = parsed.queryParams.error as string;
        console.error('OAuth error:', error);
        setLoading(false);
        authStartTimeRef.current = null;
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
    // This prevents infinite loading if something goes wrong
    const timeoutId = setInterval(() => {
      if (loading && authStartTimeRef.current) {
        const elapsedTime = Date.now() - authStartTimeRef.current;
        // 10 minutes timeout
        if (elapsedTime > 10 * 60 * 1000) {
          console.warn('OAuth timeout: No callback received after 10 minutes');
          setLoading(false);
          authStartTimeRef.current = null;
          codeVerifierRef.current = null;
          oauthStateRef.current = null;
          isProcessingCallbackRef.current = false;

          Alert.alert(
            'Authentication Timeout',
            'Authentication took too long and was cancelled. Please try again.',
            [{ text: 'OK' }]
          );
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      deeplinkSubscriptionRef.current?.remove();
      clearInterval(timeoutId);
    };
  }, [loading]);

  const checkBiometrics = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    setIsBiometricSupported(compatible && enrolled);

    // Default is false, check if user has explicitly enabled it in settings previously
    const enabled = await SecureStore.getItemAsync('biometrics_enabled');
    if (enabled === 'true') {
      setIsBiometricEnabled(true);
    }
  };

  const handleOAuthCallback = async (code: string) => {
    isProcessingCallbackRef.current = true;
    try {
      if (!codeVerifierRef.current) {
        throw new Error('Code verifier not found');
      }

      const discovery = {
        tokenEndpoint: `${keycloakUrl}/realms/${keycloakRealm}/protocol/openid-connect/token`,
      };

      // Exchange code for tokens
      const tokenResponse = await exchangeCodeAsync(
        {
          clientId: keycloakClientId,
          code: code,
          redirectUri: redirectUri,
          extraParams: {
            code_verifier: codeVerifierRef.current,
          }
        },
        discovery as any
      );

      // Store tokens in device Secure Hardware
      await SecureStore.setItemAsync('access_token', tokenResponse.accessToken);
      await SecureStore.setItemAsync('refresh_token', tokenResponse?.refreshToken || '');

      // Clear auth timer and flags
      authStartTimeRef.current = null;
      codeVerifierRef.current = null;
      oauthStateRef.current = null;

      // Close the browser session
      WebBrowser.dismissBrowser();

      // After first login, prompt user to enable biometrics for future sessions
      await promptEnableBiometricsIfNeeded();
    } catch (error) {
      console.error('Token exchange failed:', error);
      authStartTimeRef.current = null;
      codeVerifierRef.current = null;
      oauthStateRef.current = null;
      isProcessingCallbackRef.current = false;
      setLoading(false);
      
      WebBrowser.dismissBrowser();

      Alert.alert(
        'Authentication Error',
        'Failed to complete authentication. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * After a successful first login, if the device supports biometrics and it's not
   * yet enabled, ask the user if they'd like to use fingerprint login next time.
   * The refresh token is already stored in Secure Hardware from the login above.
   */
  const promptEnableBiometricsIfNeeded = async () => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const alreadyEnabled = await SecureStore.getItemAsync('biometrics_enabled');

    if (compatible && enrolled && alreadyEnabled !== 'true') {
      // Await the user's choice before navigating
      await new Promise<void>((resolve) => {
        Alert.alert(
          'Enable Fingerprint Login?',
          'Would you like to use your fingerprint to log in quickly next time?',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: () => resolve(),
            },
            {
              text: 'Enable',
              onPress: async () => {
                try {
                  // Require biometric confirmation to enroll
                  const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: 'Confirm your fingerprint to enable biometric login',
                    fallbackLabel: 'Cancel',
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

    // Reset processing flag before navigation
    isProcessingCallbackRef.current = false;
    // Navigate to dashboard after the prompt resolves (or immediately if not applicable)
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

      // We use Platform-specific browser opening strategies
      let result;
      if (Platform.OS === 'android') {
        // On Android, openBrowserAsync with showInRecents: true is much more robust
        // for 2FA flows where the user needs to switch to an authenticator app.
        // It prevents the Custom Tab from being dismissed when the app is backgrounded.
        result = await WebBrowser.openBrowserAsync(oauthUrl, {
          showInRecents: true,
        });
      } else {
        // On iOS, openAuthSessionAsync is the standard and handles session sharing better
        result = await WebBrowser.openAuthSessionAsync(oauthUrl, redirectUri);
      }

      console.log('Browser session result:', result);

      if (result.type === 'success') {
        // This block is typically for openAuthSessionAsync (iOS)
        const url = result.url;
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string;
        const returnedState = parsed.queryParams?.state as string;

        if (code && returnedState === oauthStateRef.current) {
          console.log('OAuth code received from session:', code);
          await handleOAuthCallback(code);
        } else {
          throw new Error('Invalid state or missing authorization code');
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        // The browser was closed. We check if we're already processing a redirect
        // caught by the Linking listener (manual fallback).
        setTimeout(() => {
          if (!isProcessingCallbackRef.current) {
            console.log('Browser closed/dismissed by user');
            setLoading(false);
          }
        }, 100);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      setLoading(false);
      authStartTimeRef.current = null;
      codeVerifierRef.current = null;
      oauthStateRef.current = null;
      isProcessingCallbackRef.current = false;

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colorScheme === 'dark' ? '#121212' : '#FFFFFF' }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colorScheme === 'dark' ? '#FFFFFF' : 'transparent', borderRadius: 12 }]}>
            <Image
              source={require('@/assets/images/splash.png')}
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

          {isBiometricSupported && isBiometricEnabled && (
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
    width: 200,
    height: 150,
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
