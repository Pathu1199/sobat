import { Redirect, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { BreakOverlay } from '../components/BreakOverlay';
import { BreakToast } from '../components/BreakToast';
import { makeT } from '../i18n';
import { FeedbackProvider } from '../services/feedback';
import { firebaseEnabled } from '../services/firebase';
import { configureNotifyGate } from '../services/notify';
import { enableAutostart } from '../services/platform';
import { AIProvider } from '../services/useAI';
import { useAuth } from '../services/useAuth';
import { CloudSyncProvider } from '../services/useCloudSync';
import { useCoachMonitor } from '../services/useCoachMonitor';
import { BreakMonitorProvider } from '../services/useBreakMonitor';
import { usePhotoQueue } from '../services/usePhotoQueue';
import { useScheduledReminders } from '../services/useScheduledReminders';
import { useSteps } from '../services/useSteps';
import { useUsageTracker } from '../services/useUsageTracker';
import { usePushSync } from '../services/usePushSync';
import { useWorkSchedule } from '../services/useWorkSchedule';
import { AppProvider, useApp } from '../store/AppProvider';
import { applyTextScale, applyTheme, C, themeMode, type ThemeMode } from '../ui/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <Themed>
        <FeedbackProvider>
          <BreakMonitorProvider>
            <AIProvider>
              <CloudSyncProvider>
                <AppShell />
              </CloudSyncProvider>
            </AIProvider>
          </BreakMonitorProvider>
        </FeedbackProvider>
      </Themed>
    </AppProvider>
  );
}

/** Picks dark or light from the setting and the phone, applies it before the tree renders, and remounts on change. */
function Themed({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  const system = useColorScheme();
  const mode: ThemeMode = state.settings.appearance === 'system' ? (system === 'light' ? 'light' : 'dark') : state.settings.appearance;
  // Swap the palette before paint, then remount the tree so every component reads the new colours.
  const scale = state.settings.textScale || 1;
  const lang = state.profile.lang;
  const [applied, setApplied] = useState<string>(`${themeMode()}-1`);
  useLayoutEffect(() => {
    applyTheme(mode);
    applyTextScale(scale);
    // Deliberate: the remount must follow the palette swap, and nothing else re-renders this subtree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(`${mode}-${scale}`);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.background = C.bg;
      document.documentElement.style.colorScheme = mode;
      document.body.style.background = C.bg;
      // Both theme-color tags (light and dark) take the chosen look, so the setting beats the phone's when they differ.
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', C.bg));
    } else {
      // The root view behind the app, seen in screen transitions and behind the keyboard, takes the same colour.
      SystemUI.setBackgroundColorAsync(C.bg).catch(() => {});
    }
  }, [mode, scale]);
  // The page's language follows the profile, so screen readers and the browser read Marathi and Hindi as such.
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);
  return <View key={applied} style={{ flex: 1, backgroundColor: C.bg }}>{children}</View>;
}

/** Inside the provider, so the trackers can reach the store. */
function AppShell() {
  useUsageTracker();
  useScheduledReminders();
  useSteps();
  usePhotoQueue();
  useWorkSchedule();
  usePushSync();
  useCoachMonitor();
  const { user, ready: authReady } = useAuth();
  const { notifyGapMinutes, quietStartHour, quietEndHour } = useApp().state.settings;
  useEffect(() => {
    configureNotifyGate({ gapMinutes: notifyGapMinutes || 60, quietStartHour, quietEndHour });
  }, [notifyGapMinutes, quietStartHour, quietEndHour]);
  const segments = useSegments() as string[];
  const { ready: stateReady, state: appState } = useApp();
  const t = makeT(appState.profile.lang);

  // The break monitor is only useful if it is running, so the Windows shell
  // registers itself to start with the machine. Idempotent, and a no-op in a
  // browser or on a phone, where there is nothing to register with.
  useEffect(() => {
    enableAutostart().catch(() => {});
  }, []);

  // Everything past the front door belongs to an account. The welcome page
  // and the login are the door; anywhere else without a session goes to it.
  const open = segments[0] === 'login' || segments[0] === 'welcome';
  if (firebaseEnabled && stateReady && authReady && !user && !open) {
    return <Redirect href="/welcome" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Dark icons on a light page, light icons on a dark one. AppShell remounts with the theme, so this is read fresh. */}
      <StatusBar style={themeMode() === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
            headerStyle: { backgroundColor: C.bgAlt },
            headerTintColor: C.text,
            headerTitleStyle: { fontWeight: '500' },
            contentStyle: { backgroundColor: C.bg },
          }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ title: t('hdr_admin') }} />
        <Stack.Screen name="journey" options={{ title: t('hdr_journey') }} />
        <Stack.Screen name="history" options={{ title: t('hdr_history') }} />
        <Stack.Screen name="plan" options={{ title: t('hdr_plan') }} />
        <Stack.Screen name="settings" options={{ title: t('hdr_settings') }} />
        <Stack.Screen name="photo" options={{ title: t('hdr_photo') }} />
        <Stack.Screen name="sleep" options={{ title: t('hdr_sleep') }} />
        <Stack.Screen name="memory" options={{ title: t('hdr_memory') }} />
        <Stack.Screen name="routine" options={{ title: t('pattern_title') }} />
        <Stack.Screen name="guide" options={{ title: t('hdr_guide') }} />
        <Stack.Screen name="tour" options={{ headerShown: false }} />
        <Stack.Screen name="foods" options={{ title: t('hdr_foods') }} />
        <Stack.Screen name="recipes" options={{ title: t('hdr_recipes') }} />
        <Stack.Screen name="session" options={{ title: t('hdr_session') }} />
        <Stack.Screen name="scan" options={{ title: t('hdr_scan') }} />
        <Stack.Screen name="permissions" options={{ headerShown: false }} />
      </Stack>
      <BreakOverlay />
      <BreakToast />
    </View>
  );
}
