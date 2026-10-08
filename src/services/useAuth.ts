import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { ADMIN_EMAIL, auth, firebaseEnabled } from './firebase';

export type AuthUser = { uid: string; email: string; name: string };
type Snapshot = { ready: boolean; user: AuthUser | null };

const listeners = new Set<() => void>();
let current: Snapshot = { ready: !firebaseEnabled, user: null };

function toUser(u: User | null): AuthUser | null {
  return u ? { uid: u.uid, email: u.email ?? '', name: u.displayName ?? '' } : null;
}

if (auth) {
  onAuthStateChanged(auth, (u) => {
    current = { ready: true, user: toUser(u) };
    listeners.forEach((l) => l());
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getSnapshot = (): Snapshot => current;

/**
 * Who is signed in, and whether Firebase has said yet. One subscription
 * shared by every caller, read through useSyncExternalStore so a change
 * that lands between the first render and the subscription is not lost.
 */
export function useAuth() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const isAdmin = snap.user?.email?.toLowerCase() === ADMIN_EMAIL;
  // The local AI (Ollama on the admin's own PC) is the admin's: only they see
  // whether it is up, set its address, and ask it questions.
  return { ...snap, isAdmin, canUseAI: isAdmin || !firebaseEnabled };
}

function need() {
  if (!auth) throw new Error('auth_off');
  return auth;
}

export const authApi = {
  signIn: (email: string, password: string) => signInWithEmailAndPassword(need(), email.trim(), password),
  signUp: async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(need(), email.trim(), password);
    if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
    return cred;
  },
  google: () => signInWithPopup(need(), new GoogleAuthProvider()),
  googleAvailable: Platform.OS === 'web',
  reset: (email: string) => sendPasswordResetEmail(need(), email.trim()),
  signOut: () => fbSignOut(need()),
};

/** Firebase error codes to our i18n keys; anything unknown gets the generic one. */
export function authErrorKey(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('invalid-email')) return 'auth_err_email';
  if (code.includes('weak-password')) return 'auth_err_weak';
  if (code.includes('email-already-in-use')) return 'auth_err_exists';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'auth_err_wrong';
  if (code.includes('too-many-requests')) return 'auth_err_many';
  if (code.includes('network')) return 'auth_err_network';
  return 'auth_err_generic';
}
