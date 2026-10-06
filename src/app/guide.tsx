import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GUIDE } from '../data/guide';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Card, Divider, Screen, Small } from '../ui/components';
import { Logo } from '../ui/Logo';
import { C, F } from '../ui/theme';

/** The coach's standing advice, one fold per topic. The first is open so the page is never a wall of headings. */
export default function GuideScreen() {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const sections = GUIDE[lang] ?? GUIDE.en;
  const [open, setOpen] = useState<string>(sections[0]?.id ?? '');

  return (
    <Screen>
      <Card flat>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <Logo size={36} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600', letterSpacing: -0.3 }}>{t('guide_title')}</Text>
            <Small>{t('guide_sub')}</Small>
          </View>
        </View>
      </Card>
      <Card>
        {sections.map((s, i) => {
          const on = open === s.id;
          return (
            <View key={s.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => setOpen(on ? '' : s.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: on }}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={s.icon as keyof typeof Ionicons.glyphMap} size={16} color={on ? C.accent : C.textDim} />
                </View>
                <Text style={{ flex: 1, color: C.text, fontSize: F.body, fontWeight: '600' }}>{s.title}</Text>
                <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={15} color={C.textGhost} />
              </Pressable>
              {on ? (
                <View style={{ gap: 10, paddingLeft: 44, paddingBottom: 14 }}>
                  {s.lines.map((line, j) => (
                    <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 8 }} />
                      <Text style={{ flex: 1, color: C.textDim, fontSize: F.body, lineHeight: 22 }}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Small color={C.textGhost}>{t('medical_note')}</Small>
    </Screen>
  );
}
