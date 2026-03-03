import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { trySilentRefresh } from '@/services/authService';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

export default function Index() {
  const [authState, setAuthState] = useState<AuthState>('checking');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const isAuthenticated = await trySilentRefresh();
      setAuthState(isAuthenticated ? 'authenticated' : 'unauthenticated');
    } catch {
      setAuthState('unauthenticated');
    }
  };

  if (authState === 'checking') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' }}>
        <ActivityIndicator size="large" color="#173581" />
      </View>
    );
  }

  if (authState === 'authenticated') {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}
