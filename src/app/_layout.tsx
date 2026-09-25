import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';
import { AppProvider } from '../store/AppProvider';
import { C } from '../ui/theme';

export default function RootLayout() {
  return (
    <AppProvider>
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
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="photo" options={{ title: 'Photo' }} />
          <Stack.Screen name="sleep" options={{ title: 'Sleep' }} />
        </Stack>
      </View>
    </AppProvider>
  );
}
