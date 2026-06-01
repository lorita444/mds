import '../global.css';
import 'react-native-url-polyfill/auto';

import { useEffect, useState } from 'react';
import { View, Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Asset } from 'expo-asset';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from '../context/auth-context';
import { LoadingState } from '../components/ui/LoadingState';
import { ErrorBoundary } from '../components/ui/ErrorBoundary';
import { ToastContainer } from '../components/ui/Toast';
import { ALL_ASSETS } from '../utils/assets';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  requestNotificationPermissions,
  scheduleDailyStudyReminder,
  scheduleMorningStudyReminder,
  scheduleSnoozedStudyReminder,
  cancelDailyStudyReminder,
  cancelMorningStudyReminder,
  scheduleCustomStudyReminder,
  cancelCustomStudyReminder,
} from '../lib/notifications';

function RootNavigation({ assetsReady }: { assetsReady: boolean }) {
  const { session, profile, loading, loadingMessage } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading || !assetsReady) return;
    const segs = segments as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const onWelcomePage = segs[0] === '(auth)' && segs[1] === 'welcome';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/onboarding' as never);
    } else if (session && inAuthGroup && !onWelcomePage) {
      // Don't redirect away from welcome — user just signed up
      router.replace('/(tabs)/studyverse' as never);
    }
  }, [session, loading, assetsReady, segments, router]);

  useEffect(() => {
    if (session && profile) {
      const initReminders = async () => {
        try {
          const morningEnabled = await AsyncStorage.getItem('settings_morning_reminder');
          const eveningEnabled = await AsyncStorage.getItem('settings_evening_reminder');
          const remindersJson = await AsyncStorage.getItem('settings_custom_reminders');

          if (morningEnabled === 'false') {
            await cancelMorningStudyReminder().catch(() => {});
          } else {
            await scheduleMorningStudyReminder(profile.streak_days).catch(() => {});
          }

          if (eveningEnabled === 'false') {
            await cancelDailyStudyReminder().catch(() => {});
          } else {
            await scheduleDailyStudyReminder(profile.streak_days).catch(() => {});
          }

          // Load and schedule multiple custom reminders
          if (remindersJson) {
            const reminders: { id: string; hour: number; minute: number; enabled: boolean }[] = JSON.parse(remindersJson);
            for (const reminder of reminders) {
              if (reminder.enabled) {
                await scheduleCustomStudyReminder(reminder.hour, reminder.minute, reminder.id).catch(() => {});
              } else {
                await cancelCustomStudyReminder(reminder.id).catch(() => {});
              }
            }
          }
        } catch (e) {
          console.error('Failed to initialize settings-aware reminders', e);
        }
      };

      initReminders().catch(() => {});
    }
  }, [session, profile]);


  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (response.actionIdentifier === 'remind_later') {
        try {
          await scheduleSnoozedStudyReminder();
          Alert.alert(
            'Reamintire amânată! ⏰',
            'S-a făcut! Te vom notifica din nou peste o oră ca să nu pierzi ritmul.',
            [{ text: 'Super!' }]
          );
        } catch (e) {
          console.error('Failed to schedule snoozed reminder', e);
        }
      }
    });
    return () => sub.remove();
  }, []);

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
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="settings"
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const [assetsReady, setAssetsReady] = useState(false);

  useEffect(() => {
    Asset.loadAsync(ALL_ASSETS as unknown as number[])
      .catch(() => {})
      .finally(() => setAssetsReady(true));

    requestNotificationPermissions().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ErrorBoundary>
          <View style={{ flex: 1, position: 'relative' }}>
            <StatusBar style="light" />
            <RootNavigation assetsReady={assetsReady} />
          </View>
          <ToastContainer />
        </ErrorBoundary>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
