import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { isUp, listModels, normalizeUrl } from '../ai/ollama';
import type { Lang } from '../core/types';
import { fill, LANG_NAMES, makeT } from '../i18n';
import { requestPermission } from '../services/notify';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, ListRow, Micro, Pill, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F } from '../ui/theme';

export default function SettingsScreen() {
  const app = useApp();
  const s = app.state.settings;
  const br = app.state.breakSettings;
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');
  const router = useRouter();

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function test() {
    setTesting(true);
    setResult(null);
    try {
      const models = await listModels(s.ollamaUrl);
      setResult({ ok: true, text: `${t('connected')} · ${models.length} models · ${models.slice(0, 3).join(', ')}` });
    } catch {
      const fb = s.ollamaFallbackUrl ? await isUp(s.ollamaFallbackUrl) : false;
      setResult(fb ? { ok: true, text: `${t('connected')} (fallback)` } : { ok: false, text: `${t('not_connected')} · ${normalizeUrl(s.ollamaUrl)}` });
    } finally {
      setTesting(false);
    }
  }

  function importFile() {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = app.importState(String(reader.result));
        setImportMsg({ ok: res.ok, text: res.ok ? t('import_ok') : t('import_bad') });
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function exportFile() {
    const json = app.exportJSON();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sobat-${app.today}.json`;
      a.click();
    }
  }

  return (
    <Screen>
      <View style={{ gap: 10 }}>
        <SectionHeader title={en('language')} />
        <Card>
          <Row style={{ gap: 8 }}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <Pill key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => app.setProfile({ lang: l })} />
            ))}
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title="Ollama" meta={result?.ok ? en('connected') : undefined} />
        <Card>
          <Field label={en('ollama_url')} value={s.ollamaUrl} onChangeText={(v) => app.setSettings({ ollamaUrl: v })} placeholder="http://192.168.1.10:11434" />
          <Field label="Fallback (Tailscale)" value={s.ollamaFallbackUrl} onChangeText={(v) => app.setSettings({ ollamaFallbackUrl: v })} placeholder="http://varad-pc:11434" />
          <Row style={{ gap: 12 }}>
            <Field label={en('text_model')} value={s.textModel} onChangeText={(v) => app.setSettings({ textModel: v })} />
            <Field label={en('vision_model')} value={s.visionModel} onChangeText={(v) => app.setSettings({ visionModel: v })} />
          </Row>
          <Btn small tone="soft" label={testing ? '...' : t('test_connection')} onPress={test} />
          {result ? <Small color={result.ok ? C.cyan : C.amber}>{result.text}</Small> : null}
          <Divider />
          <Micro>On the PC: setx OLLAMA_HOST 0.0.0.0, restart Ollama, allow port 11434 on the private network.</Micro>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('break_monitor')} meta={br.enabled ? 'On' : 'Off'} />
        <Card>
          <Toggle
            title={t('break_monitor')}
            desc={en('break_monitor_desc')}
            on={br.enabled}
            onToggle={() => app.setBreakSettings({ enabled: !br.enabled })}
          />

          <Divider />
          <Micro>{t('brk_kinds')}</Micro>
          {(['micro', 'long', 'posture', 'blink'] as const).map((k) => (
            <View key={k} style={{ gap: 7 }}>
              <Toggle
                title={t(`brk_${k}`)}
                desc={t(`brk_${k}_hint`)}
                on={br[k].enabled}
                onToggle={() => app.setBreakSettings({ [k]: { ...br[k], enabled: !br[k].enabled } } as Partial<typeof br>)}
              />
              {br[k].enabled ? (
                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {(k === 'micro' ? [15, 20, 30, 45] : k === 'long' ? [45, 60, 90, 120] : k === 'posture' ? [20, 30, 45, 60] : [5, 10, 15, 20]).map((m) => (
                    <Pill
                      key={m}
                      label={`${m}m`}
                      active={br[k].everyMinutes === m}
                      onPress={() => app.setBreakSettings({ [k]: { ...br[k], everyMinutes: m } } as Partial<typeof br>)}
                    />
                  ))}
                </Row>
              ) : null}
            </View>
          ))}

          <Divider />
          <Micro>{t('brk_strictness')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['gentle', 'normal', 'strict'] as const).map((s) => (
              <Pill
                key={s}
                label={t(s === 'strict' ? 'brk_strict_mode' : `brk_${s}`)}
                active={br.strictness === s}
                onPress={() => app.setBreakSettings({ strictness: s })}
              />
            ))}
          </Row>
          <Micro>
            {br.strictness === 'gentle'
              ? t('brk_gentle_desc')
              : br.strictness === 'strict'
                ? t('brk_strict_desc')
                : fill(t('brk_normal_desc'), { n: br.maxSkipsPerDay })}
          </Micro>
          {br.strictness === 'normal' ? (
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {[1, 2, 3, 5].map((n) => (
                <Pill key={n} label={String(n)} active={br.maxSkipsPerDay === n} onPress={() => app.setBreakSettings({ maxSkipsPerDay: n })} />
              ))}
            </Row>
          ) : null}

          <Divider />
          <Micro>{t('brk_smart_pause')}</Micro>
          <Toggle
            title={t('brk_when_fullscreen')}
            desc={t('brk_fullscreen_desc')}
            on={br.smartPause.whenFullscreen}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenFullscreen: !br.smartPause.whenFullscreen } })}
          />
          <Toggle
            title={t('brk_when_oncall')}
            desc={t('brk_oncall_desc')}
            on={br.smartPause.whenOnCall}
            onToggle={() => app.setBreakSettings({ smartPause: { ...br.smartPause, whenOnCall: !br.smartPause.whenOnCall } })}
          />

          <Divider />
          <Toggle
            title={t('brk_schedule')}
            desc={t('brk_schedule_desc')}
            on={br.schedule !== null}
            onToggle={() =>
              app.setBreakSettings({ schedule: br.schedule === null ? { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 18 } : null })
            }
          />
          {br.schedule ? (
            <Row style={{ gap: 12 }}>
              <Field
                label={t('time_from')}
                value={String(br.schedule.startHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, startHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
              <Field
                label={t('time_to')}
                value={String(br.schedule.endHour)}
                onChangeText={(v) => app.setBreakSettings({ schedule: { ...br.schedule!, endHour: Number(v) || 0 } })}
                keyboardType="numeric"
              />
            </Row>
          ) : null}

          <Divider />
          <Toggle title={t('brk_sound')} desc={t('brk_sound_desc')} on={br.sound} onToggle={() => app.setBreakSettings({ sound: !br.sound })} />

          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <Micro>{en('break_compliance')}</Micro>
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
              {app.state.breaks.filter((b) => b.action === 'taken').length}
              <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {app.state.breaks.length}</Text>
            </Text>
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('nudge_every')} meta={s.nudgesEnabled ? 'On' : 'Off'} />
        <Card>
          <Toggle
            title={t('nudge_every')}
            desc={en('nudge_desc')}
            on={s.nudgesEnabled}
            onToggle={() => app.setSettings({ nudgesEnabled: !s.nudgesEnabled })}
          />
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[15, 30, 45, 60, 90].map((m) => (
              <Pill key={m} label={`${m}m`} active={s.nudgeMinutes === m} onPress={() => app.setSettings({ nudgeMinutes: m })} />
            ))}
          </Row>
          <Btn small tone="ghost" label={en('allow_notifications')} onPress={() => requestPermission()} />
          <Divider />
          <Micro>{en('quiet_hours')}</Micro>
          <Row style={{ gap: 12 }}>
            <Field label={t('time_from')} value={String(s.quietStartHour)} onChangeText={(v) => app.setSettings({ quietStartHour: Number(v) || 0 })} keyboardType="numeric" />
            <Field label={t('time_to')} value={String(s.quietEndHour)} onChangeText={(v) => app.setSettings({ quietEndHour: Number(v) || 0 })} keyboardType="numeric" />
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('water_goal')} meta={`${s.waterGoalMl / 1000} L`} />
        <Card>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[2000, 2500, 3000, 3500, 4000].map((m) => (
              <Pill key={m} label={`${m / 1000} L`} active={s.waterGoalMl === m} onPress={() => app.setSettings({ waterGoalMl: m })} />
            ))}
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('memory_title')} meta={`${app.state.memory.length}`} />
        <Card>
          <ListRow
            icon={<Ionicons name="bookmark-outline" size={16} color={C.violet} />}
            title={t('memory_title')}
            sub={`${app.state.memory.length} remembered`}
            onPress={() => router.push('/memory')}
            trailing={<Ionicons name="chevron-forward" size={16} color={C.textFaint} />}
          />
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={en('export_data')} />
        <Card>
          <Row style={{ flexWrap: 'wrap', rowGap: 14 }}>
            <Count label={en('logged_intake')} value={app.state.meals.length} />
            <Count label={t('unit_kg')} value={app.state.weights.length} />
            <Count label={en('sleep_title')} value={app.state.sleep.length} />
            <Count label={en('mem_fact')} value={app.state.memory.length} />
          </Row>
          <Divider />
          <Row style={{ gap: 8 }}>
            <Btn small tone="soft" label={t('export_data')} onPress={exportFile} style={{ flex: 1 }} />
            {Platform.OS === 'web' ? <Btn small tone="soft" label={t('import_data')} onPress={importFile} style={{ flex: 1 }} /> : null}
          </Row>
          <Micro>{en('import_hint')}</Micro>
          {importMsg ? <Small color={importMsg.ok ? C.cyan : C.amber}>{importMsg.text}</Small> : null}
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
      </View>

      <Micro>Sobat v0.3 · MIT · your data never leaves your devices.</Micro>
    </Screen>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ minWidth: 72, flexGrow: 1, gap: 4 }}>
      <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '300' }}>{value}</Text>
      <Micro>{label}</Micro>
    </View>
  );
}
