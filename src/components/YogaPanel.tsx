import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { fatGrams, kcalBurned } from '../core/activity';
import { newId } from '../core/id';
import { activityById } from '../data/activities';
import { ASANAS, asanaName, YOGA_ROUTINES, type Asana } from '../data/yoga';
import { YOGA_IMAGES } from '../data/yogaImages';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, lift, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

const CATS = ['all', 'standing', 'seated', 'lying', 'backbend', 'twist', 'balance', 'breath', 'sequence'] as const;
type Cat = (typeof CATS)[number];

/**
 * The asana library: a photo, the names in three languages, numbered steps,
 * what it is for and who should skip it. Done ones log as yoga minutes, so
 * they count in the day's burn like any other activity.
 */
export function YogaPanel() {
  const app = useApp();
  const fb = useFeedback();
  const { state, today } = app;
  const lang = state.profile.lang;
  const t = makeT(lang);
  const wide = useBreakpoint() !== 'mobile';
  const [cat, setCat] = useState<Cat>('all');
  const [routine, setRoutine] = useState<string | null>(null);
  const [open, setOpen] = useState<Asana | null>(null);
  const [step, setStep] = useState(0);

  const list = useMemo(() => {
    if (routine) {
      const r = YOGA_ROUTINES.find((x) => x.id === routine)!;
      return r.asanas.map((id) => ASANAS.find((a) => a.id === id)!);
    }
    return cat === 'all' ? ASANAS : ASANAS.filter((a) => a.category === cat);
  }, [cat, routine]);

  const doneToday = useMemo(() => (state.activities ?? []).filter((a) => a.date === today && (a.activityId === 'yoga' || a.activityId === 'surya-namaskar')).reduce((n, a) => n + a.minutes, 0), [state.activities, today]);

  function log(a: Asana, minutes: number) {
    const act = activityById(a.id === 'surya-namaskar' ? 'surya-namaskar' : 'yoga')!;
    const kcal = kcalBurned(act, 1, state.profile.weightKg, minutes);
    app.addActivity({ id: newId(), date: today, at: new Date().toISOString(), activityId: act.id, minutes, intensity: 1, kcal });
    fb.haptic('success');
    fb.notify(fill(t('act_saved'), { kcal, g: fatGrams(kcal) }));
    setOpen(null);
  }
  function logRoutine(id: string) {
    const r = YOGA_ROUTINES.find((x) => x.id === id)!;
    const act = activityById('yoga')!;
    const kcal = kcalBurned(act, 1, state.profile.weightKg, r.minutes);
    app.addActivity({ id: newId(), date: today, at: new Date().toISOString(), activityId: 'yoga', minutes: r.minutes, intensity: 1, kcal });
    fb.haptic('success');
    fb.notify(fill(t('act_saved'), { kcal, g: fatGrams(kcal) }));
  }

  const steps = open ? open.steps[lang] : [];

  return (
    <View style={{ gap: 14 }}>
      <Card rail={C.accent}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Micro>{t('yoga_title')}</Micro>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '800', marginTop: 2 }}>{doneToday > 0 ? fill(t('yoga_done_today'), { n: doneToday }) : t('yoga_none_today')}</Text>
          </View>
          <Text style={{ fontSize: 32 }}>🧘</Text>
        </Row>
        <Small color={C.textDim}>{t('yoga_intro')}</Small>
      </Card>

      {/* Routines: a ready set for someone who does not want to choose. */}
      <Micro>{t('yoga_routines')}</Micro>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {YOGA_ROUTINES.map((r) => {
          const active = routine === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setRoutine(active ? null : r.id)}
              accessibilityRole="button"
              style={({ pressed }) => ({ width: 150, minHeight: 84, padding: 12, borderRadius: 18, backgroundColor: active ? C.accent : C.card, borderWidth: S.hairline, borderColor: active ? C.accent : C.border, gap: 4, opacity: pressed ? 0.8 : 1, ...lift(1) })}>
              <Text style={{ color: active ? C.white : C.text, fontSize: F.body, fontWeight: '700' }}>{t(`yoga_r_${r.id.replace('-', '_')}`)}</Text>
              <Text style={{ color: active ? C.white : C.textFaint, fontSize: F.tiny }}>{`${r.minutes} ${t('act_min')} · ${r.asanas.length} ${t('yoga_asanas')}`}</Text>
              {active ? (
                <Pressable onPress={() => logRoutine(r.id)} accessibilityRole="button" style={{ marginTop: 4, alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: C.white }}>
                  <Text style={{ color: C.accent, fontSize: F.tiny, fontWeight: '800' }}>{fill(t('yoga_log_min'), { n: r.minutes })}</Text>
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {!routine ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {CATS.map((c) => (
            <Pill key={c} label={t(`yoga_c_${c}`)} active={cat === c} onPress={() => setCat(c)} />
          ))}
        </ScrollView>
      ) : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {list.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => { setOpen(a); setStep(0); }}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexBasis: wide ? '31%' : '47%', flexGrow: 1, backgroundColor: C.card, borderRadius: 18, borderWidth: S.hairline, borderColor: C.border, overflow: 'hidden', opacity: pressed ? 0.8 : 1, ...lift(1) })}>
            <View style={{ aspectRatio: 4 / 3, backgroundColor: C.cardAlt }}>
              {YOGA_IMAGES[a.id] ? <Image source={YOGA_IMAGES[a.id]} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} /> : <Text style={{ fontSize: 40, textAlign: 'center', marginTop: 28 }}>🧘</Text>}
              {routine ? <View style={{ position: 'absolute', top: 8, left: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: C.white, fontSize: F.tiny, fontWeight: '800' }}>{i + 1}</Text></View> : null}
            </View>
            <View style={{ padding: 10, gap: 2 }}>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '700' }} numberOfLines={1}>{asanaName(a, lang)}</Text>
              <Text style={{ color: C.textDim, fontSize: F.tiny }} numberOfLines={1}>{lang === 'en' ? a.sanskrit : a.name_en}</Text>
              <Row style={{ gap: 6, marginTop: 4 }}>
                <Text style={{ color: a.level === 1 ? C.green : a.level === 2 ? C.amber : C.red, fontSize: F.tiny, fontWeight: '700' }}>{t(`yoga_l${a.level}`)}</Text>
                <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{`· ${a.minutes} ${t('act_min')}`}</Text>
              </Row>
            </View>
          </Pressable>
        ))}
      </View>

      <Sheet open={!!open} title={open ? asanaName(open, lang) : ''} onClose={() => setOpen(null)}>
        {open ? (
          <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 14, paddingBottom: 16 }}>
            <View style={{ aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', backgroundColor: C.cardAlt }}>
              {YOGA_IMAGES[open.id] ? <Image source={YOGA_IMAGES[open.id]} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={{ fontSize: 64, textAlign: 'center', marginTop: 60 }}>🧘</Text>}
            </View>
            <Row style={{ gap: 8, flexWrap: 'wrap' }}>
              <Pill label={open.sanskrit} active={false} onPress={() => {}} />
              <Pill label={lang === 'mr' ? open.name_en : open.name_mr} active={false} onPress={() => {}} />
              <Pill label={`${t(`yoga_l${open.level}`)} · ${open.minutes} ${t('act_min')}`} active={false} onPress={() => {}} />
            </Row>

            {/* Steps, one at a time with a big number, or all together: the phone is on the mat. */}
            <Micro>{t('yoga_steps')}</Micro>
            <Card still rail={C.accent}>
              <Row style={{ gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: C.white, fontSize: F.body, fontWeight: '800' }}>{step + 1}</Text>
                </View>
                <Text style={{ flex: 1, color: C.text, fontSize: F.body, lineHeight: 24 }}>{steps[step]}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <Btn small tone="soft" label={t('yoga_prev')} icon={<Ionicons name="chevron-back" size={14} color={C.text} />} onPress={() => setStep((s) => Math.max(0, s - 1))} />
                <Micro color={C.textFaint}>{`${step + 1} / ${steps.length}`}</Micro>
                <Btn small tone={step < steps.length - 1 ? 'primary' : 'soft'} label={t('yoga_next')} icon={<Ionicons name="chevron-forward" size={14} color={step < steps.length - 1 ? C.white : C.text} />} onPress={() => setStep((s) => Math.min(steps.length - 1, s + 1))} />
              </Row>
            </Card>
            <View style={{ gap: 6 }}>
              {steps.map((s, i) => (
                <Pressable key={i} onPress={() => setStep(i)} style={{ flexDirection: 'row', gap: 10, opacity: i === step ? 1 : 0.6 }}>
                  <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '800', width: 20 }}>{i + 1}</Text>
                  <Text style={{ flex: 1, color: C.text, fontSize: F.small, lineHeight: 20 }}>{s}</Text>
                </Pressable>
              ))}
            </View>

            <Micro>{t('yoga_benefits')}</Micro>
            <Small color={C.text}>{open.benefits[lang]}</Small>
            <Row style={{ gap: 8, alignItems: 'flex-start' }}>
              <Ionicons name="alert-circle-outline" size={18} color={C.amber} />
              <View style={{ flex: 1 }}>
                <Micro color={C.amber}>{t('yoga_caution')}</Micro>
                <Small color={C.textDim}>{open.caution[lang]}</Small>
                {open.avoidIf.length ? <Small color={C.textFaint}>{`${t('yoga_avoid_if')}: ${open.avoidIf.map((f) => t(`yoga_f_${f}`)).join(', ')}`}</Small> : null}
              </View>
            </Row>
            <Btn label={fill(t('yoga_log_min'), { n: open.minutes })} icon={<Ionicons name="checkmark" size={16} color={C.white} />} onPress={() => log(open, open.minutes)} />
          </ScrollView>
        ) : null}
      </Sheet>
    </View>
  );
}
