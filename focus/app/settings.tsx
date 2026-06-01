import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/auth-context';
import { colors, spacing, typography, radius } from '../utils/theme';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { toast } from '../store/useAppStore';
import { resetStudyProgress, deleteUserAccount, updateProfile } from '../lib/db';
import {
  scheduleDailyStudyReminder,
  scheduleMorningStudyReminder,
  cancelDailyStudyReminder,
  cancelMorningStudyReminder,
  scheduleCustomStudyReminder,
  cancelCustomStudyReminder,
} from '../lib/notifications';

const AVATAR_OPTIONS = ['🧑‍🚀', '👽', '🛸', '🤖', '🪐', '🌌', '🌟', '☄️'];

type CustomReminder = {
  id: string;
  hour: number;
  minute: number;
  enabled: boolean;
};

const CUSTOM_REMINDERS_KEY = 'settings_custom_reminders';

export default function SettingsScreen() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Profile states
  const [username, setUsername] = useState(profile?.username ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url ?? '🧑‍🚀');
  const [savingProfile, setSavingProfile] = useState(false);

  // Notification states
  const [morningReminder, setMorningReminder] = useState(true);
  const [eveningReminder, setEveningReminder] = useState(true);

  // Multiple custom reminders
  const [customReminders, setCustomReminders] = useState<CustomReminder[]>([]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const morning = await AsyncStorage.getItem('settings_morning_reminder');
        const evening = await AsyncStorage.getItem('settings_evening_reminder');
        const remindersJson = await AsyncStorage.getItem(CUSTOM_REMINDERS_KEY);

        if (morning !== null) setMorningReminder(morning !== 'false');
        if (evening !== null) setEveningReminder(evening !== 'false');
        if (remindersJson) {
          setCustomReminders(JSON.parse(remindersJson));
        }
      } catch (e) {
        console.error('Failed to load settings from storage', e);
      }
    };
    loadSettings();
  }, []);

  const saveReminders = async (list: CustomReminder[]) => {
    await AsyncStorage.setItem(CUSTOM_REMINDERS_KEY, JSON.stringify(list));
  };

  // Morning reminder toggle
  const handleToggleMorning = async (value: boolean) => {
    setMorningReminder(value);
    try {
      await AsyncStorage.setItem('settings_morning_reminder', String(value));
      if (value) {
        await scheduleMorningStudyReminder(profile?.streak_days ?? 0);
        toast('Memento de dimineață activat (09:00 AM) ☀️', 'success');
      } else {
        await cancelMorningStudyReminder();
        toast('Memento de dimineață dezactivat', 'info');
      }
    } catch (e) {
      console.error(e);
      toast('Failed to save settings', 'error');
    }
  };

  // Evening reminder toggle
  const handleToggleEvening = async (value: boolean) => {
    setEveningReminder(value);
    try {
      await AsyncStorage.setItem('settings_evening_reminder', String(value));
      if (value) {
        await scheduleDailyStudyReminder(profile?.streak_days ?? 0);
        toast('Memento de seară activat (19:30 PM) 🌌', 'success');
      } else {
        await cancelDailyStudyReminder();
        toast('Memento de seară dezactivat', 'info');
      }
    } catch (e) {
      console.error(e);
      toast('Failed to save settings', 'error');
    }
  };

  // Add a new custom reminder
  const handleAddReminder = async () => {
    const newReminder: CustomReminder = {
      id: Date.now().toString(),
      hour: 18,
      minute: 0,
      enabled: true,
    };
    const updated = [...customReminders, newReminder];
    setCustomReminders(updated);
    await saveReminders(updated);
    // Schedule it
    await scheduleCustomStudyReminder(newReminder.hour, newReminder.minute, newReminder.id);
    toast('Alertă personalizată adăugată ⏰', 'success');
  };

  // Delete a custom reminder
  const handleDeleteReminder = async (id: string) => {
    const updated = customReminders.filter((r) => r.id !== id);
    setCustomReminders(updated);
    await saveReminders(updated);
    await cancelCustomStudyReminder(id);
    toast('Alertă ștearsă', 'info');
  };

  // Toggle a reminder on/off
  const handleToggleReminder = async (id: string, value: boolean) => {
    const updated = customReminders.map((r) =>
      r.id === id ? { ...r, enabled: value } : r
    );
    setCustomReminders(updated);
    await saveReminders(updated);
    const reminder = updated.find((r) => r.id === id);
    if (reminder) {
      if (value) {
        await scheduleCustomStudyReminder(reminder.hour, reminder.minute, id);
        toast(`Alertă activată la ${String(reminder.hour).padStart(2, '0')}:${String(reminder.minute).padStart(2, '0')} ⏰`, 'success');
      } else {
        await cancelCustomStudyReminder(id);
        toast('Alertă dezactivată', 'info');
      }
    }
  };

  // Adjust hour for a specific reminder
  const adjustHour = async (id: string, amount: number) => {
    const updated = customReminders.map((r) => {
      if (r.id !== id) return r;
      let nextHour = r.hour + amount;
      if (nextHour > 23) nextHour = 0;
      if (nextHour < 0) nextHour = 23;
      return { ...r, hour: nextHour };
    });
    setCustomReminders(updated);
    await saveReminders(updated);
    const reminder = updated.find((r) => r.id === id);
    if (reminder?.enabled) {
      await scheduleCustomStudyReminder(reminder.hour, reminder.minute, id);
    }
  };

  // Adjust minute for a specific reminder (5-min steps)
  const adjustMinute = async (id: string, amount: number) => {
    const updated = customReminders.map((r) => {
      if (r.id !== id) return r;
      let nextMin = r.minute + amount;
      if (nextMin > 55) nextMin = 0;
      if (nextMin < 0) nextMin = 55;
      return { ...r, minute: nextMin };
    });
    setCustomReminders(updated);
    await saveReminders(updated);
    const reminder = updated.find((r) => r.id === id);
    if (reminder?.enabled) {
      await scheduleCustomStudyReminder(reminder.hour, reminder.minute, id);
    }
  };

  // Save profile name/avatar
  const handleSaveProfile = async () => {
    if (!username.trim() || !user?.id) {
      toast('Username required', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        username: username.trim(),
        avatar_url: selectedAvatar,
      });
      await refreshProfile();
      toast('Profil actualizat cu succes! 🛰️', 'success');
    } catch (e) {
      toast('Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Reset progress from database
  const handleResetProgress = () => {
    Alert.alert(
      'Resetezi Istoricul de Studiu? 🌋',
      'Aceasta va șterge streak-urile, multiplicatorii, recompensele și orele totale de studiu permanent din baza de date. Acțiunea este ireversibilă.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Resetează Tot',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetStudyProgress();
              await refreshProfile();
              Alert.alert(
                'Progres șters! 🌌',
                'Progresul tău de studiu a fost șters cu succes din baza de date!',
                [{ text: 'Super' }]
              );
              toast('Progres resetat cu succes', 'success');
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut șterge progresul de studiu.');
            }
          },
        },
      ]
    );
  };

  // Delete account from database
  const handleDeleteAccount = () => {
    Alert.alert(
      'Ștergi Contul? ⚠️',
      'Aceasta va șterge permanent contul tău și toate subiectele, capitolele, flashcard-urile și sesiunile de studiu din baza de date. Acțiunea este ireversibilă.',
      [
        { text: 'Anulează', style: 'cancel' },
        {
          text: 'Șterge Contul',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount();
              await signOut();
              Alert.alert(
                'Cont șters! 🚀',
                'Contul tău StudyVerse a fost eliminat definitiv. Drum bun în cosmos!',
                [{ text: 'La revedere' }]
              );
            } catch (e) {
              Alert.alert('Eroare', 'Nu s-a putut elimina contul.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg.primary }}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'ios' ? insets.top + spacing.sm : spacing.lg,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: radius.full,
            backgroundColor: colors.bg.card,
            borderWidth: 1,
            borderColor: colors.bg.cardBorder,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="arrow-back-outline" size={20} color={colors.text.secondary} />
        </Pressable>
        <Text
          style={{
            color: colors.text.primary,
            fontSize: typography.sizes.xl,
            fontWeight: typography.weights.heavy,
          }}
        >
          Setări
        </Text>
      </View>

      {/* Profile Info */}
      <Card variant="glow" padding={spacing.lg}>
        <View style={{ gap: spacing.md }}>
          <Text
            style={{
              color: colors.cosmic.purpleLight,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              letterSpacing: typography.tracking.widest,
              textTransform: 'uppercase',
            }}
          >
            Identitate Explorer
          </Text>

          {/* Avatar selector */}
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.sm }}>
              Icon Avatar
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs, paddingVertical: 4 }}>
              {AVATAR_OPTIONS.map((avatar) => {
                const active = selectedAvatar === avatar;
                return (
                  <Pressable
                    key={avatar}
                    onPress={() => setSelectedAvatar(avatar)}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: radius.sm,
                      backgroundColor: active ? colors.cosmic.purpleFaint : colors.bg.card,
                      borderWidth: 1.5,
                      borderColor: active ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 22 }}>{avatar}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Username input */}
          <Input
            label="Nume Explorer"
            placeholder="Explorer"
            value={username}
            onChangeText={setUsername}
          />

          <Button
            label="Salvează Profilul"
            onPress={handleSaveProfile}
            loading={savingProfile}
            fullWidth
            size="md"
            variant="primary"
          />
        </View>
      </Card>

      {/* Study Notifications */}
      <Card variant="elevated" padding={spacing.md}>
        <View style={{ gap: spacing.md }}>
          <Text
            style={{
              color: colors.text.secondary,
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.semibold,
              letterSpacing: typography.tracking.widest,
              textTransform: 'uppercase',
            }}
          >
            Notificări de Studiu
          </Text>

          {/* Morning reminder */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.medium }}>
                Alertă Dimineață ☀️
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Memento zilnic la 09:00 AM
              </Text>
            </View>
            <Switch
              value={morningReminder}
              onValueChange={handleToggleMorning}
              trackColor={{ false: colors.bg.input, true: colors.cosmic.purple }}
              thumbColor={Platform.OS === 'android' ? colors.text.primary : undefined}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.bg.cardBorder }} />

          {/* Evening reminder */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.medium }}>
                Alertă Seară 🌌
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Memento zilnic la 07:30 PM
              </Text>
            </View>
            <Switch
              value={eveningReminder}
              onValueChange={handleToggleEvening}
              trackColor={{ false: colors.bg.input, true: colors.cosmic.purple }}
              thumbColor={Platform.OS === 'android' ? colors.text.primary : undefined}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.bg.cardBorder }} />

          {/* Multiple Custom Reminders */}
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.medium }}>
                  Alerte Personalizate ⏰
                </Text>
                <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                  Adaugă oricâte alerte doriți
                </Text>
              </View>
              <Pressable
                onPress={handleAddReminder}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: radius.full,
                  backgroundColor: colors.cosmic.purpleFaint,
                  borderWidth: 1,
                  borderColor: colors.cosmic.purpleGlow,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="add" size={20} color={colors.cosmic.purpleLight} />
              </Pressable>
            </View>

            {customReminders.length === 0 && (
              <Text style={{ color: colors.text.dim, fontSize: typography.sizes.xs, fontStyle: 'italic' }}>
                Apasă + pentru a adăuga prima alertă personalizată.
              </Text>
            )}

            {customReminders.map((reminder) => (
              <View
                key={reminder.id}
                style={{
                  backgroundColor: colors.bg.input,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  gap: spacing.sm,
                  borderWidth: 1,
                  borderColor: reminder.enabled ? colors.cosmic.purpleGlow : colors.bg.cardBorder,
                }}
              >
                {/* Header row: switch + delete */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text.secondary, fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold }}>
                    {reminder.enabled ? '🔔 Activă' : '🔕 Dezactivată'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Switch
                      value={reminder.enabled}
                      onValueChange={(v) => handleToggleReminder(reminder.id, v)}
                      trackColor={{ false: colors.bg.card, true: colors.cosmic.purple }}
                      thumbColor={Platform.OS === 'android' ? colors.text.primary : undefined}
                    />
                    <Pressable
                      onPress={() => handleDeleteReminder(reminder.id)}
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: radius.sm,
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        borderWidth: 1,
                        borderColor: 'rgba(239,68,68,0.25)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>

                {/* Time adjuster */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
                  {/* Hour */}
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Pressable
                      onPress={() => adjustHour(reminder.id, 1)}
                      style={{
                        width: 36, height: 36, borderRadius: radius.sm,
                        backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: colors.bg.cardBorder,
                      }}
                    >
                      <Ionicons name="chevron-up" size={20} color={colors.text.primary} />
                    </Pressable>
                    <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>
                      {String(reminder.hour).padStart(2, '0')}
                    </Text>
                    <Pressable
                      onPress={() => adjustHour(reminder.id, -1)}
                      style={{
                        width: 36, height: 36, borderRadius: radius.sm,
                        backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: colors.bg.cardBorder,
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={colors.text.primary} />
                    </Pressable>
                  </View>

                  <Text style={{ color: colors.text.primary, fontSize: 28, fontWeight: '700', paddingBottom: 4 }}>:</Text>

                  {/* Minute */}
                  <View style={{ alignItems: 'center', gap: 4 }}>
                    <Pressable
                      onPress={() => adjustMinute(reminder.id, 5)}
                      style={{
                        width: 36, height: 36, borderRadius: radius.sm,
                        backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: colors.bg.cardBorder,
                      }}
                    >
                      <Ionicons name="chevron-up" size={20} color={colors.text.primary} />
                    </Pressable>
                    <Text style={{ color: colors.text.primary, fontSize: 24, fontWeight: '700', minWidth: 32, textAlign: 'center' }}>
                      {String(reminder.minute).padStart(2, '0')}
                    </Text>
                    <Pressable
                      onPress={() => adjustMinute(reminder.id, -5)}
                      style={{
                        width: 36, height: 36, borderRadius: radius.sm,
                        backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 1, borderColor: colors.bg.cardBorder,
                      }}
                    >
                      <Ionicons name="chevron-down" size={20} color={colors.text.primary} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {/* Dangerous Zone */}
      <Card
        variant="elevated"
        padding={spacing.md}
        style={{ borderColor: 'rgba(239, 68, 68, 0.25)', borderWidth: 1 }}
      >
        <View style={{ gap: spacing.md }}>
          <Text
            style={{
              color: '#ef4444',
              fontSize: typography.sizes.xs,
              fontWeight: typography.weights.bold,
              letterSpacing: typography.tracking.widest,
              textTransform: 'uppercase',
            }}
          >
            Zonă Periculoasă
          </Text>

          {/* Reset progress */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.medium }}>
                Resetare Istoric Studiu
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Șterge streak-uri, multiplicatori și ore totale
              </Text>
            </View>
            <Button
              label="Resetează"
              variant="danger"
              size="sm"
              onPress={handleResetProgress}
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.bg.cardBorder }} />

          {/* Delete account */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.text.primary, fontSize: typography.sizes.base, fontWeight: typography.weights.medium }}>
                Șterge Contul
              </Text>
              <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
                Șterge definitiv contul și toate datele de studiu
              </Text>
            </View>
            <Button
              label="Șterge"
              variant="danger"
              size="sm"
              onPress={handleDeleteAccount}
            />
          </View>
        </View>
      </Card>

      {/* Sign Out */}
      <View style={{ marginTop: spacing.md }}>
        <Button label="Deconectare din Cosmos" variant="danger" onPress={signOut} fullWidth size="lg" />
      </View>

      {/* App info */}
      <View style={{ alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
        <Text style={{ color: colors.text.muted, fontSize: typography.sizes.xs }}>
          StudyVerse v1.0.0
        </Text>
        <Text style={{ color: colors.text.dim, fontSize: typography.sizes.xs }}>
          Designed by Google DeepMind Advanced Agentic Coding
        </Text>
      </View>
    </ScrollView>
  );
}
