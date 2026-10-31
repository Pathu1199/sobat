import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { gateStep, type GateState, type NotifyGate } from '../core/nudge';
import { tapKey } from '../core/reminders';
import type { NotificationState } from '../core/remindersBanner';

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
 * Whether this device may show notifications: 'default' while it was never
 * asked or may still ask, 'denied' once only the phone's or the browser's own
 * settings can allow them, 'unsupported' where there is no way at all.
 */
export async function notificationState(): Promise<NotificationState> {
  if (Platform.OS === 'web') return webPermission();
  const n = loadNative();
  if (!n) return 'unsupported';
  try {
    const p = await n.getPermissionsAsync();
    return p.granted ? 'granted' : p.canAskAgain ? 'default' : 'denied';
  } catch {
    return 'unsupported';
  }
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
    name: 'Dhyey reminders',
    importance: n.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    sound: null,
  });
}

/**
 * How often the app may speak up on its own: one gate for every reminder
 * (core/nudge.ts `gateStep`), so water, breaks, the coach and the office day
 * together never exceed it. The person's own taps (test, "notifications on")
 * pass with `force`.
 */
export type { NotifyGate } from '../core/nudge';
let gate: NotifyGate = { gapMinutes: 60, maxPerDay: 8, quietStartHour: 22, quietEndHour: 7 };
let held: GateState = { lastAt: 0, sentOn: '', sentCount: 0 };
let loading: Promise<void> | null = null;
const GATE_KEY = 'sobat.notify.gate';

export function configureNotifyGate(g: Partial<NotifyGate>): void {
  gate = { ...gate, ...g };
}

/** Reads what the gate remembers once, shared by every caller, so two reminders at once never read it half loaded. */
function loadGateState(): Promise<void> {
  if (!loading) {
    loading = AsyncStorage.getItem(GATE_KEY)
      .then((raw) => {
        if (!raw) return;
        const v = JSON.parse(raw) as Partial<GateState>;
        held = { lastAt: v.lastAt || 0, sentOn: v.sentOn || '', sentCount: v.sentCount || 0 };
      })
      .catch(() => {
        // A missing or damaged record means nothing was sent yet.
      });
  }
  return loading;
}

/** True if a reminder may go out now; records it if so. */
export async function mayNotify(opts?: { force?: boolean; priority?: 'high' | 'normal' }): Promise<boolean> {
  if (opts?.force) return true;
  await loadGateState();
  const next = gateStep(gate, held, new Date(), opts?.priority);
  if (!next) return false;
  held = next;
  AsyncStorage.setItem(GATE_KEY, JSON.stringify(held)).catch(() => {});
  return true;
}

/** Fire right now, through the gate: used by the in-app timers. */
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

/** A daily reminder at a fixed clock time, e.g. the morning sleep check-in. `data` rides along for a tap. */
export async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string, data?: Record<string, string>): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await cancel(id);
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, ...(data ? { data } : {}) },
    trigger: { type: n.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'sobat' },
  });
}

/**
 * A reminder every week on one weekday at a clock time: one office block on
 * one working day, so a day switched off stays quiet. `weekday` is 1 for
 * Sunday to 7 for Saturday, as expo-notifications counts them.
 */
export async function scheduleWeekly(id: string, weekday: number, hour: number, minute: number, title: string, body: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await cancel(id);
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: n.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId: 'sobat' },
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

/** A one-off reminder at a clock time on a date. Fires with the app closed. `data` rides along for a tap; `category` adds the buttons registered under it. */
export async function scheduleAt(id: string, at: Date, title: string, body: string, extra?: { data?: Record<string, string>; category?: string }): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.scheduleNotificationAsync({
    identifier: id,
    content: { title, body, ...(extra?.data ? { data: extra.data } : {}), ...(extra?.category ? { categoryIdentifier: extra.category } : {}) },
    trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'sobat' },
  });
}

