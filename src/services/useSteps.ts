import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useApp } from '../store/AppProvider';

/**
 * Reads today's step count from the phone's own pedometer. No permission
 * prompt until the first read, and it simply does nothing where there is no
 * such sensor, which includes every browser.
 */
export function useSteps() {
  const app = useApp();
  const setSteps = useRef(app.setSteps);
  setSteps.current = app.setSteps;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    (async () => {
      try {
        const { Pedometer } = require('expo-sensors') as typeof import('expo-sensors');
        const available = await Pedometer.isAvailableAsync();
        if (!available || cancelled) return;

        const perm = await Pedometer.requestPermissionsAsync();
        if (!perm.granted || cancelled) return;

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const result = await Pedometer.getStepCountAsync(start, new Date());
        if (!cancelled && result) setSteps.current(result.steps);

        // Keep it current while the app is open, counting up from midnight.
        let base = result?.steps ?? 0;
        subscription = Pedometer.watchStepCount((event) => {
          if (!cancelled) setSteps.current(base + event.steps);
        });
      } catch {
        // No pedometer, or permission refused. Steps stay at zero.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);
}
