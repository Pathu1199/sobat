import { Platform } from 'react-native';

/**
 * Notifications differ per platform, so everything else in the app talks to
 * this module instead of to expo-notifications directly.
 * Native uses scheduled OS notifications. Web uses the browser Notification
 * API while the tab is open, since expo-notifications has no web support.
 */

type NativeModule = typeof import('expo-notifications');
let native: NativeModule | null = null;

function loadNative(): NativeModule | null {
  if (Platform.OS === 'web') return null;
  if (native) return native;
  try {
    // Loaded here, not at the top: the web bundle has no expo-notifications,
    // and a static import would be evaluated before the Platform check above.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    native = require('expo-notifications') as NativeModule;
    native.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return native;
  } catch {
    return null;
  }
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }
  const n = loadNative();
  if (!n) return false;
  const current = await n.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await n.requestPermissionsAsync();
  return asked.granted;
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const n = loadNative();
  if (!n) return;
  await n.setNotificationChannelAsync('sobat', {
    name: 'Sobat reminders',
    importance: n.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    sound: null,
  });
}

/** Fire right now. Used by the in-app nudge timer. */
export async function notifyNow(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }
  const n = loadNative();
  if (!n) return;
  await n.scheduleNotificationAsync({ content: { title, body }, trigger: null });
}

/** A daily reminder at a fixed clock time, e.g. the morning sleep check-in. */
export async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await cancel(id);
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'sobat' },
  });
}

export async function scheduleRepeating(id: string, seconds: number, title: string, body: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await cancel(id);
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: n.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(60, seconds), repeats: true, channelId: 'sobat' },
  });
}

export async function cancel(id: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  try {
    await n.cancelScheduledNotificationAsync(id);
  } catch {
    // Nothing scheduled under that id.
  }
}

export async function cancelAll(): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.cancelAllScheduledNotificationsAsync();
}
