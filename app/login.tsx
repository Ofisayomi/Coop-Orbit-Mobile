import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useRef, useState } from 'react';
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

import { useColorScheme } from '@/hooks/use-color-scheme';
import { trySilentRefresh } from '@/services/authService';
import { exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';


const LoginScreen = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [canUseBiometrics, setCanUseBiometrics] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // WebView state
  const [showWebView, setShowWebView] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);

  // Track app lifecycle
  const appState = useRef(AppState.currentState);
  const oauthStateRef = useRef<string | null>(null);
  const codeVerifierRef = useRef<string | null>(null);
  const isProcessingCallbackRef = useRef(false);

  useEffect(() => {
    // Add app state listener
    const subscription = AppState.addEventListener('change', nextAppState => {
      appState.current = nextAppState;
    });

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

  // Restore OAuth session state on mount
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

  // Helper function to generate a random string for PKCE
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
    const codeVerifier = generateRandomString(64);
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      codeVerifier,
      { encoding: 'base64' as any }
    );
    const codeChallenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return { codeVerifier, codeChallenge };
  };

  const generateState = () => generateRandomString(32);

  const cleanupAuthSession = async () => {
    oauthStateRef.current = null;
    codeVerifierRef.current = null;
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

    if (isSupported && isEnabled) {
      setLoading(true);
      try {
        const canRefresh = await trySilentRefresh();
        setCanUseBiometrics(canRefresh);
      } catch (err) {
        console.error('Error checking silent refresh:', err);
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

      setShowWebView(false);
      await cleanupAuthSession();
      await promptEnableBiometricsIfNeeded();
    } catch (error) {
      console.error('Token exchange failed:', error);
      setShowWebView(false);
      await cleanupAuthSession();
      setLoading(false);

      Alert.alert(
        'Authentication Error',
        'Failed to complete authentication. Please try again.',
        [{ text: 'OK' }]
      );
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

    router.replace('/(tabs)');
  };


  const onLogin = async () => {
    setLoading(true);
    isProcessingCallbackRef.current = false;
    
    try {
      const { codeVerifier, codeChallenge } = await generatePKCE();
      codeVerifierRef.current = codeVerifier;

      const state = generateState();
      oauthStateRef.current = state;

      await Promise.all([
        SecureStore.setItemAsync('oauth_state', state),
        SecureStore.setItemAsync('code_verifier', codeVerifier),
      ]);

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

      setAuthUrl(`${baseUrl}?${params.toString()}`);
      setShowWebView(true);
    } catch (error) {
      console.error('OAuth error:', error);
      setLoading(false);
      Alert.alert('Error', 'Could not initialize login flow.');
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
        Alert.alert('Auth Failed', parsed.queryParams.error as string);
      }
    }
  };

  const onFingerprintLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Login with Biometrics',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        setLoading(true);
        try {
          const isAuthenticated = await trySilentRefresh();
          if (isAuthenticated) {
            router.replace('/(tabs)');
          } else {
            Alert.alert('Session Expired', 'Please log in with your credentials.');
          }
        } catch (authError) {
          Alert.alert('Session Expired', 'Please log in with your credentials.');
        } finally {
          setLoading(false);
        }
      }
    } catch (error) {
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
            <Image source={logoSource} style={styles.logo} resizeMode="contain" />
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
          }}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#121212' : '#fff' }}>
            <View style={[styles.webViewHeader, { borderBottomColor: colorScheme === 'dark' ? '#2D3748' : '#E2E8F0' }]}>
              <TouchableOpacity onPress={() => { setShowWebView(false); setLoading(false); }}>
                <Ionicons name="close" size={28} color={colorScheme === 'dark' ? '#fff' : '#173581'} />
              </TouchableOpacity>
              <Text style={[styles.webViewTitle, { color: colorScheme === 'dark' ? '#fff' : '#1A202C' }]}>Secure Sign In</Text>
              <View style={{ width: 28 }} />
            </View>
            {authUrl && (
              <WebView
                source={{ uri: authUrl }}
                onNavigationStateChange={onNavigationStateChange}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <ActivityIndicator style={styles.webViewLoading} size="large" color="#173581" />
                )}
                incognito={true} // Ensures a fresh session
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


