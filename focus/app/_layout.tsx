import '../global.css';
import 'react-native-url-polyfill/auto';

import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '../context/auth-context';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ToastContainer } from '../components/ui/Toast';

function RootNavigation() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = (segments as string[])[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/onboarding' as never);
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)' as never);
    }
  }, [session, loading, segments, router]);

  if (loading) return <LoadingState message="Entering the universe..." />;

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
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ErrorBoundary>
          <View style={{ flex: 1 }}>
            <StatusBar style="light" />
            <RootNavigation />
            <ToastContainer />
          </View>
        </ErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
