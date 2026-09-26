import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MAX_MEMORIES, type MemoryItem, type MemoryType } from '../core/memory';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Divider, Empty, Field, Micro, Pill, Row, Screen, SectionHeader, Small } from '../ui/components';
import { C, F } from '../ui/theme';

const GROUPS: { type: MemoryType; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { type: 'fact', icon: 'person-outline', color: C.accent },
  { type: 'preference', icon: 'heart-outline', color: C.violet },
  { type: 'goal', icon: 'flag-outline', color: C.cyan },
  { type: 'correction', icon: 'create-outline', color: C.amber },
  { type: 'episode', icon: 'calendar-outline', color: C.textFaint },
];

const EXAMPLES: Record<string, string[]> = {
  en: ['I am vegetarian', 'My knee hurts on stairs', 'I work night shifts', 'I do not like oats'],
  mr: ['मी शाकाहारी आहे', 'जिन्यावर गुडघा दुखतो', 'मी रात्रपाळी करतो', 'मला ओट्स आवडत नाहीत'],
  hi: ['मैं शाकाहारी हूँ', 'सीढ़ी पर घुटना दुखता है', 'मैं नाइट शिफ्ट करता हूँ', 'मुझे ओट्स पसंद नहीं'],
};

/** Everything the app remembers, visible and deletable. */
export default function MemoryScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const [text, setText] = useState('');

  const grouped = useMemo(() => {
    const map = new Map<MemoryType, MemoryItem[]>();
    for (const g of GROUPS) map.set(g.type, []);
    for (const m of app.state.memory) map.get(m.type)?.push(m);
    for (const g of GROUPS) map.get(g.type)!.sort((a, b) => b.date.localeCompare(a.date));
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
        <Micro>{en('memory_add')}</Micro>
        <Field value={text} onChangeText={setText} placeholder={t('memory_add')} multiline />
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

      {app.state.memory.some((m) => m.source === 'auto') ? <Micro>{t('confirm_hint')}</Micro> : null}

      {GROUPS.map((g) => {
        const items = grouped.get(g.type) ?? [];
        if (items.length === 0) return null;
        return (
          <View key={g.type} style={{ gap: 10 }}>
            <SectionHeader title={en(`mem_${g.type}`)} meta={`${items.length}`} />
            <Card>
              {items.map((m, i) => (
                <View key={m.id}>
                  {i > 0 ? <Divider /> : null}
                  <Row style={{ paddingVertical: 10, gap: 12, alignItems: 'flex-start' }}>
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        backgroundColor: C.cardAlt,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 2,
                      }}>
                      <Ionicons name={g.icon} size={14} color={g.color} />
                    </View>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: m.source === 'user' ? C.text : C.textDim, fontSize: F.body, lineHeight: 20 }}>{m.text}</Text>
                      <Micro color={m.source === 'auto' ? C.textGhost : C.textFaint}>
                        {`${m.source === 'user' ? t('memory_you') : t('memory_learned')} · ${m.date}`}
                      </Micro>
                    </View>
                    <Row style={{ gap: 12 }}>
                      {m.source === 'auto' ? (
                        <Pressable onPress={() => app.confirmMemory(m.id)} hitSlop={10} accessibilityLabel={t('confirm')}>
                          <Ionicons name="checkmark" size={17} color={C.cyan} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => app.forgetMemory(m.id)} hitSlop={10} accessibilityLabel={t('delete')}>
                        <Ionicons name="close" size={16} color={C.textGhost} />
                      </Pressable>
                    </Row>
                  </Row>
                </View>
              ))}
            </Card>
          </View>
        );
      })}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Micro>{en('memory_stored')}</Micro>
          <Text style={{ color: C.textDim, fontSize: F.tiny }}>
            {app.state.memory.length} / {MAX_MEMORIES}
          </Text>
        </Row>
        <Bar value={app.state.memory.length} max={MAX_MEMORIES} color={C.violet} />
      </Card>
    </Screen>
  );
}
