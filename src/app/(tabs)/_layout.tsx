import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, View } from 'react-native';
import { NudgeToast } from '../../components/NudgeToast';
import { TabBar } from '../../components/TabBar';
import { Sidebar } from '../../components/Sidebar';
import { useIsWide } from '../../ui/useBreakpoint';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { C, F, S } from '../../ui/theme';

export default function TabsLayout() {
  const { state, ready } = useApp();
  const wide = useIsWide();
  const router = useRouter();
  const t = makeT(state.profile.lang);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.accent} />
      </View>
    );
  }
  // On the web a first-time visitor gets the landing page; on a phone the app
  // is already installed, so go straight to setup.
  if (!state.profile.onboarded) return <Redirect href={Platform.OS === 'web' ? '/welcome' : '/onboarding'} />;

  const settingsButton = () => (
    <Pressable onPress={() => router.push('/settings')} style={{ paddingHorizontal: 12 }} accessibilityLabel={t('settings')}>
      <Ionicons name="settings-outline" size={20} color={C.textDim} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      {wide ? <Sidebar /> : null}
        <View style={{ flex: 1 }}>
        <Tabs
          tabBar={wide ? () => null : (props) => <TabBar {...props} />}
          screenOptions={{
        headerStyle: { backgroundColor: C.bgAlt },
        headerTintColor: C.text,
        headerRight: settingsButton,
        headerShown: !wide,
        headerTitleStyle: { fontWeight: '600', fontSize: F.h2, letterSpacing: -0.3 },
        headerShadowVisible: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.textFaint,
        sceneStyle: { backgroundColor: C.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: t('tab_today'), tabBarIcon: ({ color, size }) => <Ionicons name="today-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: t('tab_log'), tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="growth"
        options={{ title: t('growth'), tabBarIcon: ({ color, size }) => <Ionicons name="trending-up-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="fit"
        options={{ title: t('tab_fit'), tabBarIcon: ({ color, size }) => <Ionicons name="walk-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="mind"
        options={{ title: t('tab_mind'), tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="coach"
        options={{ title: t('tab_coach'), tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} /> }}
      />
    </Tabs>
    <NudgeToast />
      </View>
    </View>
  );
}
