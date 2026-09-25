import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useNudges } from '../services/useNudges';
import { useApp } from '../store/AppProvider';
import { Btn, Row, Small } from '../ui/components';
import { C, F, S } from '../ui/theme';

/** The interrupt itself: one line, one two-minute task, three ways out. */
export function NudgeToast() {
  const { current, respond } = useNudges();
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const [left, setLeft] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setRunning(false);
    setLeft(current?.choice?.microTaskSeconds ?? 0);
  }, [current]);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left]);

  if (!current) return null;
  const finished = running && left <= 0;

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 88,
        backgroundColor: C.cardAlt,
        borderWidth: 1,
        borderColor: C.teal,
        borderRadius: S.radius,
        padding: S.pad,
        gap: 10,
        maxWidth: 520,
        alignSelf: 'center',
      }}>
      <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{current.title}</Text>
      <Text style={{ color: C.text, fontSize: F.body }}>{current.body}</Text>
      <Small color={C.teal}>{current.task}</Small>

      {running && !finished ? (
        <Text style={{ color: C.text, fontSize: 28, fontWeight: '600', textAlign: 'center' }}>{left}</Text>
      ) : null}

      <Row style={{ gap: 8 }}>
        {!running && !finished ? (
          <Btn small label={t('start')} onPress={() => setRunning(true)} style={{ flex: 1 }} />
        ) : (
          <Btn small label={t('done')} onPress={() => respond('done')} style={{ flex: 1 }} />
        )}
        <Btn small tone="ghost" label="10 min" onPress={() => respond('snooze')} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('cancel')} onPress={() => respond('skip')} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
