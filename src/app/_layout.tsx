import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { BreakOverlay } from '../components/BreakOverlay';
import { BreakToast } from '../components/BreakToast';
import { FeedbackProvider } from '../services/feedback';
import { enableAutostart } from '../services/platform';
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
            <AppShell />
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
  const [applied, setApplied] = useState<string>(`${themeMode()}-1`);
  useLayoutEffect(() => {
    applyTheme(mode);
    applyTextScale(scale);
    // Deliberate: the remount must follow the palette swap, and nothing else re-renders this subtree.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApplied(`${mode}-${scale}`);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.background = C.bg;
      document.body.style.background = C.bg;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', C.bg);
    }
  }, [mode, scale]);
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

  // The break monitor is only useful if it is running, so the Windows shell
  // registers itself to start with the machine. Idempotent, and a no-op in a
  // browser or on a phone, where there is nothing to register with.
  useEffect(() => {
    enableAutostart().catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={C.bg === '#F4F5F9' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
            headerStyle: { backgroundColor: C.bgAlt },
            headerTintColor: C.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: C.bg },
          }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="log" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="photo" options={{ title: 'Photo' }} />
        <Stack.Screen name="sleep" options={{ title: 'Sleep' }} />
        <Stack.Screen name="memory" options={{ title: 'Memory' }} />
        <Stack.Screen name="routine" options={{ title: 'My routine' }} />
        <Stack.Screen name="guide" options={{ title: 'Guide' }} />
        <Stack.Screen name="tour" options={{ headerShown: false }} />
        <Stack.Screen name="foods" options={{ title: 'Foods' }} />
        <Stack.Screen name="recipes" options={{ title: 'Recipes' }} />
        <Stack.Screen name="session" options={{ title: 'Session' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan' }} />
        <Stack.Screen name="permissions" options={{ headerShown: false }} />
      </Stack>
      <BreakOverlay />
      <BreakToast />
    </View>
  );
}
