import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import { AppThemeProvider, useAppTheme } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { setupAppNotificationListeners } from '@/services/expo-notification';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { colorScheme } = useAppTheme();

  useEffect(() => {
    const unsubscribe = setupAppNotificationListeners();
    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="login">
        <Stack.Screen name="index" options={{ headerShown: false, title: SecureStore.getItem('org_name') ?? '' }} />
        <Stack.Screen name="login" options={{ headerShown: false, title: SecureStore.getItem('org_name') ?? '' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="make-payment" options={{ headerShown: false }} />
        <Stack.Screen name="request-loan" options={{ headerShown: false }} />
        <Stack.Screen name="loans" options={{ headerShown: false }} />
        <Stack.Screen name="loan-details" options={{ headerShown: false }} />
        <Stack.Screen name="guarantor-requests" options={{ headerShown: false }} />
        <Stack.Screen name="payment-requests" options={{ headerShown: false }} />
        <Stack.Screen name="payment-request-details" options={{ headerShown: false }} />
        <Stack.Screen name="members" options={{ headerShown: false }} />
        <Stack.Screen name="member-details" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ToastProvider>
        <RootLayoutNav />
      </ToastProvider>
    </AppThemeProvider>
  );
}
