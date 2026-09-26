import React from 'react';
import { Text, View } from 'react-native';
import type { AIRoute } from '../ai/ollama';
import type { Lang } from '../core/types';
import { makeT } from '../i18n';
import { C, MICRO } from '../ui/theme';

export function AIBadge({ route, lang }: { route: AIRoute; lang: Lang }) {
  const t = makeT(lang);
  const map: Record<AIRoute, { label: string; color: string }> = {
    primary: { label: t('ai_lan'), color: C.accent },
    fallback: { label: t('ai_remote'), color: C.cyan },
    offline: { label: t('ai_offline'), color: C.textFaint },
    checking: { label: t('ai_checking'), color: C.textFaint },
  };
  const m = map[route];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: m.color }} />
      <Text style={[MICRO, { color: C.textDim }]}>{m.label}</Text>
    </View>
  );
}
