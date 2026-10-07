import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { PushSchedule } from '../core/pushSchedule';

/**
 * Background reminders for the web app: the browser's push subscription plus
 * the reminder schedule go to Fitoo's small relay, which sends what is due
 * while the app is closed. Only times, labels and the push address travel;
 * see core/pushSchedule.ts for exactly what.
 */

type PushConfig = { relayUrl?: string; vapidPublicKey?: string };
const CFG: PushConfig = (Constants.expoConfig?.extra as { push?: PushConfig } | undefined)?.push ?? {};

export function pushConfigured(): boolean {
  return Platform.OS === 'web' && !!CFG.relayUrl && !!CFG.vapidPublicKey && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushConfigured()) return null;
  try {
    await navigator.serviceWorker.register('/sw.js');
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** The browser's current push subscription, made if there is none. Null when refused or unsupported. */
export async function getSubscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await registration();
  if (!reg) return null;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  try {
    return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(CFG.vapidPublicKey!) as BufferSource });
  } catch {
    return null;
  }
}

async function post(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(`${CFG.relayUrl!.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send the current schedule for this phone. Returns false when the relay could not be reached. */
export async function syncSchedule(schedule: PushSchedule): Promise<boolean> {
  const sub = await getSubscription(true);
  if (!sub) return false;
  return post('/subscribe', { subscription: sub.toJSON(), schedule });
}

export async function stopPush(): Promise<void> {
  const sub = await getSubscription(false);
  if (!sub) return;
  await post('/unsubscribe', { endpoint: sub.endpoint });
  await sub.unsubscribe().catch(() => {});
}

/** Ask the relay to send one notification now, to prove the path works with the app closed. */
export async function testPush(lang: string): Promise<boolean> {
  const sub = await getSubscription(true);
  if (!sub) return false;
  return post('/test', { subscription: sub.toJSON(), schedule: { lang } });
}
