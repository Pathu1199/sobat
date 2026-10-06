import React, { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localHHMM, toISODate } from '../../core/date';
import { newId } from '../../core/id';
import { HELPLINES, isCrisisText } from '../../core/guardrails';
import { CravingSOS } from '../../components/CravingSOS';
import { Reframe } from '../../components/Reframe';
import { TopBarActions } from '../../components/TopBarActions';
import { makeT } from '../../i18n';
import { useApp } from '../../store/AppProvider';
import { Face } from '../../ui/Face';
import { Btn, Card, Divider, Field, ListRow, Micro, P, Row, SectionHeader, Small } from '../../ui/components';
import { PressScale } from '../../ui/PressScale';
import { C, F, S } from '../../ui/theme';
import { Cols } from '../../ui/tiles';
import { Page } from '../../ui/TopBar';
import { useBreakpoint } from '../../ui/useBreakpoint';

export default function MindScreen() {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [score, setScore] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [crisis, setCrisis] = useState(false);
  const [tool, setTool] = useState<'breathe' | 'grounding' | 'gratitude' | null>(null);
  const wide = useBreakpoint() === 'desktop';

  const todayMoods = app.state.moods.filter((m) => m.date === app.today);

  function save() {
    if (score === null) return;
    if (isCrisisText(note)) {
      // Shown by code, never left to the model to decide.
      setCrisis(true);
    }
    app.addMood({ id: newId(), at: new Date().toISOString(), date: toISODate(), score, note: note.trim() || undefined });
    setNote('');
    setScore(null);
  }

  const crisisCard = crisis ? (
    <Card tone={C.red}>
      <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{t('helpline_title')}</Text>
      <P>{t('helpline_body')}</P>
      {HELPLINES.map((h) => (
        <Pressable key={h.number} onPress={() => Linking.openURL(`tel:${h.number.replace(/-/g, '')}`)}>
          <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{h.name}</Text>
              <Small>{h.note}</Small>
            </View>
            <Text style={{ color: C.cyan, fontWeight: '600' }}>{h.number}</Text>
          </Row>
        </Pressable>
      ))}
      <Btn small tone="ghost" label={t('done')} onPress={() => setCrisis(false)} />
    </Card>
  ) : null;

  const checkIn = (
    <Card>
      <Micro>{t('mood_q')}</Micro>
      <Row style={{ justifyContent: 'space-between' }}>
        {[1, 2, 3, 4, 5].map((n, i) => (
          <Pressable key={n} onPress={() => setScore(i + 1)} accessibilityLabel={`${t('mood_q')} ${n}`}>
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: score === i + 1 ? C.accentDim : C.cardAlt,
                borderWidth: S.hairline,
                borderColor: score === i + 1 ? C.accent : C.border,
              }}>
              <Face score={i + 1} size={26} color={score === i + 1 ? C.accent : C.textDim} />
            </View>
          </Pressable>
        ))}
      </Row>
      <Field value={note} onChangeText={setNote} placeholder={t('mood_note')} multiline />
      <Btn label={t('save')} onPress={save} disabled={score === null} />
    </Card>
  );

  const toolTiles = (
    <Row style={{ gap: 8 }}>
      {(
        [
          { key: 'breathe', icon: 'cloud-outline', label: t('breathe') },
          { key: 'grounding', icon: 'hand-left-outline', label: t('grounding') },
          { key: 'gratitude', icon: 'sparkles-outline', label: t('gratitude') },
        ] as const
      ).map((x) => (
        <PressScale key={x.key} onPress={() => setTool(tool === x.key ? null : x.key)} style={{ flex: 1 }}>
          <View
            style={{
              backgroundColor: tool === x.key ? C.accentDim : C.card,
              borderWidth: S.hairline,
              borderColor: tool === x.key ? C.accent : C.border,
              borderRadius: S.radius,
              paddingVertical: 16,
              alignItems: 'center',
              gap: 8,
            }}>
            <Ionicons name={x.icon} size={20} color={tool === x.key ? C.accent : C.textDim} />
            <Text style={{ color: C.text, fontSize: F.small, fontWeight: '500' }}>{x.label}</Text>
          </View>
        </PressScale>
      ))}
    </Row>
  );

  const toolPanel = (
    <>
      {tool === 'breathe' ? <BreatheBox lang={lang} /> : null}
      {tool === 'grounding' ? <Grounding lang={lang} /> : null}
      {tool === 'gratitude' ? <Gratitude lang={lang} /> : null}
    </>
  );

  const entries =
    todayMoods.length > 0 ? (
      <View style={{ gap: 10 }}>
        <SectionHeader title={t('tab_today')} meta={`${todayMoods.length}`} />
        <Card>
          {todayMoods.map((m, i) => (
            <View key={m.id}>
              {i > 0 ? <Divider /> : null}
              <ListRow icon={<Face score={m.score} size={20} />} title={m.note || `${m.score} / 5`} sub={localHHMM(m.at)} />
            </View>
          ))}
        </Card>
      </View>
    ) : null;

  if (wide) {
    return (
      <Page title={t('mind_title')} alt={lang === 'en' ? undefined : t('mind_title')} right={<TopBarActions />} wide>
        {crisisCard}
        <Cols weights={[1.1, 1]}>
          <>
            {checkIn}
            {toolTiles}
            {toolPanel}
          </>
          <>
            {entries}
            <CravingSOS />
            <Reframe onCrisis={() => setCrisis(true)} />
          </>
        </Cols>
      </Page>
    );
  }

  return (
    <Page title={t('mind_title')} alt={lang === 'en' ? undefined : t('mind_title')} right={<TopBarActions />}>
      {crisisCard}
      {checkIn}
      {toolTiles}
      {toolPanel}
      <CravingSOS />
      <Reframe onCrisis={() => setCrisis(true)} />
      {entries}
    </Page>
  );
}

