import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, P, Row, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const WAIT_SECONDS = 120;

const STEPS: Record<string, string[]> = {
  en: ['Drink a full glass of water', 'Take ten slow breaths', 'Walk to another room', 'Now decide'],
  mr: ['पूर्ण एक ग्लास पाणी प्या', 'दहा सावकाश श्वास घ्या', 'दुसऱ्या खोलीत जाऊन या', 'आता ठरवा'],
  hi: ['पूरा एक गिलास पानी पिएँ', 'दस धीमी साँसें लें', 'दूसरे कमरे तक जाएँ', 'अब तय करें'],
};

/**
 * Two minutes between the urge and the decision. It does not try to talk you
 * out of eating; most cravings simply pass, and the ones that do not are
 * allowed.
 */
export function CravingSOS() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [left, setLeft] = useState(WAIT_SECONDS);
  const [running, setRunning] = useState(false);
  const stepList = STEPS[lang] ?? STEPS.en;
  const waterAdded = useRef(false);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left]);

  const done = running && left <= 0;
  const stepIndex = Math.min(stepList.length - 1, Math.floor(((WAIT_SECONDS - left) / WAIT_SECONDS) * stepList.length));

  function start() {
    setRunning(true);
    setLeft(WAIT_SECONDS);
    // Step one is a glass of water, so it may as well be counted.
    if (!waterAdded.current) {
      app.addWater(app.state.settings.glassMl);
      waterAdded.current = true;
    }
  }

  const size = 120;
  const stroke = 4;
  const rad = (size - stroke) / 2;
  const circ = 2 * Math.PI * rad;

  return (
    <Card>
      <Row style={{ gap: 8 }}>
        <Ionicons name="hand-left-outline" size={15} color={C.amber} />
        <Micro color={C.amber}>{t('craving_sos')}</Micro>
      </Row>
      <Small>{t('craving_hint')}</Small>

      {!running ? (
        <Btn small tone="soft" label={t('craving_start')} onPress={start} />
      ) : (
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={size / 2} cy={size / 2} r={rad} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={rad}
                stroke={done ? C.accent : C.amber}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${circ}`}
                strokeDashoffset={circ * (1 - left / WAIT_SECONDS)}
                strokeLinecap="round"
              />
            </Svg>
            <Text style={{ color: C.text, fontSize: 28, fontWeight: '200' }}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
            </Text>
          </View>
          {done ? (
            <>
              <P>{t('craving_done')}</P>
              <Btn
                small
                tone="ghost"
                label={t('done')}
                onPress={() => {
                  setRunning(false);
                  setLeft(WAIT_SECONDS);
                  waterAdded.current = false;
                }}
              />
            </>
          ) : (
            <Text style={{ color: C.text, fontSize: F.h3 }}>{stepList[stepIndex]}</Text>
          )}
        </View>
      )}
    </Card>
  );
}
