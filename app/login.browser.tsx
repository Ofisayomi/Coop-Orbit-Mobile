import { Ionicons } from '@expo/vector-icons';
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
import { useToast } from '@/context/ToastContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hasAppPin } from '@/services/app-pin';
import { AuthError, ensureFreshTokenAfterBiometrics, setBiometricSessionVerified, trySilentRefresh } from '@/services/authService';
import { consumePendingNotificationRoute, registerDeviceTokenWithBackend } from '@/services/expo-notification';
// import { authorize } from 'react-native-app-auth';
import {
  buildAuthorizationUrl,
  clearOAuthSession,
  exchangeCodeForTokens,
  generatePKCE,
  generateState,
  makeAppRedirectUri,
  restoreOAuthSession,
  saveOAuthSession,
} from '@/services/oauth';


const LoginScreen = () => {
  const router = useRouter();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();
  const themeColors = Colors[colorScheme ?? 'light'];

  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");

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
        appState?.current?.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        
      }
      appState.current = nextAppState;
    });

    setOrgName(SecureStore.getItem("org_name") ?? "");

    return () => {
      if (Platform.OS === 'android') {
        WebBrowser.coolDownAsync();
      }
      subscription.remove();
    };
  }, []);

  const redirectUri = makeAppRedirectUri();

  // Restore OAuth session state on mount (in case app was killed during 2FA)
  useEffect(() => {
    const restoreAuthSession = async () => {
      try {
        const { state: storedState, codeVerifier: storedVerifier } = await restoreOAuthSession();
        if (storedState) oauthStateRef.current = storedState;
        if (storedVerifier) codeVerifierRef.current = storedVerifier;
      } catch (err) {
        
      }
    };
    restoreAuthSession();
  }, []);

  useEffect(() => {
    checkBiometrics();
  }, []);

  // Set up deep link listener for OAuth callback
  useEffect(() => {
    const handleDeepLink = ({ url }: { url: string }) => {

      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code as string;
      const state = parsed.queryParams?.state as string;

      // Ensure we have a code and the state matches what we sent
      if (code && state && state === oauthStateRef.current) {
        if (isProcessingCallbackRef.current) {
          return;
        }
        
        handleOAuthCallback(code);
      } else if (parsed.queryParams?.error) {
        const error = parsed.queryParams.error as string;
        
        setLoading(false);
        cleanupAuthSession();
        showToast(`Authentication failed: ${error}`, 'error');
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
          
          setLoading(false);
          cleanupAuthSession();

          showToast('Authentication took too long and was cancelled. Please try again.', 'error');
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
    await clearOAuthSession();
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
        const refreshOutcome = await trySilentRefresh();
        setCanUseBiometrics(refreshOutcome === 'ok');
      } catch (err) {
        
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
      const restored = await restoreOAuthSession();
      const verifier = codeVerifierRef.current ?? restored.codeVerifier;

      if (!verifier) {
        throw new Error('Code verifier not found. Session may have expired. Please try signing in again.');
      }

      
      await exchangeCodeForTokens({ code, codeVerifier: verifier, redirectUri });

      

      // Close browser and cleanup session
      WebBrowser.dismissBrowser();
      await cleanupAuthSession();

      // After first login, prompt user to enable biometrics for future sessions
      await promptEnableBiometricsIfNeeded();
    } catch (error) {
      
      await cleanupAuthSession();
      setLoading(false);
      WebBrowser.dismissBrowser();

      if (error instanceof AuthError) {
        showToast(error.message, error.severity);
      } else {
        showToast('Failed to complete authentication. PKCE verification or network error. Please try again.', 'error');
      }
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
    authStartTimeRef.current = Date.now();
    isProcessingCallbackRef.current = false;

    try {
      // Generate PKCE parameters
      const { codeVerifier, codeChallenge } = await generatePKCE();
      codeVerifierRef.current = codeVerifier;

      // Generate state parameter
      const state = await generateState();
      oauthStateRef.current = state;

      const oauthUrl = buildAuthorizationUrl({ state, codeChallenge, redirectUri });

      // Persist state and verifier for app-switching robustness
      await saveOAuthSession({ state, codeVerifier, authUrl: oauthUrl });
      

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
            setLoading(false);
          }
        }, 3000);
      }
    } catch (error) {
      await cleanupAuthSession();
      setLoading(false);

      showToast('An error occurred during authentication. Please try again.', 'error');
    }
  };

  // Post-auth landing: a notification tap that detoured through login
  // still lands on its exact screen instead of the dashboard.
  const navigateAfterAuth = async () => {
    setBiometricSessionVerified(true);
    void registerDeviceTokenWithBackend();
    // First login ever: force App PIN setup before entering the app.
    if (!(await hasAppPin())) {
      router.replace('/setup-pin');
      return;
    }
    const pending = await consumePendingNotificationRoute();
    if (pending) {
      router.replace(pending);
    } else {
      router.replace('/(tabs)');
    }
  };

  const onFingerprintLogin = async () => {
    try {
      // Step 0: Validate the stored session BEFORE showing the fingerprint
      // modal, so a dead session goes straight to credential login instead
      // of failing after a successful biometric challenge.
      setLoading(true);
      const sessionStatus = await trySilentRefresh();
      if (sessionStatus === 'offline') {
        showToast('You appear to be offline. Please check your connection and try again.', 'warning');
        return;
      }
      if (sessionStatus !== 'ok') {
        setCanUseBiometrics(false);
        showToast('Your session has expired. Please log in with your credentials.', 'info');
        return;
      }

      // Step 1: Prompt for biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with Biometrics',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        setLoading(true);
        try {
          const tokenResult = await ensureFreshTokenAfterBiometrics(120);
          if (tokenResult.success) {
            await navigateAfterAuth();
          } else {
            showToast(
              tokenResult.error || 'Your session has expired. Please log in with your credentials.',
              tokenResult.offline ? 'warning' : 'info',
            );
          }
        } catch (authError) {
          console.error('Silent refresh failed during biometric login:', authError);
          showToast('Your session has expired. Please log in with your credentials.', 'info');
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Biometric auth error:', error);
      showToast('Biometric authentication failed.', 'error');
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

          <View style={styles.legalNoticeContainer}>
            <Text style={[styles.legalNoticeText, { color: colorScheme === 'dark' ? '#A0AEC0' : '#718096' }]}>
              By continuing, you agree to Coop Orbit's{' '}
              <Text
                style={[styles.legalNoticeLink, { color: colorScheme === 'dark' ? '#90CDF4' : '#173581' }]}
                onPress={() => WebBrowser.openBrowserAsync('https://cooporbit.com/terms')}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={[styles.legalNoticeLink, { color: colorScheme === 'dark' ? '#90CDF4' : '#173581' }]}
                onPress={() => WebBrowser.openBrowserAsync('https://cooporbit.com/privacy')}
              >
                Privacy Policy
              </Text>.
            </Text>
          </View>

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
  legalNoticeContainer: {
    marginTop: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  legalNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  legalNoticeLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
});
