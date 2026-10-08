import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Micro, Pill, Row, Small } from '../ui/components';
import { C, F, S } from '../ui/theme';

type OS = 'mac' | 'win';
type Step = { key: string; link?: string; cmd?: string[] };

const DOWNLOAD = 'https://ollama.com/download';

/**
 * How to connect the PC, as things to tap rather than things to read: the
 * download link opens, every command copies, and one button copies the
 * whole setup for the chosen system. The commands are fixed; only the
 * words around them are translated.
 */
function stepsFor(os: OS): Step[] {
  return [
    { key: 'install', link: DOWNLOAD },
    { key: 'pull', cmd: ['ollama pull qwen3:8b', 'ollama pull qwen2.5vl:7b'] },
    {
      key: 'origins',
      cmd: os === 'mac' ? ['launchctl setenv OLLAMA_ORIGINS "*"', 'launchctl setenv OLLAMA_HOST "0.0.0.0"'] : ['setx OLLAMA_ORIGINS "*"', 'setx OLLAMA_HOST "0.0.0.0"'],
    },
    { key: 'restart' },
    { key: 'test' },
    { key: 'phone', cmd: os === 'mac' ? ['ipconfig getifaddr en0'] : ['ipconfig'] },
  ];
}

export function OllamaSetup({ onTest, testing }: { onTest: () => void; testing: boolean }) {
  const { state } = useApp();
  const fb = useFeedback();
  const t = makeT(state.profile.lang);
  const [os, setOs] = useState<OS>(Platform.OS === 'windows' ? 'win' : 'mac');
  const steps = stepsFor(os);

  async function copy(text: string) {
    try {
      await Clipboard.setStringAsync(text);
      fb.haptic('light');
      fb.notify(t('copied'));
    } catch {
      fb.notify(text);
    }
  }
  const everything = steps.flatMap((s) => s.cmd ?? []).join('\n');

  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro>{t('local_ai_steps_title')}</Micro>
        <Row style={{ gap: 6 }}>
          <Pill label="Mac" active={os === 'mac'} onPress={() => setOs('mac')} />
          <Pill label="Windows" active={os === 'win'} onPress={() => setOs('win')} />
        </Row>
      </Row>
      {steps.map((s, i) => (
        <View key={s.key} style={{ gap: 8 }}>
          <Row style={{ gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.cyan, fontSize: F.small, fontWeight: '700' }}>{i + 1}</Text>
            </View>
            <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: 23 }}>{t(`ollama_${s.key}_${os}`) === `ollama_${s.key}_${os}` ? t(`ollama_${s.key}`) : t(`ollama_${s.key}_${os}`)}</Text>
          </Row>
          {s.link ? (
            <Btn small tone="soft" label={t('open_link')} icon={<Ionicons name="open-outline" size={14} color={C.text} />} onPress={() => Linking.openURL(s.link!)} style={{ alignSelf: 'flex-start', marginLeft: 34 }} />
          ) : null}
          {s.cmd?.map((c) => (
            <Pressable key={c} onPress={() => copy(c)} accessibilityRole="button" accessibilityLabel={t('copy')} style={({ pressed }) => ({ marginLeft: 34, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.bgAlt, borderWidth: S.hairline, borderColor: C.border, borderRadius: S.radiusSm, paddingVertical: 10, paddingHorizontal: 12, opacity: pressed ? 0.7 : 1 })}>
              <Text selectable style={{ flex: 1, color: C.text, fontSize: F.small, fontFamily: Platform.OS === 'web' ? 'ui-monospace, Menlo, monospace' : Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{c}</Text>
              <Ionicons name="copy-outline" size={16} color={C.accent} />
            </Pressable>
          ))}
          {s.key === 'test' ? <Btn small tone="primary" label={testing ? '…' : t('test_connection')} onPress={onTest} style={{ alignSelf: 'flex-start', marginLeft: 34 }} /> : null}
        </View>
      ))}
      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" label={t('copy_all_commands')} icon={<Ionicons name="copy-outline" size={14} color={C.text} />} onPress={() => copy(everything)} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('ollama_docs')} icon={<Ionicons name="book-outline" size={14} color={C.text} />} onPress={() => Linking.openURL('https://github.com/ollama/ollama/blob/main/docs/faq.md')} style={{ flex: 1 }} />
      </Row>
      <Small color={C.textFaint}>{t('ollama_iphone_note')}</Small>
    </View>
  );
}
