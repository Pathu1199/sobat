import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MAX_MEMORIES, type MemoryItem, type MemoryType } from '../core/memory';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Empty, Field, H2, H3, P, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const GROUPS: MemoryType[] = ['fact', 'preference', 'goal', 'correction', 'episode'];

const EXAMPLES: Record<string, string[]> = {
  en: ['I am vegetarian', 'My knee hurts on stairs', 'I work night shifts', 'I do not like oats'],
  mr: ['मी शाकाहारी आहे', 'जिन्यावर गुडघा दुखतो', 'मी रात्रपाळी करतो', 'मला ओट्स आवडत नाहीत'],
  hi: ['मैं शाकाहारी हूँ', 'सीढ़ी पर घुटना दुखता है', 'मैं नाइट शिफ्ट करता हूँ', 'मुझे ओट्स पसंद नहीं'],
};

/**
 * Everything the app remembers, visible and deletable. A memory you cannot see
 * or delete is a memory you cannot trust.
 */
export default function MemoryScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [text, setText] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<MemoryType, MemoryItem[]>();
    for (const g of GROUPS) map.set(g, []);
    for (const m of app.state.memory) map.get(m.type)?.push(m);
    for (const g of GROUPS) map.get(g)!.sort((a, b) => b.date.localeCompare(a.date));
    return map;
  }, [app.state.memory]);

  function add(value: string) {
    const clean = value.trim();
    if (!clean) return;
    app.rememberText(clean, 'fact', 'user');
    setText('');
  }

  return (
    <Screen>
      <Card>
        <H3>{t('memory_add')}</H3>
        <Row>
          <Field value={text} onChangeText={setText} placeholder={t('memory_add')} multiline />
        </Row>
        <Btn label={t('memory_add_btn')} onPress={() => add(text)} disabled={!text.trim()} />
        <Row style={{ flexWrap: 'wrap', gap: 6 }}>
          {(EXAMPLES[lang] ?? EXAMPLES.en).map((e) => (
            <Pill key={e} label={e} onPress={() => add(e)} />
          ))}
        </Row>
      </Card>

      {app.state.memory.length === 0 ? (
        <Card>
          <Empty text={t('memory_empty')} />
        </Card>
      ) : null}

      {GROUPS.map((g) => {
        const items = grouped.get(g) ?? [];
        if (items.length === 0) return null;
        return (
          <Card key={g}>
            <H3>{t(`mem_${g}`)}</H3>
            {items.map((m, i) => (
              <View key={m.id}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ justifyContent: 'space-between', paddingVertical: 6, gap: 10 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: m.source === 'user' ? C.text : C.textDim, fontSize: F.body, lineHeight: 21 }}>{m.text}</Text>
                    <Small color={C.textFaint}>
                      {m.source === 'user' ? t('memory_you') : t('memory_learned')} · {m.date}
                    </Small>
                  </View>
                  <Pressable onPress={() => app.forgetMemory(m.id)} accessibilityLabel={t('delete')} hitSlop={8}>
                    <Ionicons name="close" size={18} color={C.textFaint} />
                  </Pressable>
                </Row>
              </View>
            ))}
          </Card>
        );
      })}

      <Small color={C.textFaint}>
        {t('memory_stored')} {app.state.memory.length} / {MAX_MEMORIES}
      </Small>
    </Screen>
  );
}
