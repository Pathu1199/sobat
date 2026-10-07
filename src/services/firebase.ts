import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApp, getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

/**
 * One Firebase app for sign-in and the per-account copy of the data. The
 * web keys are public by design; what protects the data is firestore.rules.
 */
export const ADMIN_EMAIL = 'shindeprathmesh999@gmail.com';

type FirebaseExtra = { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string };
const config = (Constants.expoConfig?.extra?.firebase ?? {}) as Partial<FirebaseExtra>;

export const firebaseEnabled = !!config.apiKey && !!config.projectId;

const app = firebaseEnabled ? (getApps().length ? getApp() : initializeApp(config as FirebaseExtra)) : null;

// On a phone the session has to be stored by hand; the browser keeps its own.
// The React Native persistence helper is only typed for the native entry, so
// it is read off the module rather than imported by name.
const rnPersistence = (firebaseAuth as unknown as { getReactNativePersistence?: (s: typeof AsyncStorage) => firebaseAuth.Persistence }).getReactNativePersistence;

export const auth = app
  ? Platform.OS === 'web' || !rnPersistence
    ? firebaseAuth.getAuth(app)
    : firebaseAuth.initializeAuth(app, { persistence: rnPersistence(AsyncStorage) })
  : null;

export const db = app ? getFirestore(app) : null;
