import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { bannerState, isAppleMobile, type BannerKind, type NotificationState } from '../core/remindersBanner';
import { makeT } from '../i18n';
import { notificationState, requestPermission, setupAndroidChannel, webPermission } from '../services/notify';
import { pushConfigured } from '../services/push';
import { useApp } from '../store/AppProvider';
import { Card } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { C, F, lh, S } from '../ui/theme';

/** The web app was opened from the Home Screen: Safari's own flag, or the display mode every other browser reports. */
function standalone(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);
}

function appleMobile(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return isAppleMobile(navigator.userAgent, navigator.platform, navigator.maxTouchPoints ?? 0);
}

const WORDS: Record<BannerKind, string> = { install: 'rem_banner_install', enable: 'rem_banner_enable', blocked: 'rem_banner_blocked' };
/** The Guide's section each line opens (data/guide.ts); "Turn on reminders" asks instead. */
const GUIDE_LINK = { install: '/guide?s=homescreen', blocked: '/guide?s=notifications' } as const;

/**
 * The one line at the top of Today that gets reminders to this device, while
 * they cannot reach it (core/remindersBanner.ts says when): "Turn on
 * reminders" asks for permission right inside the tap, as an iPhone requires,
 * and on the web then switches on reminders while the app is closed; the
 * other lines open the Guide's steps. Its ✕ puts it away on this device until
 * tomorrow. What the device allows is read again whenever the app comes back
 * to the front, so a permission given in the phone's settings changes the
 * line or takes it away.
 */
export function RemindersBanner() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const s = app.state.settings;
  // The browser says at once; the phone says after a moment, and nothing shows until it has.
  const [permission, setPermission] = useState<NotificationState>(() => (Platform.OS === 'web' ? webPermission() : 'unsupported'));

  useEffect(() => {
    let live = true;
    const read = () => {
      void notificationState().then((p) => {
        if (live) setPermission(p);
      });
    };
    read();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') read();
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const kind = bannerState({
    platform: Platform.OS,
    appleMobile: appleMobile(),
    standalone: standalone(),
    permission,
    pushConfigured: pushConfigured(),
    pushRelay: s.pushRelay,
    reminders: s.reminders,
    today: app.today,
    hiddenOn: s.remindersBannerHiddenOn,
  });
  if (!kind) return null;

  const enable = () => {
    // Asked inside the tap, before anything is awaited: an iPhone shows the question only then. Android 13 shows it only once a
    // channel exists; a channel that could not be made still leaves the question to ask.
    const asked = Platform.OS === 'android' ? setupAndroidChannel().catch(() => undefined).then(() => requestPermission()) : requestPermission();
    void asked
      .catch(() => false)
      .then(async (ok) => {
        if (ok && Platform.OS === 'web') app.setSettings({ pushRelay: true });
        // A refusal turns the line to "blocked", which opens the Guide's steps.
        setPermission(await notificationState());
      });
  };

  const words = t(WORDS[kind]);
  return (
    <Card style={{ paddingVertical: 0, paddingLeft: 14, paddingRight: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* A finger tall on every platform: the web adds no reach around a control, so the box itself is the size. */}
        <Pressable
          onPress={kind === 'enable' ? enable : () => router.push(GUIDE_LINK[kind])}
          accessibilityRole="button"
          accessibilityLabel={words}
          accessibilityHint={t(kind === 'enable' ? 'rem_banner_hint_enable' : 'rem_banner_hint_guide')}
          style={({ pressed }) => ({ flex: 1, minHeight: S.touch, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name={kind === 'blocked' ? 'notifications-off-outline' : 'notifications-outline'} size={20} color={kind === 'blocked' ? C.amber : C.accentText} />
          <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{words}</Text>
        </Pressable>
        <IconButton name="close" label={t('rem_banner_hide')} onPress={() => app.setSettings({ remindersBannerHiddenOn: app.today })} />
      </View>
    </Card>
  );
}
