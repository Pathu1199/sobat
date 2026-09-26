import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { requestPermission, setupAndroidChannel } from '../services/notify';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, H1, Micro, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

type State = 'idle' | 'granted' | 'denied';

/**
 * Shown once, right after setup. Each permission says what it is for in one
 * line, and the app works without any of them.
 */
export default function PermissionsScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const en = makeT('en');

  const [notif, setNotif] = useState<State>('idle');
  const [camera, setCamera] = useState<State>('idle');

  async function askNotifications() {
    const ok = await requestPermission();
    if (ok) await setupAndroidChannel();
    setNotif(ok ? 'granted' : 'denied');
  }

  async function askCamera() {
    try {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setCamera(cam.granted || lib.granted ? 'granted' : 'denied');
    } catch {
      setCamera('denied');
    }
  }

  return (
    <Screen>
      <View style={{ paddingTop: 32, gap: 7 }}>
        <H1>{t('permissions_title')}</H1>
        <Micro>{t('permissions_sub')}</Micro>
      </View>

      <PermissionRow
        icon="notifications-outline"
        title={t('perm_notifications')}
        why={t('perm_notifications_why')}
        state={notif}
        onAsk={askNotifications}
        t={t}
      />

      <PermissionRow
        icon="camera-outline"
        title={t('perm_camera')}
        why={t('perm_camera_why')}
        state={camera}
        onAsk={askCamera}
        t={t}
        // On the web the browser asks at the moment of use, so there is nothing to pre-ask.
        deferred={Platform.OS === 'web'}
      />

      <Card>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="footsteps-outline" size={20} color={C.textFaint} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{t('perm_motion')}</Text>
            <Small>{t('perm_motion_why')}</Small>
            <Micro>{t('perm_asked_when_used')}</Micro>
          </View>
        </Row>
      </Card>

      <Card tone={C.accentDim}>
        <Row style={{ gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="lock-closed-outline" size={20} color={C.accent} />
          <View style={{ flex: 1 }}>
            <Small>{t('w_privacy_b')}</Small>
          </View>
        </Row>
      </Card>

      <Btn label={t('perm_continue')} onPress={() => router.replace('/')} />
      <Btn tone="ghost" label={t('perm_later')} onPress={() => router.replace('/')} />
    </Screen>
  );
}

function PermissionRow({
  icon,
  title,
  why,
  state,
  onAsk,
  t,
  deferred,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  why: string;
  state: State;
  onAsk: () => void;
  t: (k: string) => string;
  deferred?: boolean;
}) {
  const color = state === 'granted' ? C.accent : state === 'denied' ? C.amber : C.textFaint;
  return (
    <Card>
      <Row style={{ gap: 10, alignItems: 'flex-start' }}>
        <Ionicons name={icon} size={20} color={color} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{title}</Text>
          <Small>{why}</Small>
        </View>
      </Row>
      <Divider />
      {deferred ? (
        <Micro>{t('perm_asked_when_used')}</Micro>
      ) : state === 'idle' ? (
        <Btn small tone="soft" label={t('perm_allow')} onPress={onAsk} />
      ) : (
        <Row style={{ gap: 6 }}>
          <Ionicons name={state === 'granted' ? 'checkmark-circle' : 'alert-circle-outline'} size={16} color={color} />
          <Text style={{ color, fontSize: F.small }}>{state === 'granted' ? t('perm_granted') : t('perm_denied')}</Text>
        </Row>
      )}
    </Card>
  );
}
