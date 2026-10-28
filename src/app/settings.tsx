import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { isUp, listModels, normalizeUrl } from '../ai/ollama';
import { formatMoment } from '../core/date';
import { ACTIVITIES, PACES } from '../core/setup';
import type { Lang } from '../core/types';
import { fill, LANG_NAMES, makeT, numberText } from '../i18n';
import { notifyNow, requestPermission } from '../services/notify';
import { pushConfigured, stopPush, testPush } from '../services/push';
import Constants from 'expo-constants';
import { OllamaSetup } from '../components/OllamaSetup';
import { BreakSettingsCard } from '../components/BreakSettingsCard';
import { FeatureSettings } from '../components/FeatureSettings';
import { ReminderSettings } from '../components/ReminderSettings';
import { ScheduleEditor } from '../components/ScheduleEditor';
import { BOTTLES, WALK_GOALS } from '../components/tiles/TileSheet';
import { useDriveBackup } from '../services/useDriveBackup';
import { firebaseEnabled } from '../services/firebase';
import { useAuth } from '../services/useAuth';
import { useCloudSync } from '../services/useCloudSync';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { DEFAULT_OLLAMA_URL } from '../store/defaults';
import { Btn, Card, Divider, Field, ListRow, Micro, Pill, Row, Screen, SectionHeader, Small, Toggle } from '../ui/components';
import { C, F, TEXT_SCALES } from '../ui/theme';
import { bottleLabel, bottleName, walkGoalLabel, walkGoalName } from '../ui/tileWords';

/** The paces a person can choose, in kilos a week, as setup offers them. */