/**
 * Identifiers of everything the OS still holds for this app; empty on the web.
 * A failed read rejects rather than answering "nothing": a run that took it
 * for an empty phone would cancel nothing stale and still count its lists as
 * registered (`syncReminders`).
 */
export async function scheduledIds(): Promise<string[]> {
  const n = loadNative();
  if (!n) return [];
  const all = await n.getAllScheduledNotificationsAsync();
  return all.map((r) => r.identifier);
}

/** Cancels a pending notification and never fails: before a reminder is registered again under its own id, where nothing held is fine. */
async function cancel(id: string): Promise<void> {
  try {
    await cancelHeld(id);
  } catch {
    // Nothing scheduled under that id.
  }
}

/** Cancels a pending notification the phone holds, and lets a refusal through, so the caller can try again on its next run. */
export async function cancelHeld(id: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.cancelScheduledNotificationAsync(id);
}

export async function cancelAll(): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.cancelAllScheduledNotificationsAsync();
}

/** The meal-time prompt's buttons. The docs: no ':' or '-' in a category id. */
export const MEAL_CATEGORY = 'sobatmeal';
/** "Ate as planned". A tap on the notification itself arrives as expo-notifications' DEFAULT_ACTION_IDENTIFIER. */
export const ATE_ACTION = 'ate';

/**
 * Registers "Ate as planned" in the person's language. It opens the app,
 * which logs the meal (useNotificationResponses): with the app killed, a
 * button that leaves it closed reaches no listener on either platform
 * without a background task, and a tap that logged nothing would break the
 * calorie record.
 */
export async function setMealCategory(buttonTitle: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  await n.setNotificationCategoryAsync(MEAL_CATEGORY, [{ identifier: ATE_ACTION, buttonTitle, options: { opensAppToForeground: true } }]);
}

/**
 * A tap on a notification: on its body ('open') or on "Ate as planned"
 * ('ate'), with the notification's id and data. `key` names this one tap on
 * this one delivery, so the same tap read twice (at start and from the
 * listener) is acted on once, while a reminder that comes back every day is
 * a new tap each day.
 */
export type TapResponse = { id: string; action: 'open' | 'ate'; data: Record<string, unknown>; key: string };
type NativeResponse = Parameters<Parameters<NativeModule['addNotificationResponseReceivedListener']>[0]>[0];

function toTap(r: NativeResponse): TapResponse {
  const id = r.notification.request.identifier;
  const action = r.actionIdentifier === ATE_ACTION ? 'ate' : 'open';
  return { id, action, data: r.notification.request.content.data ?? {}, key: tapKey(id, action, r.notification.date) };
}

/** Calls back on every tap while the app runs; returns the way to stop listening. Nothing on the web. */
export function onTap(cb: (r: TapResponse) => void): () => void {
  const n = loadNative();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => cb(toTap(r)));
  return () => sub.remove();
}

/** The tap that opened the app, if one did and it has not been cleared. */
export function lastTap(): TapResponse | null {
  const n = loadNative();
  if (!n) return null;
  try {
    const r = n.getLastNotificationResponse();
    return r ? toTap(r) : null;
  } catch {
    return null;
  }
}

/** Forgets the last tap once it has been acted on, so a remount does not act on it again. */
export function clearLastTap(): void {
  const n = loadNative();
  if (!n) return;
  try {
    n.clearLastNotificationResponse();
  } catch {
    // Nothing to clear.
  }
}

/** Takes every notification the app shows off the tray: a device signed out or reset keeps none that a later person could tap. */
export async function dismissAll(): Promise<void> {
  const n = loadNative();
  if (!n) return;
  try {
    await n.dismissAllNotificationsAsync();
  } catch {
    // Nothing on the tray.
  }
}

/** Takes a notification off the tray once its button has done its work. */
export async function dismiss(id: string): Promise<void> {
  const n = loadNative();
  if (!n) return;
  try {
    await n.dismissNotificationAsync(id);
  } catch {
    // Already gone.
  }
}
