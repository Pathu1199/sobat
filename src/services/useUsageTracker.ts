import { useEffect, useRef } from 'react';
import { AppState as RNAppState, Platform } from 'react-native';
import { useApp } from '../store/AppProvider';

const TICK_MS = 60000;
const ACTIVE_WINDOW_MS = 150000;

/**
 * Counts a minute of screen time for every minute the app is open and someone
 * is actually at the machine. Nothing is recorded while the tab is hidden or
 * the desk is empty, so the number means something.
 */
export function useUsageTracker() {
  const app = useApp();
  // Seeded in the effect below: neither `Date.now()` nor a ref write belongs
  // in a render, and the React Compiler rejects both.
  const lastActivity = useRef(0);
  const visible = useRef(true);
  const track = useRef(app.trackActive);

  useEffect(() => {
    track.current = app.trackActive;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    const onVisibility = () => {
      visible.current = typeof document === 'undefined' || document.visibilityState === 'visible';
      if (visible.current) lastActivity.current = Date.now();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      visible.current = s === 'active';
      if (s === 'active') lastActivity.current = Date.now();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();
    const id = setInterval(() => {
      if (!visible.current) return;
      if (Date.now() - lastActivity.current > ACTIVE_WINDOW_MS) return;
      track.current(1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);
}