export default function SettingsScreen() {
  const app = useApp();
  const s = app.state.settings;
  const profile = app.state.profile;
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const router = useRouter();
  const auth = useAuth();
  const sync = useCloudSync();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const { ai, blocked } = useAI();
  const aiOnline = ai.route === 'primary' || ai.route === 'fallback';

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const drive = useDriveBackup();
  const [confirmRestore, setConfirmRestore] = useState(false);
  // Ollama is the technical half; folded unless wanted.
  const [advanced, setAdvanced] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<'sent' | 'blocked' | null>(null);
  const [pushMsg, setPushMsg] = useState<'sent' | 'failed' | null>(null);

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
        {firebaseEnabled && auth.user ? (
          <>
            <SectionHeader title={t('account')} icon={<Ionicons name="person-circle-outline" size={13} color={C.textFaint} />} />
            <Card>
              <Row style={{ justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Micro>{t('signed_in_as')}</Micro>
                  <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{auth.user.email}</Text>
                </View>
                {auth.isAdmin ? <Pill label={t('admin')} color={C.accent} textColor={C.onAccent} /> : null}
              </Row>
              <Row style={{ gap: 8, alignItems: 'center' }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: sync.status === 'synced' ? C.green : sync.status === 'error' || sync.status === 'blocked' ? C.red : sync.status === 'unconfigured' || sync.status === 'off' ? C.textFaint : C.amber }} />
                <View style={{ flex: 1 }}>
                  <Small color={C.textDim}>
                    {t(`sync_${sync.status}`)}
                    {sync.lastSyncAt ? ` · ${fill(t('sync_last'), { when: formatMoment(sync.lastSyncAt, lang) })}` : ''}
                  </Small>
                </View>
                {sync.status !== 'unconfigured' && sync.status !== 'off' ? (
                  <Btn small tone="ghost" label={sync.status === 'syncing' ? '…' : t('sync_now')} onPress={() => void sync.syncNow()} icon={<Ionicons name="cloud-upload-outline" size={14} color={C.text} />} />
                ) : null}
              </Row>
              {sync.error ? <Micro color={C.amber}>{sync.error}</Micro> : null}
              <Micro>{t('data_where')}</Micro>
              <Row style={{ gap: 8 }}>
                {auth.isAdmin ? <Btn small tone="soft" label={t('admin_title')} onPress={() => router.push('/admin')} icon={<Ionicons name="shield-checkmark-outline" size={14} color={C.text} />} style={{ flex: 1 }} /> : null}
                <Btn
                  small
                  tone="danger"
                  label={t('sign_out')}
                  onPress={() => sync.signOut().then((r) => (r === 'unsynced' ? setConfirmSignOut(true) : router.replace('/welcome')))}
                  icon={<Ionicons name="log-out-outline" size={14} color={C.red} />}
                  style={{ flex: 1 }}
                />
              </Row>
              {confirmSignOut ? (
                <Card tone={C.amber}>
                  <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{t('signout_unsynced_title')}</Text>
                  <Small color={C.textDim}>{t('signout_unsynced_body')}</Small>
                  <Row style={{ gap: 8 }}>
                    <Btn small tone="soft" label={t('sync_now')} onPress={() => sync.syncNow().then(() => setConfirmSignOut(false))} style={{ flex: 1 }} />
                    <Btn small tone="danger" label={t('signout_anyway')} onPress={() => sync.signOut(true).then(() => router.replace('/welcome'))} style={{ flex: 1 }} />
                    <Btn small tone="ghost" label={t('cancel')} onPress={() => setConfirmSignOut(false)} style={{ flex: 1 }} />
                  </Row>
                </Card>
              ) : null}
              <Micro>{t('sign_out_note')}</Micro>
            </Card>
          </>
        ) : null}

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
          <Micro>{t('weigh_day')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Pill key={d} label={t(`wd_${d}`)} active={(s.weighDay ?? 1) === d} onPress={() => app.setSettings({ weighDay: d })} />
            ))}
          </Row>
          <Micro>{t('free_days')}</Micro>
          <Small color={C.textFaint}>{t('plan_free_desc')}</Small>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = (s.offDays ?? []).includes(d);
              return <Pill key={d} label={t(`wd_${d}`)} active={on} onPress={() => app.setSettings({ offDays: on ? (s.offDays ?? []).filter((x) => x !== d) : [...(s.offDays ?? []), d].sort() })} />;
            })}
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

      {/* Asked in setup too; nowhere else changes the activity, so it is here, beside the pace, with the target they give. */}
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('setup_done_title')} icon={<Ionicons name="flame-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Micro>{t('activity_q')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {ACTIVITIES.map((a) => (
              <Pill key={a} label={t(a)} active={profile.activity === a} onPress={() => app.setProfile({ activity: a })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('rate_q')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {PACES.map((r) => (
              <Pill key={r} label={`${r} ${t('unit_kg')}`} active={profile.rateKgPerWeek === r} onPress={() => app.setProfile({ rateKgPerWeek: r })} />
            ))}
          </Row>
          <Small color={C.textDim}>{fill(t('plan_daily'), { kcal: numberText(app.targets.kcal), p: app.targets.proteinG })}</Small>
          {app.targets.floored ? <Small color={C.amber}>{t('floor_note')}</Small> : null}
        </Card>
      </View>


      <View style={{ gap: 10 }}>
        <SectionHeader title={t('reminders')} icon={<Ionicons name="notifications-outline" size={13} color={C.textFaint} />} />
        <ReminderSettings />
        <Card>
          {/* One switch for everything that speaks up while Sobat is open: the nudges, water among them, the coach's tips, and the relay's water. */}
          <Toggle title={t('rem_nudges')} desc={t('rem_nudges_desc')} on={s.nudgesEnabled} onToggle={() => app.setSettings({ nudgesEnabled: !s.nudgesEnabled })} />
          <Micro>{t('nudge_every')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[30, 60, 90, 120].map((m) => (
              <Pill key={m} label={`${m} ${t('tile_unit_min')}`} active={s.nudgeMinutes === m} onPress={() => app.setSettings({ nudgeMinutes: m })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('notify_gap')}</Micro>
          <Small color={C.textFaint}>{t('notify_gap_desc')}</Small>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[30, 60, 90, 120, 180].map((m) => (
              <Pill key={m} label={m < 60 ? `${m} ${t('tile_unit_min')}` : m % 60 === 0 ? `${m / 60} ${t('tile_unit_h')}` : `${Math.floor(m / 60)} ${t('tile_unit_h')} ${m % 60} ${t('tile_unit_min')}`} active={(s.notifyGapMinutes ?? 60) === m} onPress={() => app.setSettings({ notifyGapMinutes: m })} />
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
                if (ok) await notifyNow(t('test_notification_title'), t('test_notification_body'), { force: true });
              }}
              style={{ flex: 1 }}
            />
          </Row>
          {notifyMsg ? <Small color={notifyMsg === 'sent' ? C.green : C.amber}>{t(notifyMsg === 'sent' ? 'test_notification_sent' : 'test_notification_blocked')}</Small> : null}
          {pushConfigured() ? (
            <>
              <Divider />
              <Toggle
                title={t('push_title')}
                desc={t('push_desc')}
                on={s.pushRelay}
                onToggle={async () => {
                  if (s.pushRelay) {
                    await stopPush();
                    app.setSettings({ pushRelay: false });
                  } else {
                    const ok = await requestPermission();
                    if (ok) app.setSettings({ pushRelay: true });
                    else setNotifyMsg('blocked');
                  }
                }}
              />
              {s.pushRelay ? (
                <Btn
                  small
                  tone="soft"
                  label={t('push_test')}
                  onPress={async () => {
                    setPushMsg(null);
                    setPushMsg((await testPush(lang)) ? 'sent' : 'failed');
                  }}
                />
              ) : null}
              {pushMsg ? <Small color={pushMsg === 'sent' ? C.green : C.amber}>{t(pushMsg === 'sent' ? 'push_test_sent' : 'push_test_failed')}</Small> : null}
              <Small color={C.textFaint}>{t('push_privacy')}</Small>
            </>
          ) : null}
          <Divider />
          <Micro>{t('quiet_hours')}</Micro>
          <Row style={{ gap: 12 }}>
            <Field label={t('time_from')} value={String(s.quietStartHour)} onChangeText={(v) => app.setSettings({ quietStartHour: Number(v) || 0 })} keyboardType="numeric" />
            <Field label={t('time_to')} value={String(s.quietEndHour)} onChangeText={(v) => app.setSettings({ quietEndHour: Number(v) || 0 })} keyboardType="numeric" />
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('features_title')} icon={<Ionicons name="options-outline" size={13} color={C.textFaint} />} />
        <FeatureSettings />
        {/* Only while eye-care breaks are on: the break settings' own switch would otherwise read on while nothing runs. */}
        {s.features.breaks ? <BreakSettingsCard /> : null}
      </View>

      {/* The bottle and the walk goal are also on a long press of their tiles; here they are a tap away for anyone who cannot hold. */}
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('cust_card_waterWalk')} icon={<Ionicons name="water-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Micro>{t('water_goal')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {[2000, 2500, 3000, 3500, 4000].map((m) => (
              <Pill key={m} label={`${m / 1000} L`} active={s.waterGoalMl === m} onPress={() => app.setSettings({ waterGoalMl: m })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('tile_bottle_size')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {BOTTLES.map((ml) => (
              <Pill key={ml} label={bottleLabel(ml, t)} accessibilityLabel={bottleName(ml, t)} active={s.bottleMl === ml} onPress={() => app.setSettings({ bottleMl: ml })} />
            ))}
          </Row>
          <Divider />
          <Micro>{t('walk_target')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {WALK_GOALS.map((m) => (
              <Pill key={m} label={walkGoalLabel(m, t)} accessibilityLabel={walkGoalName(m, t)} active={s.walkGoalMin === m} onPress={() => app.setSettings({ walkGoalMin: m })} />
            ))}
          </Row>
        </Card>
      </View>

      <View style={{ gap: 10 }}>
        <SectionHeader title={t('memory_title')} meta={`${app.state.memory.length}`} icon={<Ionicons name="bookmark-outline" size={13} color={C.textFaint} />} />
        <Card>
          <ListRow
            icon={<Ionicons name="bookmark-outline" size={16} color={C.violet} />}
            title={t('mem_fact')}
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
              <Micro>{drive.lastBackupAt ? fill(t('drive_last'), { t: formatMoment(drive.lastBackupAt, lang) }) : t('drive_never')}</Micro>
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

        {auth.canUseAI ? (
        <>
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
          <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={15} color={C.textFaint} />
        </Pressable>
        {advanced ? (
          <View style={{ gap: 20 }}>
          <View style={{ gap: 10 }}>
            <SectionHeader title={t('local_ai')} meta={aiOnline ? t('ai_on') : t('ai_off')} color={aiOnline ? C.green : undefined} />
            <Card rail={aiOnline ? C.green : C.textFaint}>
              <Row style={{ gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: aiOnline ? C.green : C.textFaint }} />
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500', flex: 1 }}>{aiOnline ? fill(t('local_ai_up'), { url: ai.url }) : t('local_ai_down')}</Text>
              </Row>
              <Small color={C.textDim}>{t('local_ai_body')}</Small>
              {blocked === 'mixed_content' ? <Small color={C.amber}>{t('local_ai_mixed')}</Small> : null}
              <Divider />
              <OllamaSetup onTest={test} testing={testing} />
              <Divider />
              <Field label={t('ollama_url')} value={s.ollamaUrl} onChangeText={(v) => app.setSettings({ ollamaUrl: v })} placeholder={DEFAULT_OLLAMA_URL} />
              <Field label={t('ollama_fallback_label')} value={s.ollamaFallbackUrl} onChangeText={(v) => app.setSettings({ ollamaFallbackUrl: v })} placeholder="http://varad-pc:11434" />
              <Row style={{ gap: 12 }}>
                <Field label={t('text_model')} value={s.textModel} onChangeText={(v) => app.setSettings({ textModel: v })} />
                <Field label={t('vision_model')} value={s.visionModel} onChangeText={(v) => app.setSettings({ visionModel: v })} />
              </Row>
              {result ? <Small color={result.ok ? C.cyan : C.amber}>{result.text}</Small> : null}
            </Card>
          </View>
          </View>
        ) : null}
        </>
        ) : null}

        <SectionHeader title={t('about')} icon={<Ionicons name="information-circle-outline" size={13} color={C.textFaint} />} />
        <Card>
          <Row style={{ gap: 12 }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{`Sobat ${Constants.expoConfig?.version ?? ''}`}</Text>
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
          {app.storageError ? <Small color={C.red}>{t(app.storageError === 'load' ? 'storage_load_failed' : 'storage_save_failed')}</Small> : null}
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
              <Btn
                small
                tone="danger"
                label={firebaseEnabled && auth.user ? t('erase_everywhere') : t('reset_data')}
                onPress={firebaseEnabled && auth.user ? () => void sync.eraseEverywhere() : app.resetAll}
                style={{ flex: 1 }}
              />
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
      <Text style={{ color: C.text, fontSize: F.title, fontWeight: '500' }}>{value}</Text>
      <Micro>{label}</Micro>
    </View>
  );
}
