import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useAddSheet } from '../../components/AddSheet';
import { isIsoDate } from '../../core/date';
import { useApp } from '../../store/AppProvider';
import { C } from '../../ui/theme';

/**
 * The old Log address. Adding food happens in the ➕ sheet now, so a link to
 * /log (the coach line, a reminder, an older screen) opens that sheet for the
 * day and slot it names, with Today showing that day behind it.
 */
export default function LogRoute() {
  const app = useApp();
  const router = useRouter();
  const addSheet = useAddSheet();
  const { date, slot } = useLocalSearchParams<{ date?: string; slot?: string }>();
  const today = app.today;
  const day = isIsoDate(date) ? date : today;
  const slotId = typeof slot === 'string' ? slot : undefined;
  useFocusEffect(
    useCallback(() => {
      // After this commit, as the section links do: on a cold load the web address follows the navigation only
      // after the screens' first effects, so a change made in one would never leave /log in the address.
      const id = setTimeout(() => {
        addSheet.open({ date: day, slotId });
        router.replace(day === today ? '/' : { pathname: '/', params: { date: day } });
      }, 0);
      return () => clearTimeout(id);
    }, [addSheet, router, day, slotId, today]),
  );
  return <View style={{ flex: 1, backgroundColor: C.bg }} />;
}
