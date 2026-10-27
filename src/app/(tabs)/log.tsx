import { useFocusEffect, useLocalSearchParams, useNavigation, useRoute, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Platform, View } from 'react-native';
import { useAddSheet } from '../../components/AddSheet';
import { isIsoDate } from '../../core/date';
import { handOff, logLinkStep } from '../../core/logLink';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';

// The links /log has handled while the app runs, so none opens the sheet twice (core/logLink.ts).
const handled = new WeakSet<object>();

/**
 * The old Log address. Adding food happens in the ➕ sheet now, so a link to
 * /log (the coach line, a reminder, an older screen) opens that sheet for the
 * day and slot it names, with Today showing that day behind it. /log then
 * leaves the way back, so Back from Today goes where the person was before
 * the link: on a phone by taking itself off the tab bar's way back, on the
 * web by a replace, as the browser's Back follows the addresses it recorded.
 * Should Back bring /log into view again all the same, the link is not
 * handled twice: /log steps back past itself, or hands over to Today with
 * nothing behind it.
 */
export default function LogRoute() {
  const app = useApp();
  const navigation = useNavigation();
  const router = useRouter();
  const route = useRoute();
  const addSheet = useAddSheet();
  const { date, slot } = useLocalSearchParams<{ date?: string; slot?: string }>();
  const today = app.today;
  const day = isIsoDate(date) ? date : today;
  const slotId = typeof slot === 'string' ? slot : undefined;
  // Following an address brings new params (a new route when it has none); going back brings the same ones.
  const link: object = route.params ?? route;
  const key = route.key;
  useFocusEffect(
    useCallback(() => {
      // After this commit, as the section links do: on a cold load the web address follows the navigation only
      // after the screens' first effects, so a change made in one would never leave /log in the address.
      const id = setTimeout(() => {
        const step = logLinkStep(link, handled, navigation.canGoBack());
        if (step === 'back') {
          navigation.goBack();
          return;
        }
        if (step === 'open') {
          handled.add(link);
          addSheet.open({ date: day, slotId });
        }
        if (Platform.OS === 'web') {
          // The browser's Back replays the addresses it recorded, not the tab bar's way back, so the replace takes /log
          // out of the browser's history and Back cannot loop here. A reset would shorten the tab bar's way back,
          // which the web's history follows by stepping the browser back.
          router.replace(day === today ? '/' : { pathname: '/', params: { date: day } });
          return;
        }
        // On a phone, Today in front (for the link's day, when the sheet opens), and /log off the tab bar's way back.
        // This rests on the tab router's own state: handOff (core/logLink.ts) rewrites its internal `history`, a list
        // of { type: 'route', key } entries (expo-router's build/react-navigation/routers/TabRouter.js, ~57.0); were
        // that shape to change, /log would stay on the way back and the step back above is the safety net.
        // (The tab bar's own state, typed loosely by getState and strictly by reset, so it is cast back.)
        const tabs = navigation.getState();
        if (tabs) navigation.reset(handOff(tabs, key, 'index', step === 'open' ? (day === today ? {} : { date: day }) : undefined) as Parameters<typeof navigation.reset>[0]);
      }, 0);
      return () => clearTimeout(id);
    }, [addSheet, navigation, router, link, key, day, slotId, today]),
  );
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
