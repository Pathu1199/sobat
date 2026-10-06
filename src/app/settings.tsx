import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { isUp, listModels, normalizeUrl } from '../ai/ollama';
import type { Lang } from '../core/types';
import { fill, LANG_NAMES, makeT } from '../i18n';
import { notifyNow, requestPermission } from '../services/notify';
import Constants from 'expo-constants';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { useDriveBackup } from '../services/useDriveBackup';
import { useApp } from '../store/AppProvider';
import { DEFAULT_OLLAMA_URL } from '../store/defaults';
import { Btn, Card, Divider, Field, ListRow, Micro, Pill, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F, TEXT_SCALES } from '../ui/theme';

export default function SettingsScreen() {
  const app = useApp();
  const s = app.state.settings;
  const br = app.state.breakSettings;
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const router = useRouter();

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const drive = useDriveBackup();
  const [confirmRestore, setConfirmRestore] = useState(false);
  // Ollama and the break monitor are the technical half; folded unless wanted.
  const [advanced, setAdvanced] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<'sent' | 'blocked' | null>(null);

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
        <SectionHeader title={t('general')} icon={<Ionicons name="options-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Micro>{t('language')}</Micro>
          <Row style={{ gap: 8 }}>
            {(Object.keys(LANG_NAMES) as Lang[]).map((l) => (
              <Pill key={l} label={LANG_NAMES[l]} active={lang === l} onPress={() => app.setProfile({ lang: l })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('appearance')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['system', 'light', 'dark'] as const).map((a) => (
              <Pill key={a} label={t(`appearance_${a}`)} active={s.appearance === a} onPress={() => app.setSettings({ appearance: a })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('text_size')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {TEXT_SCALES.map((sc, i) => (
              <Pill key={sc} label={t(['size_small', 'size_normal', 'size_large', 'size_xl'][i])} active={(s.textScale || 1) === sc} onPress={() => app.setSettings({ textScale: sc })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('diet')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {(['veg', 'egg', 'nonveg'] as const).map((d) => (
              <Pill key={d} label={t(`diet_${d}`)} active={s.diet === d} onPress={() => app.setSettings({ diet: d })} />
            ))}
          </Row>
          <Small color={C.textFaint}>{t('diet_hint')}</Small>
        </Card>
      </View>


      <View style={{ gap: 10 }}>
        <SectionHeader title={t('reminders')} meta={s.nudgesEnabled ? 'On' : 'Off'} icon={<Ionicons name="notifications-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Toggle
            title={t('nudge_every')}
            desc={t('nudge_desc')}
            on={s.nudgesEnabled}
            onToggle={() => app.setSettings({ nudgesEnabled: !s.nudgesEnabled })}
          />
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[15, 30, 45, 60, 90].map((m) => (
              <Pill key={m} label={`${m}m`} active={s.nudgeMinutes === m} onPress={() => app.setSettings({ nudgeMinutes: m })} />
            ))}
          </Row>
          <Row style={{ gap: 8 }}>
            <Btn small tone="ghost" label={t('allow_notifications')} onPress={() => requestPermission()} style={{ flex: 1 }} />
            <Btn
              small
              tone="soft"
              label={t('test_notification')}
              onPress={async () => {
                const ok = await requestPermission();
                setNotifyMsg(ok ? 'sent' : 'blocked');
                if (ok) await notifyNow(t('test_notification_title'), t('test_notification_body'));
              }}
              style={{ flex: 1 }}
            />
          </Row>
          {notifyMsg ? <Small color={notifyMsg === 'sent' ? C.green : C.amber}>{t(notifyMsg === 'sent' ? 'test_notification_sent' : 'test_notification_blocked')}</Small> : null}
          <Divider />
          <Micro>{t('quiet_hours')}</Micro>
          <Row style={{ gap: 12 }}>
            <Field label={t('time_from')} value={String(s.quietStartHour)} onChangeText={(v) => app.setSettings({ quietStartHour: Number(v) || 0 })} keyboardType="numeric" />
            <Field label={t('time_to')} value={String(s.quietEndHour)} onChangeText={(v) => app.setSettings({ quietEndHour: Number(v) || 0 })} keyboardType="numeric" />
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('water_goal')} meta={`${s.waterGoalMl / 1000} L`} icon={<Ionicons name="water-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[2000, 2500, 3000, 3500, 4000].map((m) => (
              <Pill key={m} label={`${m / 1000} L`} active={s.waterGoalMl === m} onPress={() => app.setSettings({ waterGoalMl: m })} />
            ))}
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('memory_title')} meta={`${app.state.memory.length}`} icon={<Ionicons name="bookmark-outline" size={13} color={C.textFaint} />} />
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
        <SectionHeader title={t('sched_title')} icon={<Ionicons name="cafe-outline" size={13} color={C.textFaint} />} />
        <ScheduleEditor />

        <SectionHeader title={t('data_title')} icon={<Ionicons name="cloud-upload-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Small>{t('drive_note')}</Small>
          {!drive.configured ? (
            <Small color={C.textFaint}>{t('drive_not_configured')}</Small>
          ) : (
            <>
              <Micro>{drive.lastBackupAt ? fill(t('drive_last'), { t: new Date(drive.lastBackupAt).toLocaleString() }) : t('drive_never')}</Micro>
              <Row style={{ gap: 8 }}>
                <Btn small label={t('drive_backup')} onPress={drive.backup} disabled={drive.status === 'busy'} style={{ flex: 1 }} />
                {confirmRestore ? (
                  <Btn
                    small
                    tone="danger"
                    label={t('confirm')}
                    onPress={() => {
                      setConfirmRestore(false);
                      void drive.restore();
                    }}
                    style={{ flex: 1 }}
                  />
                ) : (
                  <Btn small tone="soft" label={t('drive_restore')} onPress={() => setConfirmRestore(true)} disabled={drive.status === 'busy'} style={{ flex: 1 }} />
                )}
              </Row>
              {confirmRestore ? <Small color={C.amber}>{t('drive_restore_confirm')}</Small> : null}
              {drive.status !== 'idle' && drive.status !== 'busy' ? (
                <Small color={drive.status === 'error' || drive.status === 'none' ? C.amber : C.green}>{t(`drive_${drive.status}`)}</Small>
              ) : null}
            </>
          )}
        </Card>

        <Pressable
          onPress={() => setAdvanced((a) => !a)}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ gap: 3 }}>
            <Row style={{ gap: 7 }}>
              <Ionicons name="construct-outline" size={13} color={C.textFaint} />
              <Micro color={C.textDim}>{t('advanced')}</Micro>
            </Row>
            <Small color={C.textFaint}>{t('advanced_desc')}</Small>
          </View>
          <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={15} color={C.textGhost} />
        </Pressable>
        {advanced ? (
          <View style={{ gap: 20 }}>
          <View style={{ gap: 10 }}>
            <SectionHeader title="Ollama" meta={result?.ok ? t('connected') : undefined} />
            <Card>
              <Field label={t('ollama_url')} value={s.ollamaUrl} onChangeText={(v) => app.setSettings({ ollamaUrl: v })} placeholder={DEFAULT_OLLAMA_URL} />
              <Field label="Fallback (Tailscale)" value={s.ollamaFallbackUrl} onChangeText={(v) => app.setSettings({ ollamaFallbackUrl: v })} placeholder="http://varad-pc:11434" />
              <Row style={{ gap: 12 }}>
                <Field label={t('text_model')} value={s.textModel} onChangeText={(v) => app.setSettings({ textModel: v })} />
                <Field label={t('vision_model')} value={s.visionModel} onChangeText={(v) => app.setSettings({ visionModel: v })} />
              </Row>
              <Btn small tone="soft" label={testing ? '...' : t('test_connection')} onPress={test} />
              {result ? <Small color={result.ok ? C.cyan : C.amber}>{result.text}</Small> : null}
              <Divider />
              <Micro>On the PC: setx OLLAMA_HOST 0.0.0.0, restart Ollama, allow port 11434 on the private network.</Micro>
            </Card>
          </View>
    
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('break_monitor')} meta={br.enabled ? 'On' : 'Off'} />
            <Card>
              <Toggle
                title={t('break_monitor')}
                desc={t('break_monitor_desc')}
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
                <Micro>{t('break_compliance')}</Micro>
                <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
                  {app.state.breaks.filter((b) => b.action === 'taken').length}
                  <Text style={{ color: C.textFaint, fontWeight: '400' }}> / {app.state.breaks.length}</Text>
                </Text>
              </Row>
            </Card>
          </View>
          </View>
        ) : null}

        <SectionHeader title={t('about')} icon={<Ionicons name="information-circle-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Row style={{ gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{`Sobat ${Constants.expoConfig?.version ?? ''}`}</Text>
              <Small>{t('made_by')}</Small>
            </View>
          </Row>
          <Small color={C.textDim}>{t('about_body')}</Small>
          <Row style={{ gap: 8 }}>
            <Btn small tone="soft" label={t('open_guide')} onPress={() => router.push('/guide')} style={{ flex: 1 }} />
            <Btn small tone="soft" label={t('show_tour')} onPress={() => router.push('/tour?from=settings')} style={{ flex: 1 }} />
            <Btn small tone="ghost" label={t('view_source')} onPress={() => Linking.openURL('https://github.com/Pathu1199/sobat')} style={{ flex: 1 }} />
          </Row>
        </Card>

        <Micro>{t('export_data')}</Micro>
        <Card>
          <Row style={{ flexWrap: 'wrap', rowGap: 14 }}>
            <Count label={t('logged_intake')} value={app.state.meals.length} />
            <Count label={t('unit_kg')} value={app.state.weights.length} />
            <Count label={t('sleep_title')} value={app.state.sleep.length} />
            <Count label={t('mem_fact')} value={app.state.memory.length} />
          </Row>
          <Divider />
          <Row style={{ gap: 8 }}>
            <Btn small tone="soft" label={t('export_data')} onPress={exportFile} style={{ flex: 1 }} />
            {Platform.OS === 'web' ? <Btn small tone="soft" label={t('import_data')} onPress={importFile} style={{ flex: 1 }} /> : null}
          </Row>
          <Micro>{t('import_hint')}</Micro>
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
