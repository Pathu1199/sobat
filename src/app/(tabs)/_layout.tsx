import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { NudgeToast } from '../../components/NudgeToast';
import { TabBar } from '../../components/TabBar';
import { Sidebar } from '../../components/Sidebar';
import { useIsWide } from '../../ui/useBreakpoint';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';
import { Skeleton } from '../../ui/tiles';

export default function TabsLayout() {
  const { state, ready } = useApp();
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
  if (!state.profile.onboarded) return <Redirect href={Platform.OS === 'web' ? '/welcome' : '/onboarding'} />;

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
          <Tabs.Screen name="growth" options={{ title: t('growth'), tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="fit" options={{ title: t('tab_fit'), tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="mind" options={{ title: t('tab_mind'), tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }} />
          <Tabs.Screen name="coach" options={{ title: t('tab_coach'), href: null }} />
        </Tabs>
        <NudgeToast />
      </View>
    </View>
  );
}
