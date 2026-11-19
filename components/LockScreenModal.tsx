import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useAppLock } from '@/context/AuthLockContext';
import { AuthError, getValidAccessToken, logout } from '@/services/authService';
import { clearAppPin, getAppPinLength, verifyAppPin } from '@/services/app-pin';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_PIN_ATTEMPTS = 5;

type LockMode = 'checking' | 'pin';

export default function LockScreenModal() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();
  const { unlock } = useAppLock();

  const [mode, setMode] = useState<LockMode>('checking');
  const [pinLength, setPinLength] = useState<number>(4);
  const [entry, setEntry] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_PIN_ATTEMPTS);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const biometricAttempted = useRef(false);

  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const keyBg = isDark ? '#2D3748' : '#EDF2F7';
  const primary = '#173581';

  const leaveLockScreen = useCallback(() => {
    // Dismiss the overlay first: with no session the provider will not
    // re-lock, so the login screen is reachable underneath.
    unlock();
    router.replace('/login');
  }, [router, unlock]);

  const failToFullLogin = useCallback(async (message: string) => {
    await logout();
    await clearAppPin();
    showToast(message, 'error');
    leaveLockScreen();
  }, [leaveLockScreen, showToast]);

  const confirmSessionAlive = useCallback(async (): Promise<boolean> => {
    try {
      await getValidAccessToken();
      return true;
    } catch (err) {
      if (err instanceof AuthError && err.kind === 'network') {
        showToast(err.message, 'warning');
        return false;
      }
      await failToFullLogin('Your session has expired. Please sign in again.');
      return false;
    }
  }, [failToFullLogin, showToast]);

  const tryBiometricUnlock = useCallback(async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Coop Orbit',
        fallbackLabel: 'Enter App PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        if (await confirmSessionAlive()) {
          unlock();
        }
        return;
      }
      // Fail, cancel, fallback, or lockout: fall through to the App PIN pad.
      const code = String(result.error ?? '');
      if (code === 'user_cancel' || code === 'app_cancel') {
        setError('Biometric unlock cancelled. Enter your App PIN instead.');
      } else if (code === 'lockout' || code === 'lockout_permanent') {
        setError('Too many biometric attempts. Enter your App PIN instead.');
      }
      setMode('pin');
    } catch {
      setMode('pin');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmSessionAlive]);

  useEffect(() => {
    // One automatic biometric challenge per lock; everything else lands on PIN.
    if (biometricAttempted.current) return;
    biometricAttempted.current = true;
    (async () => {
      try {
        const [hasHardware, enrolled, enabled, length] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
          SecureStore.getItemAsync('biometrics_enabled'),
          getAppPinLength(),
        ]);
        setPinLength(length);
        if (hasHardware && enrolled && enabled === 'true') {
          await tryBiometricUnlock();
        } else {
          setMode('pin');
        }
      } catch {
        setMode('pin');
      }
    })();
  }, [tryBiometricUnlock]);

  const handleDigit = (digit: string) => {
    if (isVerifying || entry.length >= pinLength) return;
    setError(null);
    const next = entry + digit;
    setEntry(next);
    if (next.length === pinLength) {
      void verifyPin(next);
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setEntry((prev) => prev.slice(0, -1));
  };

  const verifyPin = async (candidate: string) => {
    setIsVerifying(true);
    try {
      if (await verifyAppPin(candidate)) {
        if (await confirmSessionAlive()) {
          unlock();
        }
        return;
      }
      const remaining = attemptsLeft - 1;
      setAttemptsLeft(remaining);
      setEntry('');
      if (remaining <= 0) {
        await failToFullLogin('Too many incorrect PIN attempts. Please sign in again.');
        return;
      }
      setError(`Incorrect PIN. ${remaining} ${remaining === 1 ? 'try' : 'tries'} left.`);
    } finally {
      setIsVerifying(false);
    }
  };

  const usePasswordInstead = async () => {
    await logout();
    leaveLockScreen();
  };

  const forgotPin = async () => {
    // A forgotten PIN can only be recovered with a fresh Keycloak sign-in,
    // after which PIN setup runs again.
    await logout();
    await clearAppPin();
    showToast('Sign in to set up a new App PIN.', 'info');
    leaveLockScreen();
  };

  const dots = Array.from({ length: pinLength }, (_, i) => i < entry.length);

  return (
    <Modal visible animationType="fade" transparent={false} onRequestClose={() => undefined}>
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.content}>
          <View style={[styles.iconCircle, { backgroundColor: primary }]}>
            <Ionicons name="lock-closed" size={36} color="#FFFFFF" />
          </View>
          <Text style={[styles.title, { color: textPrimary }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: textSecondary }]}>
            {mode === 'checking' ? 'Checking biometrics…' : 'Enter your App PIN to continue'}
          </Text>

          {mode === 'checking' ? (
            <ActivityIndicator size="large" color={primary} style={styles.loader} />
          ) : (
            <>
              <View style={styles.dotsRow}>
                {dots.map((filled, i) => (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                    style={[
                      styles.dot,
                      { borderColor: textSecondary, backgroundColor: filled ? primary : 'transparent' },
                    ]}
                  />
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <View style={[styles.keypad, { backgroundColor: cardBg }]}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
                  <View key={`${key}-${i}`} style={styles.keyCell}>
                    {key === '' ? null : key === 'back' ? (
                      <TouchableOpacity
                        style={[styles.key, { backgroundColor: keyBg }]}
                        onPress={handleBackspace}
                        disabled={isVerifying}
                        accessibilityLabel="Delete digit"
                      >
                        <Ionicons name="backspace-outline" size={24} color={textPrimary} />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.key, { backgroundColor: keyBg }]}
                        onPress={() => handleDigit(key)}
                        disabled={isVerifying}
                        accessibilityLabel={`Digit ${key}`}
                      >
                        <Text style={[styles.keyText, { color: textPrimary }]}>{key}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              <View style={styles.links}>
                <TouchableOpacity onPress={() => void tryBiometricUnlock()} disabled={isVerifying}>
                  <Text style={[styles.link, { color: primary }]}>Use fingerprint</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void forgotPin()} disabled={isVerifying}>
                  <Text style={[styles.link, { color: primary }]}>Forgot PIN?</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => void usePasswordInstead()} disabled={isVerifying}>
                <Text style={[styles.link, { color: textSecondary }]}>Sign in with password instead</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  loader: {
    marginTop: 32,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
    marginBottom: 8,
    height: 18,
    alignItems: 'center',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    minHeight: 18,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
    width: '100%',
    maxWidth: 320,
  },
  keyCell: {
    width: '33.333%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  key: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
  links: {
    flexDirection: 'row',
    gap: 24,
    marginTop: 20,
  },
  link: {
    fontSize: 14,
    fontWeight: '600',
    padding: 4,
  },
});
