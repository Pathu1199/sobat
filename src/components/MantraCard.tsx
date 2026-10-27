import React, { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { makeT } from '../i18n';
import { useMantra } from '../services/useMantra';
import { useApp } from '../store/AppProvider';
import { Card, Micro, Quote } from '../ui/components';
import { C, F, lh, S } from '../ui/theme';

/**
 * The day's mantra, an optional card on Today: one line, and why it is said a
 * tap away. The reason opens under the button rather than inside it, so a
 * screen reader reaches it as text of its own.
 */
export function MantraCard() {
  const { state } = useApp();
  const t = makeT(state.profile.lang);
  const mantra = useMantra();
  const [why, setWhy] = useState(false);
  if (!mantra) return null;
  return (
    <Card>
      <Pressable
        onPress={() => setWhy((w) => !w)}
        accessibilityRole="button"
        aria-expanded={why}
        accessibilityLabel={`${t('mantra_title')}: ${mantra.text}. ${t('mantra_why')}`}
        style={({ pressed }) => ({ gap: 6, minHeight: S.touch, opacity: pressed ? 0.8 : 1 })}>
        <Micro color={C.textDim}>{t('mantra_title')}</Micro>
        <Quote color={C.cyan}>{mantra.text}</Quote>
        {why ? null : <Micro color={C.accentText}>{`${t('mantra_why')} ›`}</Micro>}
      </Pressable>
      {why ? (
        <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), paddingLeft: 14 }}>
          {`${mantra.why}\n`}
          <Text style={{ color: C.textFaint }}>{t('mantra_source')}</Text>
        </Text>
      ) : null}
    </Card>
  );
}
