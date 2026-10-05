import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useNudges, type Nudge } from '../services/useNudges';
import { useApp } from '../store/AppProvider';
import { Btn, Micro, Row } from '../ui/components';
import { C, F, S } from '../ui/theme';

/** The interrupt itself: one line, one two-minute task, three ways out. */
export function NudgeToast() {
  const { current, respond } = useNudges();
  if (!current) return null;
  // Keyed on the nudge, so a new one arrives with a fresh timer instead of an
  // effect reaching in to reset the old one's state.
  return <NudgeCard key={current.id} nudge={current} respond={respond} />;
}

function NudgeCard({ nudge, respond }: { nudge: Nudge; respond: (action: 'done' | 'snooze' | 'skip') => void }) {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const [left, setLeft] = useState(() => nudge.choice?.microTaskSeconds ?? 0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || left <= 0) return;
    const id = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(id);
  }, [running, left]);

  const finished = running && left <= 0;

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: 88,
        backgroundColor: C.card,
        borderWidth: S.hairline,
        borderColor: C.accent,
        borderRadius: S.radius,
        padding: S.padLg,
        gap: 10,
        maxWidth: 520,
        alignSelf: 'center',
      }}>
      <Micro color={C.accent}>{nudge.title}</Micro>
      <Text style={{ color: C.text, fontSize: F.body, lineHeight: 20 }}>{nudge.body}</Text>
      <Text style={{ color: C.cyan, fontSize: F.small }}>{nudge.task}</Text>

      {running && !finished ? (
        <Text style={{ color: C.text, fontSize: 30, fontWeight: '200', textAlign: 'center', letterSpacing: -1 }}>{left}</Text>
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
