import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { NudgeToast } from '../../components/NudgeToast';
import { TabBar } from '../../components/TabBar';
import { Sidebar } from '../../components/Sidebar';
import { useIsWide } from '../../ui/useBreakpoint';
import { makeT } from '../../i18n';
import { firebaseEnabled } from '../../services/firebase';
import { useAuth } from '../../services/useAuth';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { Skeleton } from '../../ui/tiles';

export default function TabsLayout() {
  const { state, ready: stateReady } = useApp();
  const auth = useAuth();
  const ready = stateReady && auth.ready;
  const wide = useIsWide();
  const t = makeT(state.profile.lang);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 16, gap: 12, paddingTop: 72 }}>
        <Skeleton height={28} width="60%" />
        <Skeleton height={190} />
        <Skeleton height={120} />
        <Skeleton height={96} />
      </View>
    );
  }
  // On the web a first-time visitor gets the landing page; on a phone the app
  // is already installed, so go straight to setup.
  // Not signed in: the landing page and nothing else, on every platform.
  if (firebaseEnabled && !auth.user) return <Redirect href="/welcome" />;
  if (!state.profile.onboarded) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      {wide ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <Tabs
          tabBar={wide ? () => null : (props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: C.bg },
            tabBarActiveTintColor: C.accent,
            tabBarInactiveTintColor: C.textFaint,
          }}>
          <Tabs.Screen name="index" options={{ title: t('tab_today'), tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="food" options={{ title: t('tab_food'), tabBarIcon: ({ color, size }) => <Ionicons name="restaurant-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="body" options={{ title: t('tab_body'), tabBarIcon: ({ color, size }) => <Ionicons name="body-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="progress" options={{ title: t('tab_progress'), tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }} />
          {/* Old addresses keep working; they are not in the bar. */}
          <Tabs.Screen name="growth" options={{ href: null }} />
          <Tabs.Screen name="fit" options={{ href: null }} />
          <Tabs.Screen name="mind" options={{ href: null }} />
          <Tabs.Screen name="coach" options={{ href: null }} />
          <Tabs.Screen name="log" options={{ title: t('tab_log'), href: null }} />
        </Tabs>
        <NudgeToast />
      </View>
    </View>
  );
}
