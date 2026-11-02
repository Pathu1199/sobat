import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useMemo, useReducer, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { toTabs } from '../components/toTabs';
import { periodOf, periodReport, periodSteps, compareReport, type ReportKind, type ReportPeriod } from '../core/report';
import { reportColors, reportDoc, statLines, type DocStat } from '../core/reportDoc';
import { calorieBars, dayStats, dayWord, headline, medalLine, pdfStep, periodName, reportView, stepAnchor, switchAnchor, type Headline, type PdfState, type ReportView } from '../core/reportScreen';
import { stripSince } from '../core/weekStrip';
import { fill, makeT, numberText } from '../i18n';
import { prepareReport, shareReport, type PreparedReport } from '../services/reportPdf';
import { useApp } from '../store/AppProvider';
import { useReportInput } from '../store/useReportInput';
import { BarChart } from '../ui/charts';
import { Bar, Btn, Card, Divider, Micro, Screen, Segmented, Small } from '../ui/components';
import { IconButton } from '../ui/IconButton';
import { C, F, GOLD_NOTE, lh, S, TITLE_WEIGHT } from '../ui/theme';
import { spokenLine } from '../ui/toastWords';

type T = (key: string) => string;

const ICONS: Record<DocStat['id'], keyof typeof Ionicons.glyphMap> = {
  meals: 'restaurant-outline',
  perfect: 'star-outline',
  kcal: 'flame-outline',
  protein: 'nutrition-outline',
  water: 'water-outline',
  walk: 'walk-outline',
  jobs: 'book-outline',
  weight: 'scale-outline',
};

/** What the chevrons are called, by the period they step: the words the strip and the calendar already use for a week and a month. */
function stepWords(kind: ReportKind, t: T): { prev: string; next: string } {
  if (kind === 'day') return { prev: t('rep_prev_day'), next: t('rep_next_day') };
  if (kind === 'week') return { prev: t('strip_prev_week'), next: t('strip_next_week') };
  return { prev: t('progress_prev_month'), next: t('progress_next_month') };
}

/** A pause for the screen to draw ("Preparing…") before the PDF's work, which holds the page for a moment on the web, begins. */
const afterPaint = () => new Promise<void>((resolve) => setTimeout(resolve, 50));

/** The file the web's first tap made, with the title its Share sheet is given on the second. */
type Made = { file: PreparedReport; dialogTitle: string };

/** The period a prepared PDF belongs to: a result or a file for another one is not this one's. */
const pdfKeyOf = (p: ReportPeriod) => `${p.kind}:${p.start}`;

/**
 * Reports: a day, a week or a month, read the way Progress reads a day (core/report.ts), with the figures against the day, week or
 * month before, the best day, the calories, the perfect-week medals and, for a month, a PDF to share. `/reports?p=week&d=2026-11-02`
 * opens on the period holding that day (week and today when the link says nothing usable); the chevrons and the switch move from there.
 */
