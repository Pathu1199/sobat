import { useFocusEffect, useLocalSearchParams, useNavigation, useRoute } from 'expo-router';
import React, { useCallback } from 'react';
import { View } from 'react-native';
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
 * the link; should Back bring /log into view again all the same (a browser's
 * own history can), the link is not handled twice: /log steps back past
 * itself, or hands over to Today with nothing behind it.
 */
export default function LogRoute() {
  const app = useApp();
  const navigation = useNavigation();
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
        // Today in front (for the link's day, when the sheet opens), and /log off the way back.
        // (The tab bar's own state, typed loosely by getState and strictly by reset, so it is cast back.)
        const tabs = navigation.getState();
        if (tabs) navigation.reset(handOff(tabs, key, 'index', step === 'open' ? (day === today ? {} : { date: day }) : undefined) as Parameters<typeof navigation.reset>[0]);
      }, 0);
      return () => clearTimeout(id);
    }, [addSheet, navigation, link, key, day, slotId, today]),
  );
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
