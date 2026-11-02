import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import { type ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import { PuzzleTile } from '../components/PuzzleTile';
import { toTabs } from '../components/toTabs';
import { ZipBoard } from '../components/ZipBoard';
import type { PuzzleToday } from '../core/puzzleDay';
import { boardPx, boardSide, canUndo, cardWords, keepPlay, keptPlay, leavePlay, levelLine, NEW_PLAY, playSeconds, playStep, puzzleBuilt, puzzleCached, timeText, type Built } from '../core/puzzleScreen';
import type { ISODate } from '../core/types';
import { clampLevel, isLevel, LEVELS, type ZipLevel } from '../core/zip';
import { fill, makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { usePuzzleToday } from '../store/usePuzzleToday';
import { Btn, Card, Screen, Small } from '../ui/components';
import { SheetFrame } from '../ui/Sheet';
import { C, F, lh, S, TITLE_WEIGHT } from '../ui/theme';

type T = (key: string) => string;

/**
 * Today's puzzle: a Zip path puzzle, the Routine's reward and never required. Closed, it says kindly when it opens and sends the user
 * back to Routine. Open, it shows the board (built from the date and the level alone, so it is the same on the phone and the website)
 * with the clock, Undo and Start again; a line that wins turns gold, is saved once with its time, and says so in a sheet. A day already
 * solved shows the board with its one answer drawn in gold, and the time it took. The line in progress is kept when the user leaves
 * (Back, a back swipe, a sync turning the day) and is there when they come back; it is forgotten when it wins.
 */
export default function PuzzleScreen() {
  const app = useApp();
  const today = usePuzzleToday();
  const t = makeT(app.state.profile.lang);
  if (today.kind === 'closed') return <Closed today={today} t={t} />;
  // Keyed on the day, so a screen left open past midnight starts the new day's puzzle. It stays mounted when solving flips the day to
  // solved, so the line just drawn and its sheet stay where they are.
  return <Play key={app.today} date={app.today} today={today} t={t} />;
}

/** The puzzle is not open yet: when it opens, in a kind line, and the way back to Routine. */
function Closed({ today, t }: { today: Extract<PuzzleToday, { kind: 'closed' }>; t: T }) {
  const words = cardWords(today, t);
  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <PuzzleTile tone={words.tone} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
              {words.title}
            </Text>
            <Small color={C.textDim}>{words.line}</Small>
          </View>
        </View>
      </Card>
      <Btn label={t('zip_to_routine')} onPress={() => toTabs('/abhyas', false)} />
    </Screen>
  );
}

/** How long the board may take before "Preparing…" is said, in ms: a build is a few milliseconds to a fraction of a second, and a word that flashes for less is worse than none. */
const PREPARING_AFTER_MS = 150;

/**
 * The puzzle for a date and level, with its answer: at once when it was built before (the cache in core, and the Routine card warms it),
 * otherwise after the first paint (a frame, then a turn of the event loop, with no wait on top), so the build never holds up the screen's
 * first draw. `built` is null until it is there, and `late` says it has taken longer than `PREPARING_AFTER_MS`, which is when the
 * place held for the board starts to say "Preparing…".
 */
function usePuzzle(date: ISODate, level: ZipLevel): { built: Built | null; late: boolean } {
  const [built, setBuilt] = useState<Built | null>(() => puzzleCached(date, level) ?? null);
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (built) return;
    let turn: ReturnType<typeof setTimeout> | undefined;
    const frame = requestAnimationFrame(() => {
      turn = setTimeout(() => setBuilt(puzzleBuilt(date, level)), 0);
    });
    const slow = setTimeout(() => setLate(true), PREPARING_AFTER_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(turn);
      clearTimeout(slow);
    };
  }, [built, date, level]);
  return { built, late };
}

