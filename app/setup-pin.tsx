import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useToast } from '@/context/ToastContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { APP_PIN_LENGTH, setAppPin } from '@/services/app-pin';
import { consumePendingNotificationRoute } from '@/services/expo-notification';

/**
 * First-login App PIN setup. Runs once per install (right after a full
 * Keycloak sign-in when no PIN hash exists) and doubles as the lock-screen
 * fallback whenever biometrics fail, cancel, or are turned off.
 */
export default function SetupPinScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { showToast } = useToast();

  const length = APP_PIN_LENGTH;
  const [entry, setEntry] = useState('');
  const [confirm, setConfirm] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const bg = isDark ? '#121212' : '#F8F9FB';
  const textPrimary = isDark ? '#FFFFFF' : '#1A202C';
  const textSecondary = isDark ? '#A0AEC0' : '#718096';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const keyBg = isDark ? '#2D3748' : '#EDF2F7';
  const primary = '#173581';

  const finishSetup = async () => {
    setIsSaving(true);
    try {
      await setAppPin(confirm);
      showToast('App PIN set. You can unlock quickly with it from now on.', 'success');
      const pending = await consumePendingNotificationRoute();
      if (pending) {
        router.replace(pending);
      } else {
        router.replace('/(tabs)');
      }
    } catch {
      showToast('Could not save your PIN. Please try again.', 'error');
      setIsSaving(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (isSaving) return;
    if (!confirming) {
      if (entry.length < length) setEntry((prev) => prev + digit);
    } else if (confirm.length < length) {
      const next = confirm + digit;
      setConfirm(next);
      if (next.length === length) {
        if (next !== entry) {
          showToast("PINs don't match. Please try again.", 'warning');
          setEntry('');
          setConfirm('');
          setConfirming(false);
          return;
        }
        void finishSetup();
      }
    }
  };

  const handleBackspace = () => {
    if (isSaving) return;
    if (confirming) {
      setConfirm((prev) => prev.slice(0, -1));
    } else {
      setEntry((prev) => prev.slice(0, -1));
    }
  };

  const current = confirming ? confirm : entry;
  const dots = Array.from({ length }, (_, i) => i < current.length);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: primary }]}>
          <Ionicons name="key-outline" size={36} color="#FFFFFF" />
        </View>
        <Text style={[styles.title, { color: textPrimary }]}>Set up your App PIN</Text>
        <Text style={[styles.subtitle, { color: textSecondary }]}>
          {confirming
            ? 'Enter it once more to confirm'
            : 'Quick unlock for this device — used whenever fingerprint is unavailable'}
        </Text>

        <Text style={[styles.subtitle, { color: textSecondary }]}>4 digits</Text>

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

        {!confirming && entry.length === length ? (
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: primary }]}
            onPress={() => setConfirming(true)}
            disabled={isSaving}
          >
            <Text style={styles.continueText}>Continue</Text>
          </TouchableOpacity>
        ) : null}

        <View style={[styles.keypad, { backgroundColor: cardBg }]}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'].map((key, i) => (
            <View key={`${key}-${i}`} style={styles.keyCell}>
              {key === '' ? null : key === 'back' ? (
                <TouchableOpacity
                  style={[styles.key, { backgroundColor: keyBg }]}
                  onPress={handleBackspace}
                  disabled={isSaving}
                  accessibilityLabel="Delete digit"
                >
                  <Ionicons name="backspace-outline" size={24} color={textPrimary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.key, { backgroundColor: keyBg }]}
                  onPress={() => handleDigit(key)}
                  disabled={isSaving}
                  accessibilityLabel={`Digit ${key}`}
                >
                  <Text style={[styles.keyText, { color: textPrimary }]}>{key}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
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
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
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
  continueButton: {
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 12,
    marginTop: 12,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
});
