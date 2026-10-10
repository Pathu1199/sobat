import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { eatBack, fatGrams, INTENSITY_KEYS, kcalBurned, type Intensity, weekActivity, activitiesFor } from '../core/activity';
import { localHHMM } from '../core/date';
import { newId } from '../core/id';
import { ACTIVITIES, activityById, activityName, CATEGORY_ORDER, DEFAULT_PICKS, type Activity } from '../data/activities';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Bar, Btn, Card, Divider, Micro, Pill, Ring, Row, Small, Toggle } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lift, S } from '../ui/theme';

/**
 * Movement, by the person's own choice. They pick the activities they do;
 * each becomes a tile; a tap logs minutes and effort; the calories follow
 * from MET and body weight. The week is counted against the WHO's 150
 * minutes, and today's burn earns part of itself back into the food.
 */
export function ActivityPanel() {
  const app = useApp();
  const fb = useFeedback();
  const { state, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const picks = state.settings.myActivities?.length ? state.settings.myActivities : DEFAULT_PICKS;
  const [choosing, setChoosing] = useState(false);
  const [logging, setLogging] = useState<Activity | null>(null);
  const [minutes, setMinutes] = useState(30);
  const [intensity, setIntensity] = useState<Intensity>(1);

  const logs = useMemo(() => state.activities ?? [], [state.activities]);
  const todayLogs = useMemo(() => logs.filter((l) => l.date === today).sort((a, b) => b.at.localeCompare(a.at)), [logs, today]);
  const week = useMemo(() => weekActivity(logs, today, state.settings.weighDay), [logs, today, state.settings.weighDay]);
  const burned = todayLogs.reduce((a, l) => a + l.kcal, 0);
  const allowed = activitiesFor({ lowImpactOnly: state.settings.lowImpactOnly });
  const tiles = picks.map((id) => activityById(id)).filter((a): a is Activity => !!a && allowed.some((x) => x.id === a.id));
  const preview = logging ? kcalBurned(logging, intensity, minutes, state.profile.weightKg) : 0;

  function save() {
    if (!logging) return;
    const kcal = kcalBurned(logging, intensity, minutes, state.profile.weightKg);
    app.addActivity({ id: newId(), date: today, at: new Date().toISOString(), activityId: logging.id, minutes, intensity, kcal });
    fb.haptic('success');
    fb.notify(fill(t('act_saved'), { kcal, g: fatGrams(kcal) }));
    setLogging(null);
  }
  function togglePick(id: string) {
    const cur = state.settings.myActivities?.length ? state.settings.myActivities : DEFAULT_PICKS;
    app.setSettings({ myActivities: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
  }

  return (
    <>
      {/* The week against 150 minutes, and today's burn. */}
      <Card rail={week.pct >= 1 ? C.green : C.accent}>
        <Row style={{ gap: 16 }}>
          <Ring value={week.minutes} max={week.target} size={88} stroke={8} color={week.pct >= 1 ? C.green : C.accent}>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '800' }}>{week.minutes}</Text>
            <Micro>{t('act_min')}</Micro>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            <Micro color={C.textDim}>{t('act_week_title')}</Micro>
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '700' }}>{fill(t('act_week_line'), { n: week.minutes, target: week.target, days: week.activeDays })}</Text>
            <Small color={C.textDim}>{fill(t('act_week_fat'), { kcal: week.kcal, g: week.fatGrams })}</Small>
            {burned > 0 ? <Small color={C.green}>{fill(t('act_today_line'), { kcal: burned, back: eatBack(burned) })}</Small> : <Small color={C.textFaint}>{t('act_today_none')}</Small>}
          </View>
        </Row>
        <Micro color={C.textGhost}>{t('act_who_note')}</Micro>
      </Card>

      {/* The person's own activities, one tap each. */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Micro color={C.textDim}>{t('act_mine')}</Micro>
        <Pressable onPress={() => setChoosing(true)} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
          <Micro color={C.accent}>{`${t('act_choose')} ›`}</Micro>
        </Pressable>
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {tiles.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              setLogging(a);
              setMinutes(a.category === 'yoga' || a.category === 'home' ? 20 : 30);
              setIntensity(1);
            }}
            accessibilityRole="button"
            accessibilityLabel={activityName(a, lang)}
            style={({ pressed }) => ({ flexBasis: '31%', flexGrow: 1, minHeight: 88, backgroundColor: C.card, borderRadius: 18, borderWidth: S.hairline, borderColor: C.border, padding: 12, gap: 6, alignItems: 'flex-start', opacity: pressed ? 0.75 : 1, ...lift(1) })}>
            <Text style={{ fontSize: 24 }}>{a.icon}</Text>
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '700' }} numberOfLines={2}>
              {activityName(a, lang)}
            </Text>
            <Micro color={C.textFaint}>{`${kcalBurned(a, 1, 30, state.profile.weightKg)} kcal / 30 ${t('act_min')}`}</Micro>
          </Pressable>
        ))}
        <Pressable onPress={() => setChoosing(true)} accessibilityRole="button" style={({ pressed }) => ({ flexBasis: '31%', flexGrow: 1, minHeight: 88, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.borderStrong, padding: 12, alignItems: 'center', justifyContent: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
          <Ionicons name="add" size={22} color={C.accent} />
          <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '700' }}>{t('act_add')}</Text>
        </Pressable>
      </View>

      {/* Today's log: each line can be removed, with undo. */}
      {todayLogs.length > 0 ? (
        <Card>
          <Micro color={C.textDim}>{t('act_today')}</Micro>
          {todayLogs.map((l, i) => {
            const a = activityById(l.activityId);
            return (
              <View key={l.id}>
                {i > 0 ? <Divider /> : null}
                <Row style={{ gap: 10, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 20 }}>{a?.icon ?? '🏃'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{a ? activityName(a, lang) : l.activityId}</Text>
                    <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`${localHHMM(l.at)} · ${l.minutes} ${t('act_min')} · ${t(`act_${INTENSITY_KEYS[l.intensity]}`)}`}</Text>
                  </View>
                  <Text style={{ color: C.green, fontSize: F.body, fontWeight: '800' }}>{`−${l.kcal}`}</Text>
                  <Pressable
                    onPress={() => {
                      app.removeActivity(l.id);
                      fb.notify(t('act_removed'), { label: t('undo'), onPress: () => app.addActivity(l) });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t('delete')}
                    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.redSoft : 'transparent' })}>
                    <Ionicons name="trash-outline" size={20} color={C.textDim} />
                  </Pressable>
                </Row>
              </View>
            );
          })}
        </Card>
      ) : null}

      {/* Log one: minutes and effort; the calories update as they change. */}
      <Sheet open={!!logging} title={logging ? `${logging.icon} ${activityName(logging, lang)}` : ''} onClose={() => setLogging(null)}>
        {logging ? (
          <View style={{ gap: 14 }}>
            <Micro>{t('act_how_long')}</Micro>
            <Row style={{ gap: 10, alignItems: 'center' }}>
              <Pressable onPress={() => setMinutes((m) => Math.max(5, m - 5))} accessibilityLabel="−" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="remove" size={22} color={C.text} />
              </Pressable>
              <Text style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: F.display, fontWeight: '800', letterSpacing: -1 }}>
                {minutes}
                <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '600' }}>{` ${t('act_min')}`}</Text>
              </Text>
              <Pressable onPress={() => setMinutes((m) => Math.min(300, m + 5))} accessibilityLabel="+" style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="add" size={22} color={C.text} />
              </Pressable>
            </Row>
            <Row style={{ gap: 6, justifyContent: 'center' }}>
              {[10, 15, 20, 30, 45, 60].map((m) => (
                <Pill key={m} label={`${m}`} active={minutes === m} onPress={() => setMinutes(m)} />
              ))}
            </Row>
            <Micro>{t('act_how_hard')}</Micro>
            <Row style={{ gap: 6 }}>
              {INTENSITY_KEYS.map((k, i) => (
                <Pill key={k} label={t(`act_${k}`)} active={intensity === i} onPress={() => setIntensity(i as Intensity)} />
              ))}
            </Row>
            <Card still rail={C.green}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <Micro>{t('act_burn')}</Micro>
                  <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '800' }}>
                    {preview}
                    <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '600' }}> kcal</Text>
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Micro>{t('act_fat')}</Micro>
                  <Text style={{ color: C.text, fontSize: F.h1, fontWeight: '800' }}>
                    {fatGrams(preview)}
                    <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '600' }}> g</Text>
                  </Text>
                </View>
              </Row>
              <Bar value={preview} max={Math.max(300, preview)} color={C.green} />
              <Small color={C.textDim}>{fill(t('act_math'), { met: logging.met[intensity], kg: state.profile.weightKg, back: eatBack(preview) })}</Small>
            </Card>
            <Btn label={t('act_log')} icon={<Ionicons name="checkmark" size={16} color={C.white} />} onPress={save} />
          </View>
        ) : null}
      </Sheet>

      {/* Choosing: everything there is, grouped, with the body's flags respected. */}
      <Sheet open={choosing} title={t('act_choose_title')} onClose={() => setChoosing(false)}>
        <Small color={C.textDim}>{t('act_choose_body')}</Small>
        <Toggle title={t('act_low_impact')} desc={t('act_low_impact_desc')} on={!!state.settings.lowImpactOnly} onToggle={() => app.setSettings({ lowImpactOnly: !state.settings.lowImpactOnly })} />
        <ScrollView style={{ maxHeight: 420 }}>
          {CATEGORY_ORDER.map((cat) => {
            const list = allowed.filter((a) => a.category === cat);
            if (!list.length) return null;
            return (
              <View key={cat} style={{ gap: 6, marginBottom: 12 }}>
                <Micro>{t(`act_cat_${cat}`)}</Micro>
                <Row style={{ flexWrap: 'wrap', gap: 6 }}>
                  {list.map((a) => (
                    <Pill key={a.id} label={`${a.icon} ${activityName(a, lang)}`} active={picks.includes(a.id)} onPress={() => togglePick(a.id)} />
                  ))}
                </Row>
              </View>
            );
          })}
        </ScrollView>
        <Btn label={t('done')} onPress={() => setChoosing(false)} />
      </Sheet>
    </>
  );
}

/** Everything the panel can be dropped into needs the same thing: nothing. Kept for the Move screen's import. */
export const ALL_ACTIVITIES = ACTIVITIES;