/** Box breathing, 4 seconds a side. Pure timer, no AI involved. */
function BreatheBox({ lang }: { lang: any }) {
  const t = makeT(lang);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [count, setCount] = useState(4);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (timer.current) clearInterval(timer.current);
      return;
    }
    timer.current = setInterval(() => {
      setCount((c) => {
        if (c > 1) return c - 1;
        setPhase((p) => (p + 1) % 4);
        return 4;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [running]);

  const labels = [t('breathe_in'), t('hold'), t('breathe_out'), t('hold')];
  const size = phase === 0 ? 1 : phase === 1 ? 1 : phase === 2 ? 0.6 : 0.6;

  return (
    <Card>
      <View style={{ alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <View
          style={{
            width: 140 * size,
            height: 140 * size,
            borderRadius: 999,
            backgroundColor: C.accentDim,
            borderWidth: 2,
            borderColor: C.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ color: C.text, fontSize: 28, fontWeight: '600' }}>{count}</Text>
        </View>
        <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{labels[phase]}</Text>
        <Btn small label={running ? t('stop') : t('start')} onPress={() => setRunning((r) => !r)} />
      </View>
    </Card>
  );
}

function Grounding({ lang }: { lang: any }) {
  const t = makeT(lang);
  const prompts =
    lang === 'mr'
      ? ['५ गोष्टी बघा', '४ गोष्टींना स्पर्श करा', '३ आवाज ऐका', '२ वास घ्या', '१ चव घ्या']
      : lang === 'hi'
        ? ['5 चीज़ें देखें', '4 चीज़ें छुएँ', '3 आवाज़ें सुनें', '2 गंध लें', '1 स्वाद लें']
        : ['Name 5 things you can see', 'Touch 4 things', 'Hear 3 sounds', 'Smell 2 things', 'Taste 1 thing'];
  const [step, setStep] = useState(0);
  return (
    <Card>
      <Micro>{t('grounding')}</Micro>
      <P>{prompts[step]}</P>
      <Row style={{ gap: 8 }}>
        <Btn small tone="ghost" label={t('next')} onPress={() => setStep((s) => (s + 1) % prompts.length)} />
        <Small>
          {step + 1} / {prompts.length}
        </Small>
      </Row>
    </Card>
  );
}

function Gratitude({ lang }: { lang: any }) {
  const app = useApp();
  const t = makeT(lang);
  const [lines, setLines] = useState(['', '', '']);
  const [saved, setSaved] = useState(false);

  function save() {
    const written = lines.map((l) => l.trim()).filter(Boolean);
    if (written.length === 0) return;
    // Stored as a day note, so it is still there tomorrow.
    app.rememberText(`grateful for: ${written.join('; ')}`, 'episode', 'user');
    setSaved(true);
  }

  return (
    <Card>
      <Micro>{t('gratitude')}</Micro>
      {lines.map((l, i) => (
        <Field
          key={i}
          value={l}
          onChangeText={(v) => {
            setSaved(false);
            setLines((x) => x.map((y, j) => (j === i ? v : y)));
          }}
          placeholder={`${i + 1}`}
        />
      ))}
      <Btn small label={t('save')} onPress={save} disabled={lines.every((l) => !l.trim())} />
      {saved ? <Small color={C.accent}>{t('gratitude_saved')}</Small> : null}
    </Card>
  );
}
