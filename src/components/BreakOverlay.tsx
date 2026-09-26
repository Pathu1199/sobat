import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { makeT } from '../i18n';
import { useBreakMonitor } from '../services/useBreakMonitor';
import { useApp } from '../store/AppProvider';
import { C, F } from '../ui/theme';

const SUGGESTIONS: Record<string, string[]> = {
  en: ['Look at something far away', 'Roll your shoulders back', 'Stand up and stretch tall', 'Drink some water', 'Close your eyes and breathe'],
  mr: ['लांब कुठेतरी बघा', 'खांदे मागे फिरवा', 'उभे राहून ताण द्या', 'थोडे पाणी प्या', 'डोळे मिटून श्वास घ्या'],
  hi: ['दूर कहीं देखें', 'कंधे पीछे घुमाएँ', 'खड़े होकर स्ट्रेच करें', 'थोड़ा पानी पिएँ', 'आँखें बंद कर साँस लें'],
};

/**
 * Takes the whole screen for the pause. Deliberately almost empty: the point
 * is to stop looking at it.
 */
export function BreakOverlay() {
  const monitor = useBreakMonitor();
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const { width, height } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const [suggestion, setSuggestion] = useState('');

  // Nobody wants a forced break while they are still setting the app up.
  const active = state.profile.onboarded;
  const showing = active && monitor.phase === 'breaking';
  const over = monitor.remaining <= 0;

  useEffect(() => {
    if (!showing) return;
    const list = SUGGESTIONS[lang] ?? SUGGESTIONS.en;
    setSuggestion(list[Math.floor(Math.random() * list.length)]);
  }, [showing, lang]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: showing ? 1 : 0,
      duration: showing ? 600 : 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [showing, fade]);

  if (!showing) return active ? <BreakWarning monitor={monitor} lang={lang} /> : null;

  const size = Math.max(160, Math.min(260, Math.min(width, height) * 0.55));
  const stroke = 3;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = monitor.breakSeconds > 0 ? monitor.remaining / monitor.breakSeconds : 0;
  const mins = Math.floor(monitor.remaining / 60);
  const secs = monitor.remaining % 60;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#060D0C',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fade,
        zIndex: 999,
      }}>
      <Text style={{ color: C.textDim, fontSize: F.h2, fontWeight: '400', marginBottom: 40, textAlign: 'center', paddingHorizontal: 24 }}>
        {t('break_look_away')}
      </Text>

      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#12211E" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={C.accent}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ}`}
            strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={{ color: C.text, fontSize: size * 0.26, fontWeight: '200', letterSpacing: -2 }}>
          {mins}:{String(secs).padStart(2, '0')}
        </Text>
      </View>

      <Text style={{ color: C.textFaint, fontSize: F.body, marginTop: 40, textAlign: 'center', paddingHorizontal: 32 }}>{suggestion}</Text>

      <View
        style={{
          position: 'absolute',
          bottom: 48,
          left: 0,
          right: 0,
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: 40,
          alignItems: 'center',
        }}>
        {monitor.allowSkip && !over ? (
          <Pressable onPress={monitor.skip} accessibilityLabel={t('break_skip')}>
            <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {over ? (
          <Pressable
            onPress={monitor.finish}
            style={{ backgroundColor: C.accent, paddingVertical: 12, paddingHorizontal: 28, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontSize: F.body, fontWeight: '600' }}>{t('break_done')}</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <Text style={{ position: 'absolute', top: 28, right: 28, color: '#1C312D', fontSize: F.tiny }}>
        {t('break_count').replace('{n}', String(monitor.takenToday))}
      </Text>
    </Animated.View>
  );
}

/** The quiet heads-up a minute before, so nothing is lost mid-sentence. */
function BreakWarning({ monitor, lang }: { monitor: ReturnType<typeof useBreakMonitor>; lang: any }) {
  const t = makeT(lang);
  if (monitor.phase !== 'warning') return null;
  const seconds = Math.max(0, Math.round(monitor.minutesLeft * 60));

  return (
    <View
      style={{
        position: 'absolute',
        right: 16,
        bottom: 100,
        backgroundColor: C.cardAlt,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        gap: 4,
        maxWidth: 320,
        zIndex: 900,
      }}>
      <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
        {t('break_soon').replace('{s}', String(seconds))}
      </Text>
      <Text style={{ color: C.textDim, fontSize: F.small }}>{t('break_soon_hint')}</Text>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        <Pressable onPress={() => monitor.snooze(10)}>
          <Text style={{ color: C.accent, fontSize: F.small, fontWeight: '600' }}>{t('break_snooze')}</Text>
        </Pressable>
        {monitor.allowSkip ? (
          <Pressable onPress={monitor.skip}>
            <Text style={{ color: C.textFaint, fontSize: F.small }}>{t('break_skip')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