export default function Reports() {
  const app = useApp();
  const params = useLocalSearchParams<{ p?: string | string[]; d?: string | string[] }>();
  const { state, today } = app;
  const lang = state.profile.lang;
  const t = useMemo(() => makeT(lang), [lang]);

  // The view the address names, and where the person has moved it since; a new address replaces what they moved.
  const since = useMemo(() => stripSince(state.profile, state.meals, today), [state.profile, state.meals, today]);
  const opened = useMemo(() => reportView(params.p, params.d, today, since), [params.p, params.d, today, since]);
  const [moved, setMoved] = useState<{ from: ReportView; to: ReportView } | null>(null);
  const view = moved && moved.from.kind === opened.kind && moved.from.anchor === opened.anchor ? moved.to : opened;
  const go = (to: ReportView) => {
    setMoved({ from: opened, to });
    // A file made for the month left is not offered again on coming back to it: the days may have changed since.
    dispatchPdf({ type: 'period', key: pdfKeyOf(periodOf(to.kind, to.anchor)) });
  };

  const period = useMemo(() => periodOf(view.kind, view.anchor), [view.kind, view.anchor]);
  const { input, medalsHeld } = useReportInput(period);
  const report = useMemo(() => periodReport(period, input), [period, input]);
  const before = useMemo(() => compareReport(report, input), [report, input]);
  const steps = periodSteps(period, today, input.since);
  const running = period.dates.includes(today);
  const words = stepWords(period.kind, t);
  const name = periodName(period, today, lang, t);
  const day = report.days[0];

  const rows = useMemo(
    () => (period.kind === 'day' ? dayStats(day, before?.days[0] ?? null, input.goals, input.weights, t) : statLines(report, before, input.goals, t, running).filter((s) => s.id !== 'perfect')),
    [period.kind, day, report, before, input.goals, input.weights, running, t],
  );

  const pdfKey = pdfKeyOf(period);
  const [pdf, dispatchPdf] = useReducer(pdfStep<Made>, { key: pdfKey, status: 'idle' } as PdfState<Made>);
  // A state for another period (the address moved it, not a chevron) is no state for this one.
  const here = pdf.key === pdfKey ? pdf : null;
  const palette = state.settings.palette;
  const makePdf = async () => {
    const key = pdfKey;
    try {
      if (here?.status === 'ready') {
        // The web's second tap: the file is made, and a tap is what lets the browser share it.
        await shareReport(here.prepared.file, here.prepared.dialogTitle);
        return;
      }
      dispatchPdf({ type: 'start', key });
      const doc = reportDoc({ report, before, goals: input.goals, name: state.profile.name, lang, medalsHeld, madeOn: today });
      const dialogTitle = `${doc.title} ${doc.month}`;
      await afterPaint();
      const file = await prepareReport(doc, reportColors(palette));
      if (file.kind === 'web') {
        dispatchPdf({ type: 'ready', key, prepared: { file, dialogTitle } });
        return;
      }
      // The phone apps make it and open the Share sheet on one tap.
      dispatchPdf({ type: 'done', key });
      await shareReport(file, dialogTitle);
    } catch {
      dispatchPdf({ type: 'fail', key });
    }
  };
  const pdfLabel =
    here?.status === 'busy' ? t('rep_pdf_preparing') : here?.status === 'ready' ? t(here.prepared.file.kind === 'web' && here.prepared.file.canShare ? 'rep_pdf_share' : 'rep_pdf_save') : t('rep_pdf_button');

  const head = report.counted > 0 && period.kind !== 'day' ? headline(report, lang, t, running) : null;
  const medals = period.kind !== 'day' ? medalLine(report, t) : null;
  const chart = period.kind !== 'day' ? calorieBars(report, t) : null;
  // What a period that holds no day that counts says in place of its cards: a day says what it is (free, not started), the rest "nothing yet".
  const nothing = period.kind === 'day' ? dayWord(day, t) : t(period.kind === 'week' ? 'rep_none_week' : 'rep_pdf_nothing');

  return (
    <Screen>
      <Segmented<ReportKind>
        value={view.kind}
        onChange={(kind) => go({ kind, anchor: switchAnchor(view, kind, today, since) })}
        options={[
          { key: 'day', label: t('rep_day') },
          { key: 'week', label: t('period_week') },
          { key: 'month', label: t('period_month') },
        ]}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {steps.prev ? <IconButton name="chevron-back" label={words.prev} onPress={() => go({ kind: view.kind, anchor: stepAnchor(period, -1, today) })} /> : <View style={{ width: S.touch, height: S.touch }} />}
        <Text accessibilityRole="header" style={{ flex: 1, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {name}
        </Text>
        {steps.next ? <IconButton name="chevron-forward" label={words.next} onPress={() => go({ kind: view.kind, anchor: stepAnchor(period, 1, today) })} /> : <View style={{ width: S.touch, height: S.touch }} />}
      </View>

      {report.counted === 0 ? (
        <Small color={C.textDim}>{nothing}</Small>
      ) : (
        <>
          {head ? <HeadlineCard head={head} /> : <DayCard word={dayWord(day, t)} perfect={day.perfect} t={t} />}

          {rows.length > 0 ? (
            <Card>
              {rows.map((row, i) => (
                <React.Fragment key={row.id}>
                  {i > 0 ? <Divider /> : null}
                  <StatRow row={row} />
                </React.Fragment>
              ))}
            </Card>
          ) : null}

          {chart ? (
            <Card>
              {/* The bars are a picture to a screen reader: one line says what they show (the PDF's caption, and its goal). */}
              <View accessible accessibilityRole="image" accessibilityLabel={fill(t('rep_chart_caption'), { goal: numberText(input.goals.kcal) })} style={{ gap: 12 }}>
                <Micro color={C.textDim}>{t('calories')}</Micro>
                <BarChart
                  data={chart.bars}
                  labels={chart.labels}
                  target={input.goals.kcal}
                  color={C.accent}
                  overColor={C.accent}
                  format={(v) => fill(t('rep_goal_only'), { goal: `${numberText(v)} kcal` })}
                />
              </View>
            </Card>
          ) : null}

          {medals ? (
            <View accessible accessibilityRole="text" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C[GOLD_NOTE.fill], borderRadius: S.radiusXs, paddingHorizontal: 10, paddingVertical: 6 }}>
              <Ionicons name="ribbon-outline" size={14} color={C[GOLD_NOTE.words]} />
              <Text style={{ flexShrink: 1, color: C[GOLD_NOTE.words], fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{medals}</Text>
            </View>
          ) : null}

          {period.kind === 'month' ? (
            <View>
              <Btn label={pdfLabel} tone="primary" disabled={here?.status === 'busy'} onPress={makePdf} icon={<Ionicons name="document-text-outline" size={18} color={C.onAccent} />} />
              {/* Always there, even empty, so a screen reader hears the line as it appears. */}
              <View aria-live="polite" style={{ paddingTop: here?.status === 'error' ? 8 : 0 }}>
                {here?.status === 'error' ? <Small color={C.textDim}>{t('rep_pdf_error')}</Small> : null}
              </View>
            </View>
          ) : null}
        </>
      )}

      <Pressable onPress={() => toTabs('/growth', false)} accessibilityRole="link" style={({ pressed }) => ({ alignSelf: 'center', minHeight: S.touch, justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
        <Micro color={C.textDim}>{`${t('rep_all_charts')} ›`}</Micro>
      </Pressable>
    </Screen>
  );
}

/** The card over a week or a month: the full days as the one big number, the perfect days in the reward colours, and the best day. */
function HeadlineCard({ head }: { head: Headline }) {
  return (
    <Card>
      <View accessible accessibilityRole="text" accessibilityLabel={spokenLine([head.spoken, head.perfect, head.best?.text])} style={{ gap: 8 }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: TITLE_WEIGHT, fontVariant: ['tabular-nums'] }}>{head.big}</Text>
          <Small color={C.textDim}>{head.label}</Small>
        </View>
        {head.perfect ? <GoldLine text={head.perfect} /> : null}
        {head.best ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {head.best.perfect ? <Ionicons name="star" size={14} color={C[GOLD_NOTE.words]} /> : null}
            <Small color={C.textDim}>{head.best.text}</Small>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

/** The card over a day: its mark in words, and a gold line when it was a perfect day. */
function DayCard({ word, perfect, t }: { word: string; perfect: boolean; t: T }) {
  return (
    <Card>
      <View accessible accessibilityRole="text" accessibilityLabel={spokenLine([word, perfect ? t('perfect_day') : null])} style={{ gap: 8 }}>
        <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>{word}</Text>
        {perfect ? <GoldLine text={t('perfect_day')} /> : null}
      </View>
    </Card>
  );
}

/** A star and a few words on the reward fill, the way Today's teacher card says a best day. */
function GoldLine({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: C[GOLD_NOTE.fill], borderRadius: S.radiusXs, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Ionicons name="star" size={14} color={C[GOLD_NOTE.words]} />
      <Text style={{ flexShrink: 1, color: C[GOLD_NOTE.words], fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{text}</Text>
    </View>
  );
}

/**
 * One figure of the goals card: its icon, its name over what the goal is, the value, a thin bar toward the goal where there is one, and
 * the line against the period before. A rise in a count that is good to have more of is in the accent; a fall, no change and the plain
 * numbers are muted, never amber or red.
 */
function StatRow({ row }: { row: DocStat }) {
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={spokenLine([row.label, row.value, row.sub, row.delta?.text])} style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={ICONS[row.id]} size={16} color={C.accentText} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{row.label}</Text>
          {row.sub ? <Micro color={C.textDim}>{row.sub}</Micro> : null}
        </View>
        <Text style={{ flexShrink: 0, maxWidth: '45%', textAlign: 'right', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{row.value}</Text>
      </View>
      {row.bar !== null || row.delta ? (
        // Under the label, so the bar and the comparison read as part of this figure and not the next.
        <View style={{ marginLeft: 44, gap: 6 }}>
          {row.bar !== null ? <Bar value={row.bar} max={1} color={row.barTone === 'faint' ? C.textFaint : C.accent} /> : null}
          {row.delta ? <Micro color={row.delta.good ? C.accentText : C.textDim}>{row.delta.text}</Micro> : null}
        </View>
      ) : null}
    </View>
  );
}
