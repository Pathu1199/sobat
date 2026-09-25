import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { isUp, listModels, normalizeUrl } from '../ai/ollama';
import type { Lang } from '../core/types';
import { LANG_NAMES, makeT } from '../i18n';
import { requestPermission } from '../services/notify';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H3, P, Pill, Row, Screen, Small } from '../ui/components';
import { C } from '../ui/theme';

export default function SettingsScreen() {
  const app = useApp();
  const s = app.state.settings;
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const models = await listModels(s.ollamaUrl);
      setResult(`${t('connected')} · ${models.length} models: ${models.slice(0, 4).join(', ')}`);
    } catch {
      const fb = s.ollamaFallbackUrl ? await isUp(s.ollamaFallbackUrl) : false;
      setResult(fb ? `${t('connected')} (fallback)` : `${t('not_connected')} · ${normalizeUrl(s.ollamaUrl)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen>
      <Card>
        <H3>{t('language')}</H3>
        <Row style={{ gap: 8 }}>
          {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
            <Pill key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => app.setProfile({ lang: l })} />
          ))}
        </Row>
      </Card>

      <Card>
        <H3>Ollama</H3>
        <Field label={t('ollama_url')} value={s.ollamaUrl} onChangeText={(v) => app.setSettings({ ollamaUrl: v })} placeholder="http://192.168.1.10:11434" />
        <Field label="Fallback (Tailscale)" value={s.ollamaFallbackUrl} onChangeText={(v) => app.setSettings({ ollamaFallbackUrl: v })} placeholder="http://varad-pc:11434" />
        <Row style={{ gap: 12 }}>
          <Field label={t('text_model')} value={s.textModel} onChangeText={(v) => app.setSettings({ textModel: v })} />
          <Field label={t('vision_model')} value={s.visionModel} onChangeText={(v) => app.setSettings({ visionModel: v })} />
        </Row>
        <Btn small label={testing ? '...' : t('test_connection')} onPress={test} tone="soft" />
        {result ? <Small color={result.startsWith(t('connected')) ? C.teal : C.amber}>{result}</Small> : null}
        <Small color={C.textFaint}>
          On the PC run: setx OLLAMA_HOST 0.0.0.0 then restart Ollama, and allow port 11434 on the private network.
        </Small>
      </Card>

      <Card>
        <H3>{t('nudge_every')}</H3>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {[15, 30, 45, 60, 90].map((m) => (
            <Pill key={m} label={`${m} ${t('minutes')}`} active={s.nudgeMinutes === m} onPress={() => app.setSettings({ nudgeMinutes: m })} />
          ))}
        </Row>
        <Row style={{ gap: 8 }}>
          <Pill label={s.nudgesEnabled ? 'On' : 'Off'} active={s.nudgesEnabled} onPress={() => app.setSettings({ nudgesEnabled: !s.nudgesEnabled })} />
          <Btn small tone="ghost" label="Allow notifications" onPress={() => requestPermission()} />
        </Row>
        <Divider />
        <Small>{t('quiet_hours')}</Small>
        <Row style={{ gap: 12 }}>
          <Field label="from" value={String(s.quietStartHour)} onChangeText={(v) => app.setSettings({ quietStartHour: Number(v) || 0 })} keyboardType="numeric" />
          <Field label="to" value={String(s.quietEndHour)} onChangeText={(v) => app.setSettings({ quietEndHour: Number(v) || 0 })} keyboardType="numeric" />
        </Row>
      </Card>

      <Card>
        <H3>{t('water_goal')}</H3>
        <Row style={{ gap: 6, flexWrap: 'wrap' }}>
          {[2000, 2500, 3000, 3500, 4000].map((m) => (
            <Pill key={m} label={`${m / 1000} L`} active={s.waterGoalMl === m} onPress={() => app.setSettings({ waterGoalMl: m })} />
          ))}
        </Row>
      </Card>

      <Card>
        <H3>{t('export_data')}</H3>
        <Small>
          {app.state.meals.length} meals · {app.state.weights.length} weights · {app.state.sleep.length} sleep · {app.state.workouts.length} workouts
        </Small>
        <Btn
          small
          tone="soft"
          label={t('export_data')}
          onPress={() => {
            const json = app.exportJSON();
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
              const blob = new Blob([json], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `sobat-${app.today}.json`;
              a.click();
            } else {
              console.log(json);
            }
          }}
        />
        <Divider />
        {confirmReset ? (
          <Row style={{ gap: 8 }}>
            <Btn small tone="danger" label={t('reset_data')} onPress={app.resetAll} style={{ flex: 1 }} />
            <Btn small tone="ghost" label={t('cancel')} onPress={() => setConfirmReset(false)} style={{ flex: 1 }} />
          </Row>
        ) : (
          <Btn small tone="ghost" label={t('reset_data')} onPress={() => setConfirmReset(true)} />
        )}
      </Card>

      <Small color={C.textFaint}>Sobat v0.1 · MIT · your data never leaves your devices.</Small>
    </Screen>
  );
}
