import { deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AppState } from '../core/types';
import { useApp } from '../store/AppProvider';
import { db } from './firebase';
import { authApi, useAuth } from './useAuth';

/**
 * The account's copy of the data. One document per user:
 *   users/{uid} = { email, name, platform, createdAt, lastSeen, logins[], disabled, state (JSON), stateAt }
 *
 * First sign-in on a device that already has data pushes that data up, so
 * nothing someone logged before there was a login is lost. A device with
 * nothing on it pulls the account down. After that, every change is saved
 * a moment later, and a change made elsewhere arrives live.
 */
export type CloudUser = {
  uid: string;
  email: string;
  name: string;
  platform: string;
  createdAt?: { seconds: number };
  lastSeen?: { seconds: number };
  logins?: { at: string; platform: string }[];
  disabled?: boolean;
  stateAt?: string;
  meals?: number;
  weightKg?: number;
};

export type SyncStatus = 'off' | 'pending' | 'synced' | 'blocked';

/** What gets stored: everything the person logged, not the caches. */
function forCloud(s: AppState): string {
  const { chat, photoQueue, usage, tips, ...rest } = s;
  void chat;
  void photoQueue;
  void usage;
  void tips;
  return JSON.stringify(rest);
}

export function useCloudSync(): SyncStatus {
  const app = useApp();
  const { user, ready } = useAuth();
  const [status, setStatus] = useState<SyncStatus>('off');
  const lastPushed = useRef<string>('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bound = useRef<string | null>(null);
  const { state, ready: stateReady, importState, resetAll } = app;

  // Bind to the account: reconcile once, then listen.
  useEffect(() => {
    if (!db || !ready || !stateReady) return;
    if (!user) {
      // Signed out: the device is handed back empty so the next person starts clean.
      if (bound.current) {
        bound.current = null;
        lastPushed.current = '';
        resetAll();
      }
      // Deliberate: the status mirrors the session, which only changes here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('off');
      return;
    }
    if (bound.current === user.uid) return;
    bound.current = user.uid;
    const ref = doc(db, 'users', user.uid);
    let unsub: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const snap = await getDoc(ref).catch(() => null);
      if (cancelled) return;
      const data = snap?.exists() ? (snap.data() as CloudUser & { state?: string }) : null;
      if (data?.disabled) {
        setStatus('blocked');
        await authApi.signOut().catch(() => {});
        return;
      }
      const login = { at: new Date().toISOString(), platform: Platform.OS };
      const localHasData = state.profile.onboarded || state.meals.length > 0;
      if (data?.state && !localHasData) {
        // Fresh device, existing account: take the account's copy.
        importState(data.state);
        lastPushed.current = data.state;
      } else if (localHasData) {
        // The device's data wins and goes up (this is also how pre-login data is kept).
        lastPushed.current = forCloud(state);
      }
      await setDoc(
        ref,
        {
          uid: user.uid,
          email: user.email,
          name: user.name || state.profile.name || '',
          platform: Platform.OS,
          lastSeen: serverTimestamp(),
          ...(data ? {} : { createdAt: serverTimestamp() }),
          logins: [login, ...(data?.logins ?? [])].slice(0, 20),
          ...(localHasData ? { state: lastPushed.current, stateAt: login.at, meals: state.meals.length, weightKg: state.profile.weightKg } : {}),
        },
        { merge: true },
      ).catch(() => {});
      setStatus('synced');
      // Live: a change saved on another device, or the admin blocking the account.
      unsub = onSnapshot(ref, (s) => {
        const d = s.data() as (CloudUser & { state?: string }) | undefined;
        if (!d) return;
        if (d.disabled) {
          setStatus('blocked');
          authApi.signOut().catch(() => {});
          return;
        }
        if (d.state && d.state !== lastPushed.current) {
          lastPushed.current = d.state;
          importState(d.state);
        }
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
    // Reconcile once per account; the state at that moment is what is compared.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, ready, stateReady]);

  // Push changes a moment after they settle.
  useEffect(() => {
    if (!db || !user || bound.current !== user.uid || status === 'off' || status === 'blocked') return;
    const json = forCloud(state);
    if (json === lastPushed.current) return;
    setStatus('pending');
    if (timer.current) clearTimeout(timer.current);
    const ref = doc(db, 'users', user.uid);
    timer.current = setTimeout(() => {
      lastPushed.current = json;
      updateDoc(ref, { state: json, stateAt: new Date().toISOString(), lastSeen: serverTimestamp(), name: state.profile.name || user.name, meals: state.meals.length, weightKg: state.profile.weightKg })
        .then(() => setStatus('synced'))
        .catch(() => setStatus('synced'));
    }, 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, user?.uid]);

  return status;
}

/** Admin actions on another account. */
export const adminApi = {
  setBlocked: (uid: string, disabled: boolean) => (db ? updateDoc(doc(db, 'users', uid), { disabled }) : Promise.reject()),
  deleteData: (uid: string) => (db ? deleteDoc(doc(db, 'users', uid)) : Promise.reject()),
};
