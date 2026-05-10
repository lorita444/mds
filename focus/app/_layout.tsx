import '../global.css';
import 'react-native-url-polyfill/auto';

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';

import { AuthProvider, useAuth } from '../context/auth-context';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ToastContainer } from '../components/ui/Toast';
import { ALL_ASSETS } from '../utils/assets';

function RootNavigation({ assetsReady }: { assetsReady: boolean }) {
  const { session, loading, loadingMessage } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || !assetsReady) return;
    const inAuthGroup = (segments as string[])[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/onboarding' as never);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/studyverse' as never);
    }
  }, [session, loading, assetsReady, segments, router]);

  if (!assetsReady) {
    return <LoadingState message="Preparing your universe..." subtitle="Loading assets" />;
  }

  if (loading) {
    return <LoadingState message={loadingMessage} subtitle="Preparing your universe" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: '#030712' },
      }}
    />
  );
}

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    Asset.loadAsync(ALL_ASSETS as unknown as number[])
      .catch(() => {})
      .finally(() => setAssetsReady(true));
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ErrorBoundary>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" />
            <RootNavigation assetsReady={assetsReady} />
            <ToastContainer />
          </View>
        </ErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
