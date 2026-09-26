import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { BreakOverlay } from '../components/BreakOverlay';
import { FeedbackProvider } from '../services/feedback';
import { usePhotoQueue } from '../services/usePhotoQueue';
import { useScheduledReminders } from '../services/useScheduledReminders';
import { useSteps } from '../services/useSteps';
import { useUsageTracker } from '../services/useUsageTracker';
import { AppProvider } from '../store/AppProvider';
import { C } from '../ui/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <FeedbackProvider>
        <AppShell />
      </FeedbackProvider>
    </AppProvider>
  );
}

/** Inside the provider, so the trackers can reach the store. */
function AppShell() {
  useUsageTracker();
  useScheduledReminders();
  useSteps();
  usePhotoQueue();
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
            headerStyle: { backgroundColor: C.bgAlt },
            headerTintColor: C.text,
            headerTitleStyle: { fontWeight: '600' },
            contentStyle: { backgroundColor: C.bg },
          }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        <Stack.Screen name="photo" options={{ title: 'Photo' }} />
        <Stack.Screen name="sleep" options={{ title: 'Sleep' }} />
        <Stack.Screen name="memory" options={{ title: 'Memory' }} />
        <Stack.Screen name="session" options={{ title: 'Session' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan' }} />
        <Stack.Screen name="permissions" options={{ headerShown: false }} />
      </Stack>
      <BreakOverlay />
    </View>
  );
}
