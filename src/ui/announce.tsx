import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Text, View, type ViewStyle } from 'react-native';
import { PAGE_REGION, sheetClosed, sheetClosing, sheetOpened, speaker, type OpenSheet } from './announceTarget';

/** On the page for a screen reader, off it for the eye. */
export const OFF_SCREEN: ViewStyle = { position: 'absolute', left: -10000, top: 0, width: 1, height: 1, overflow: 'hidden' };

/**
 * Says a line to a screen reader on the phone (iOS after what it is already
 * saying). Nothing on the web, which reads `useAnnounce`'s region instead.
 * Android's TalkBack drops a line said just before the focus moves, so a page
 * that moves the focus says the line after it, from the effect that moved it.
 */
export function sayOnPhone(text: string): void {
  if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibilityWithOptions(text, { queue: true });
  else if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(text);
}

/** A line said on the web: its words, a count so the same words said twice are read twice, and the region that says it. */
export type Said = { text: string; n: number; to: string };
const NOTHING_SAID: Said = { text: '', n: 0, to: PAGE_REGION };

/** How long a line stays in a region with nothing on screen to match it, long enough to be read once; then the region is empty again. */
export const ANNOUNCE_HOLD_MS = 5000;

// The sheets on the page on the web, open or sliding out, newest last (announceTarget.ts). Kept outside React: a sheet opening or closing re-renders nothing.
let openSheets: OpenSheet[] = [];

/** How often a line waiting for a closing sheet to leave the page looks again, in ms. */
const SHEET_WAIT_STEP_MS = 50;

/** The app's announcements (FeedbackProvider's), for the region inside each sheet. */
const SaidCtx = createContext<Said>(NOTHING_SAID);
export const SaidProvider = SaidCtx.Provider;

/**
 * Says a line to a screen reader. The phone says it at once (iOS after what it
 * is already saying, so a focus moved at the same moment does not cut it
 * off). The web has no such call: the line goes into a region kept on the
 * page from the start, empty until then, which the browser reads whenever its
 * words appear, and leaves it after `holdMs`, so someone reading to the end of
 * the page later does not meet stale words; `clear` empties it at once. Render
 * `region` once, anywhere on the page; it is null on the phone. With
 * `throughSheets` (the toasts' own announcements), while a sheet is open the
 * line is said from the region inside the top-most one (`useSheetRegion`),
 * since some screen readers hear nothing outside an open dialog. A sheet the
 * same tap closed stays on the page while it slides out, its dialog still
 * marked modal, so the line waits until it has gone (a second at most) and is
 * then said from the page, or from the sheet under it.
 */
export function useAnnounce(throughSheets = false): { announce: (text: string, holdMs?: number) => void; clear: () => void; region: React.ReactElement | null; said: Said } {
  const [said, setSaid] = useState<Said>(NOTHING_SAID);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The same functions every render, so a callback built on them stays the same too.
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaid((s) => (s.text ? { ...s, text: '' } : s));
  }, []);
  const announce = useCallback(
    (text: string, holdMs: number = ANNOUNCE_HOLD_MS) => {
      if (Platform.OS !== 'web') {
        sayOnPhone(text);
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      const say = () => {
        const to = throughSheets ? speaker(openSheets, Date.now()) : PAGE_REGION;
        if (to === null) {
          // The top-most sheet is still sliding out: look again in a moment.
          timer.current = setTimeout(say, SHEET_WAIT_STEP_MS);
          return;
        }
        setSaid((s) => ({ text, n: s.n + 1, to }));
        timer.current = setTimeout(() => {
          timer.current = null;
          setSaid((s) => ({ ...s, text: '' }));
        }, holdMs);
      };
      // A moment after the call, so a sheet the same tap closed is already counted as closing.
      timer.current = setTimeout(say, 0);
    },
    [throughSheets],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // A new line each time, so the same words said twice are read twice.
  const region =
    Platform.OS === 'web' ? (
      <View aria-live="polite" style={OFF_SCREEN}>
        <Text key={said.n}>{said.to === PAGE_REGION ? said.text : ''}</Text>
      </View>
    ) : null;
  return { announce, clear, region, said };
}

/**
 * The region a sheet carries on the web, inside its dialog, empty unless it
 * is the top-most open sheet when the app says something (`useAnnounce` with
 * `throughSheets`), and the `onDismiss` its Modal calls once its dialog has
 * left the page. Counts the sheet as open while `open`, and as closing from
 * then until that `onDismiss` (or until it unmounts), since react-native-web
 * keeps the dialog on the page while it slides out. Null and undefined on the
 * phone, which says lines with `sayOnPhone` and never waits.
 */
export function useSheetRegion(open: boolean): { region: React.ReactElement | null; onDismiss: (() => void) | undefined } {
  const id = useId();
  useEffect(() => {
    if (Platform.OS !== 'web' || !open) return;
    openSheets = sheetOpened(openSheets, id);
    return () => {
      openSheets = sheetClosing(openSheets, id, Date.now());
    };
  }, [open, id]);
  // Unmounted, the dialog goes with it at once, and its Modal calls no onDismiss.
  useEffect(
    () => () => {
      openSheets = sheetClosed(openSheets, id);
    },
    [id],
  );
  const onDismiss = useCallback(() => {
    openSheets = sheetClosed(openSheets, id);
  }, [id]);
  return Platform.OS === 'web' ? { region: <SheetRegion id={id} />, onDismiss } : { region: null, onDismiss: undefined };
}

/** The region itself, the only part that reads the announcements, so a line said renders nothing else again. */
function SheetRegion({ id }: { id: string }) {
  const said = useContext(SaidCtx);
  return (
    <View aria-live="polite" style={OFF_SCREEN}>
      <Text key={said.n}>{said.to === id ? said.text : ''}</Text>
    </View>
  );
}

/**
 * Whether a screen reader is on, kept up to date as it is switched on or off.
 * False until the phone has answered. The web cannot tell, and react-native-web
 * answers true, so there the app always leaves the time a screen reader needs.
 */
export function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((v) => {
        if (live) setOn(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', (v: boolean) => setOn(v));
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);
  return on;
}
