import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { GUIDE } from '../data/guide';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Screen, Small } from '../ui/components';
import { Logo } from '../ui/Logo';
import { C, F, lh } from '../ui/theme';

/**
 * The coach's standing advice, one fold per topic. The first is open so the
 * page is never a wall of headings. A link that names a topic (?s=, from the
 * reminders line on Today) puts that one first and open, so its steps are on
 * screen without a scroll.
 */
export default function GuideScreen() {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const all = GUIDE[lang] ?? GUIDE.en;
  const router = useRouter();
  const { s } = useLocalSearchParams<{ s?: string | string[] }>();
  const linked = all.find((x) => x.id === s);
  const sections = linked ? [linked, ...all.filter((x) => x !== linked)] : all;
  const [open, setOpen] = useState<string>(sections[0]?.id ?? '');

  return (
    <Screen>
      <Card flat>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
          <Logo size={36} />
          <View style={{ flex: 1 }}>
            <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
              {t('guide_title')}
            </Text>
            <Small>{t('guide_sub')}</Small>
          </View>
        </View>
        <Btn small tone="soft" label={t('show_tour')} onPress={() => router.push('/tour?from=settings')} />
      </Card>
      <Card>
        {sections.map((section, i) => {
          const on = open === section.id;
          return (
            <View key={section.id}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => setOpen(on ? '' : section.id)}
                accessibilityRole="button"
                aria-expanded={on}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={section.icon as keyof typeof Ionicons.glyphMap} size={16} color={on ? C.accent : C.textDim} />
                </View>
                <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{section.title}</Text>
                <Ionicons name={on ? 'chevron-up' : 'chevron-down'} size={15} color={C.textFaint} />
              </Pressable>
              {on ? (
                <View style={{ gap: 10, paddingLeft: 44, paddingBottom: 14 }}>
                  {section.lines.map((line, j) => (
                    <View key={j} style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent, marginTop: 8 }} />
                      <Text style={{ flex: 1, color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{line}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </Card>
      <Small color={C.textFaint}>{t('medical_note')}</Small>
    </Screen>
  );
}
