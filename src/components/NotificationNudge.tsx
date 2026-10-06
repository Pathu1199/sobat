import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Text } from 'react-native';
import { makeT } from '../i18n';
import { notifyNow, requestPermission, webPermission } from '../services/notify';
import { pushConfigured } from '../services/push';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

/**
 * The one tap a browser needs before it may show reminders. Shown on Today
 * until it is answered. On an iPhone the prompt only exists inside the
 * pinned app, so in plain Safari it says to pin first.
 */
export function NotificationNudge() {
  const { state, setSettings } = useApp();
  const t = makeT(state.profile.lang);
  const [status, setStatus] = useState(() => webPermission());

  if (Platform.OS !== 'web' || status !== 'default') return null;

  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { standalone?: boolean }) : undefined;
  const iPhoneInSafari = !!nav && /iPhone|iPad/.test(nav.userAgent) && nav.standalone === false;

  async function enable() {
    const ok = await requestPermission();
    setStatus(ok ? 'granted' : webPermission());
    if (ok) {
      if (pushConfigured()) setSettings({ pushRelay: true });
      await notifyNow(t('ntf_on_title'), t('ntf_on_body'));
    }
  }

  return (
    <Card rail={C.amber}>
      <Row style={{ gap: 8 }}>
        <Ionicons name="notifications-outline" size={16} color={C.amber} />
        <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('ntf_enable_title')}</Text>
      </Row>
      <Small>{iPhoneInSafari ? t('ntf_pin_first') : t('ntf_enable_body')}</Small>
      {!iPhoneInSafari ? <Btn small label={t('ntf_enable_btn')} onPress={enable} /> : null}
    </Card>
  );
}
