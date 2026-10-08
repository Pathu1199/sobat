import AsyncStorage from '@react-native-async-storage/async-storage';
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

/** What the browser currently says; 'unsupported' where there is no Notification API at all. */
export function webPermission(): NotificationPermission | 'unsupported' {
  if (Platform.OS !== 'web' || typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/**
 * The service worker is what lets a pinned iPhone web app show notifications
 * at all; desktop browsers accept either route. Registered lazily, once.
 */
let swReady: Promise<ServiceWorkerRegistration | null> | null = null;
function serviceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return Promise.resolve(null);
  if (!swReady) {
    swReady = navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .catch(() => null);
  }
  return swReady;
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined') return false;
    void serviceWorker();
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
    name: 'Fitoo reminders',
    importance: n.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    sound: null,
  });
}

/** Fire right now. Used by the in-app nudge timer. */
/**
 * How often the app may speak up on its own. One gate for every reminder,
 * so water, breaks, the coach and the office day together never exceed it:
 * a minimum gap between two notifications, a daily cap, and quiet hours.
 * The person's own taps (test, "notifications on") pass with `force`.
 */
export type NotifyGate = { gapMinutes: number; maxPerDay: number; quietStartHour: number; quietEndHour: number };
let gate: NotifyGate = { gapMinutes: 60, maxPerDay: 8, quietStartHour: 22, quietEndHour: 7 };
let lastAt = 0;
let sentOn = '';
let sentCount = 0;
const GATE_KEY = 'sobat.notify.gate';

export function configureNotifyGate(g: Partial<NotifyGate>): void {
  gate = { ...gate, ...g };
}

async function loadGateState(): Promise<void> {
  if (lastAt) return;
  try {
    const raw = await AsyncStorage.getItem(GATE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { lastAt: number; sentOn: string; sentCount: number };
      lastAt = v.lastAt || 0;
      sentOn = v.sentOn || '';
      sentCount = v.sentCount || 0;
    }
  } catch {
    // A missing record means nothing was sent yet.
  }
}

function inQuiet(hour: number): boolean {
  const { quietStartHour: a, quietEndHour: b } = gate;
  if (a === b) return false;
  return a > b ? hour >= a || hour < b : hour >= a && hour < b;
}

/** True if a reminder may go out now; records it if so. */
export async function mayNotify(opts?: { force?: boolean; priority?: 'high' | 'normal' }): Promise<boolean> {
  if (opts?.force) return true;
  await loadGateState();
  const now = new Date();
  if (inQuiet(now.getHours())) return false;
  const today = now.toISOString().slice(0, 10);
  if (sentOn !== today) {
    sentOn = today;
    sentCount = 0;
  }
  if (sentCount >= gate.maxPerDay) return false;
  const gapMs = (opts?.priority === 'high' ? gate.gapMinutes / 2 : gate.gapMinutes) * 60000;
  if (Date.now() - lastAt < gapMs) return false;
  lastAt = Date.now();
  sentCount += 1;
  AsyncStorage.setItem(GATE_KEY, JSON.stringify({ lastAt, sentOn, sentCount })).catch(() => {});
  return true;
}

export async function notifyNow(title: string, body: string, opts?: { force?: boolean; priority?: 'high' | 'normal' }): Promise<boolean> {
  if (!(await mayNotify(opts))) return false;
  await deliver(title, body);
  return true;
}

async function deliver(title: string, body: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = await serviceWorker();
    if (reg) {
      // iOS shows notifications only this way; it also works everywhere else.
      await reg.showNotification(title, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: `sobat-${Date.now()}` });
      return;
    }
    try {
      new Notification(title, { body, icon: '/icon-192.png' });
    } catch {
      // Some browsers have the API but refuse the constructor; nothing else to do.
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