/** The game: the board and what goes with it, for a day that is open or solved. */
function Play({ date, today, t }: { date: ISODate; today: Extract<PuzzleToday, { kind: 'open' | 'solved' }>; t: T }) {
  const app = useApp();
  const { haptic } = useFeedback();
  const { width } = useWindowDimensions();
  // The level the puzzle opened at, kept for the whole visit: the streak can move while the user plays (another device's ticks
  // syncing in), and the puzzle under their finger must not. A solved day opens at the level it was solved at, which a newer build
  // may have saved at a level this one lacks: that one is built at the nearest level it has, with its numbers only (not the answer,
  // which is not the puzzle the user solved).
  const [stored] = useState(today.level);
  const level = clampLevel(stored);
  const exact = isLevel(stored);
  const { built, late } = usePuzzle(date, level);
  const puzzle = built?.puzzle ?? null;
  // The line is kept when the user leaves and read back when they come: the play starts from what was kept for this day and level.
  // The time away is not counted: leaving notes when, and coming back moves the clock on by it.
  const [play, dispatch] = useReducer(playStep, { date, level }, (o) => keptPlay(o.date, o.level, Date.now()) ?? NEW_PLAY);
  useEffect(() => {
    keepPlay(date, level, play);
  }, [date, level, play]);
  useEffect(() => () => leavePlay(date, level, Date.now()), [date, level]);
  const [sheetClosed, setSheetClosed] = useState(false);
  const scrollRef = useRef<GestureScrollView>(null);

  // Won in this visit: the seconds it took, whole. A day solved before the visit (or on another device) is locked all the same.
  const took = playSeconds(play);
  const won = took !== null;
  const complete = won || today.kind === 'solved';
  const seconds = took ?? (today.kind === 'solved' ? today.seconds : 0);
  // What is drawn: the line played; on a day solved before, its one answer in gold (the puzzle has no other), or none when it is a level this build lacks.
  const line = won ? play.path : complete ? (built && exact ? built.path : []) : play.path;

  // The record is saved once, with a light tap on the phone. `solvePuzzle` keeps the faster time of a day solved twice, so a repeat would
  // do no harm, but the effect runs again as the store changes under it, so the tap is guarded.
  const reported = useRef(false);
  useEffect(() => {
    if (took === null || reported.current) return;
    reported.current = true;
    app.solvePuzzle({ date, seconds: took, level });
    haptic('success');
  }, [took, app, date, level, haptic]);

  const side = boardSide(width, S.gutter);
  // The same function from one render to the next (it changes only with the puzzle), so the board's squares stay as they are between steps.
  const reach = useCallback(
    (cell: number) => {
      if (puzzle) dispatch({ type: 'reach', puzzle, cell, now: Date.now() });
    },
    [puzzle],
  );

  return (
    <Screen scrollRef={scrollRef}>
      {complete ? (
        <SolvedNote seconds={seconds} level={level} t={t} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Small color={C.textDim}>{levelLine(level, t)}</Small>
          </View>
          <Clock startedAt={play.startedAt} />
        </View>
      )}

      {puzzle ? (
        <ZipBoard puzzle={puzzle} path={line} onReach={reach} locked={complete} solved={complete} width={side} scrollRef={scrollRef} />
      ) : (
        <Preparing size={LEVELS[level].size} width={side} label={late ? t('zip_preparing') : null} />
      )}

      {complete ? null : (
        <>
          {puzzle ? (
            <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{fill(t('zip_how'), { n: puzzle.last })}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn
              label={t('undo')}
              tone="soft"
              disabled={!canUndo(play)}
              onPress={() => dispatch({ type: 'undo' })}
              icon={<Ionicons name="arrow-undo-outline" size={18} color={C.accentText} />}
              style={{ flex: 1 }}
            />
            <Btn
              label={t('zip_start_again')}
              tone="soft"
              disabled={play.path.length === 0}
              onPress={() => dispatch({ type: 'again' })}
              icon={<Ionicons name="refresh-outline" size={18} color={C.accentText} />}
              style={{ flex: 1 }}
            />
          </View>
        </>
      )}

      <SheetFrame open={won && !sheetClosed} onClose={() => setSheetClosed(true)}>
        <View style={{ padding: S.padLg, paddingTop: 28, alignItems: 'center', gap: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.goldSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark-circle" size={44} color={C.goldInk} />
          </View>
          <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: TITLE_WEIGHT, textAlign: 'center' }}>
            {fill(t('zip_solved_in'), { time: timeText(seconds) })}
          </Text>
          <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body), textAlign: 'center' }}>{t('zip_new_tomorrow')}</Text>
          <Btn label={t('done')} onPress={() => setSheetClosed(true)} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </View>
      </SheetFrame>
    </Screen>
  );
}

/**
 * The time since the first square, m:ss in the accent, ticking each second while the clock runs. It owns its tick, so the board does not
 * draw again every second.
 */
function Clock({ startedAt }: { startedAt: number | null }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (startedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  // `now` is older than a clock just started until its first tick, which reads as 0:00.
  const ms = startedAt === null ? 0 : Math.max(0, now - startedAt);
  return (
    <Text accessibilityRole="timer" style={{ color: C.accentText, fontSize: F.title, lineHeight: lh(F.title, true), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
      {timeText(ms / 1000)}
    </Text>
  );
}

/** A solved day, in the reward colours: a check, "Solved in 1:23", and that a new puzzle comes tomorrow. */
function SolvedNote({ seconds, level, t }: { seconds: number; level: ZipLevel; t: T }) {
  const words = cardWords({ kind: 'solved', level, seconds }, t);
  return (
    <Card style={{ backgroundColor: C.goldSoft }}>
      <View accessible accessibilityRole="text" accessibilityLabel={`${words.title}. ${words.line}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ionicons name="checkmark-circle" size={28} color={C.goldInk} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{words.title}</Text>
          <Text style={{ color: C.goldInk, fontSize: F.small, lineHeight: lh(F.small) }}>{words.line}</Text>
        </View>
      </View>
    </Card>
  );
}

/** The board's place, held while the puzzle is built so the page does not move when it arrives; it says "Preparing…" only when told to (a build that is slow). */
function Preparing({ size, width, label }: { size: number; width: number; label: string | null }) {
  const px = boardPx(width, size);
  return (
    <View style={{ alignSelf: 'center', width: px, height: px, borderRadius: S.radiusSm, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', ...S.shadow }}>
      {label ? <Small color={C.textDim}>{label}</Small> : null}
    </View>
  );
}
