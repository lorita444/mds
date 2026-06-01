import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set default notification handler (how notifications are treated when app is open)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerNotificationCategories() {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync('study_reminder', [
    {
      identifier: 'remind_later',
      buttonTitle: 'Reamintește-mi mai târziu ⏰',
      options: {
        opensAppToForeground: true,
      },
    },
  ]);
  console.log('Notification category "study_reminder" registered!');
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  
  await registerNotificationCategories();
  
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    console.log('Failed to get notification permissions!');
    return false;
  }
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return true;
}

// ── DAILY & MORNING STUDY REMINDERS ──────────────────────────

export async function scheduleDailyStudyReminder(streakDays: number = 0) {
  if (Platform.OS === 'web') return;

  // First cancel existing to prevent multiple duplicates
  await cancelDailyStudyReminder();

  const title = 'Timpul trece! 🌌';
  const body = streakDays > 0
    ? `Menține-ți streak-ul activ! Rămâi concentrat și extinde streak-ul tău de ${streakDays} zile!`
    : 'Începe o nouă sesiune de studiu astăzi pentru a-ți dezvolta universul StudyVerse! 📚';

  // Schedule daily at 19:30 (7:30 PM) local time
  await Notifications.scheduleNotificationAsync({
    identifier: 'daily_study_reminder',
    content: {
      title,
      body,
      sound: true,
      categoryIdentifier: 'study_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 19,
      minute: 30,
      channelId: 'default',
    },
  });
  console.log('Daily study reminder scheduled successfully at 19:30!');
}

export async function cancelDailyStudyReminder() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('daily_study_reminder');
}

export async function scheduleMorningStudyReminder(streakDays: number = 0) {
  if (Platform.OS === 'web') return;

  await cancelMorningStudyReminder();

  const title = 'Bună dimineața! ☀️ Să începem ziua în StudyVerse!';
  const body = streakDays > 0
    ? `Ai lecții începute sau vrei să începi o sesiune nouă de dimineață? Extinde-ți streak-ul de ${streakDays} zile!`
    : 'Ai lecții începute nefinalizate? Sau vrei să începi o sesiune nouă pentru a-ți menține streak-ul? Concentrează-te de dimineață!';

  // Schedule daily at 09:00 AM local time
  await Notifications.scheduleNotificationAsync({
    identifier: 'morning_study_reminder',
    content: {
      title,
      body,
      sound: true,
      categoryIdentifier: 'study_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
      channelId: 'default',
    },
  });
  console.log('Morning study reminder scheduled successfully at 09:00!');
}

export async function cancelMorningStudyReminder() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('morning_study_reminder');
}

export async function scheduleSnoozedStudyReminder() {
  if (Platform.OS === 'web') return;

  // Schedule notification for 1 hour (3600 seconds) later
  await Notifications.scheduleNotificationAsync({
    identifier: 'snoozed_study_reminder',
    content: {
      title: 'Reamintire StudyVerse ⏰',
      body: 'A trecut o oră! Întoarce-te în StudyVerse pentru a-ți finaliza lecțiile începute sau a începe una nouă!',
      categoryIdentifier: 'study_reminder',
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3600,
      channelId: 'default',
    },
  });
  console.log('Snoozed study reminder scheduled for 1 hour later.');
}

export async function cancelSnoozedStudyReminder() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('snoozed_study_reminder');
}

// ── ACTIVE SESSION TIMER ──────────────────────────────────────

export async function scheduleActiveSessionTimer(remainingSeconds: number) {
  if (Platform.OS === 'web' || remainingSeconds <= 0) return;

  // Cancel any existing session notifications first
  await cancelActiveSessionNotifications();

  // Calculate exact target finish time
  const targetEnd = Date.now() + remainingSeconds * 1000;
  const endDate = new Date(targetEnd);
  const hours = String(endDate.getHours()).padStart(2, '0');
  const minutes = String(endDate.getMinutes()).padStart(2, '0');
  const endTimeStr = `${hours}:${minutes}`;

  // 1. Show IMMEDIATE status notification: "Sesiune activă în fundal"
  await Notifications.scheduleNotificationAsync({
    identifier: 'active_session_status',
    content: {
      title: 'Sesiune de studiu activă! ⏱️',
      body: `Se va finaliza la ora ${endTimeStr}. Rămâi concentrat, progresul tău contează!`,
      sound: false, // Silent status update
    },
    trigger: Platform.OS === 'android' ? { channelId: 'default' } as any : null,
  });

  // 2. Schedule completion notification when timer ends
  await Notifications.scheduleNotificationAsync({
    identifier: 'active_session_completion',
    content: {
      title: 'Sesiune finalizată! 🏆',
      body: 'Timpul s-a scurs! Întoarce-te în StudyVerse pentru a colecta cristalele și recompensele tale!',
      sound: true,
      data: { type: 'session_complete' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(targetEnd),
      channelId: 'default',
    },
  });

  console.log(`Background timer scheduled! Instant notification sent (finishing at ${endTimeStr}), completion notification scheduled in ${remainingSeconds}s.`);
}

export async function cancelActiveSessionNotifications() {
  if (Platform.OS === 'web') return;
  await Notifications.dismissNotificationAsync('active_session_status');
  await Notifications.cancelScheduledNotificationAsync('active_session_completion');
}

// ── UNFINISHED SESSION REMINDER ───────────────────────────────

export async function scheduleUnfinishedSessionReminder() {
  if (Platform.OS === 'web') return;

  await cancelUnfinishedSessionReminder();

  // Schedule notification for 15 minutes (900 seconds) later
  await Notifications.scheduleNotificationAsync({
    identifier: 'unfinished_session_reminder',
    content: {
      title: 'Sesiune nefinalizată! ⏳',
      body: 'Ai lăsat o sesiune activă nefinalizată. Întoarce-te să o închei pentru a nu pierde progresul!',
      sound: true,
      categoryIdentifier: 'study_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 900, // 15 mins
      channelId: 'default',
    },
  });
  console.log('Unfinished session reminder scheduled in 15 minutes.');
}

export async function cancelUnfinishedSessionReminder() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync('unfinished_session_reminder');
}

// ── CUSTOM DAILY STUDY REMINDER ───────────────────────────────

export async function scheduleCustomStudyReminder(hour: number, minute: number, id?: string) {
  if (Platform.OS === 'web') return;

  const identifier = id ? `custom_study_reminder_${id}` : 'custom_study_reminder';
  await cancelCustomStudyReminder(id);

  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'Timpul de studiu! ⏰',
      body: 'Este ora programată pentru sesiunea ta zilnică în StudyVerse. Să începem! 🚀',
      sound: true,
      categoryIdentifier: 'study_reminder',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: 'default',
    },
  });
  console.log(`Custom study reminder [${identifier}] scheduled at ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}!`);
}

export async function cancelCustomStudyReminder(id?: string) {
  if (Platform.OS === 'web') return;
  const identifier = id ? `custom_study_reminder_${id}` : 'custom_study_reminder';
  await Notifications.cancelScheduledNotificationAsync(identifier);
}
