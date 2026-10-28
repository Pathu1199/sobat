import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { OFF_SCREEN } from './announce';
import { stepButtonName } from './stepperWords';
import { C, F, lh, S } from './theme';

/**
 * − count +. Each button is a full 44-point circle on every platform (the
 * web adds no reach around a control, so the box itself is that size) and is
 * named for screen readers with what it changes ("Less chapati"), and says the
 * amount shown as its value. The web reads no value on a button, so there the
 * amount is in each name ("Less chapati, 2") and the new amount is read out
 * after a tap on − or +, and only then: a new day's amounts changing on their
 * own are not read out one after another. − is off when it can do nothing,
 * and so is + where the amount has a top (`plusDisabled`).
 */
export function QtyStepper({
  value,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  minusDisabled,
  plusDisabled,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  // On the web, for a moment after a tap: the amount goes into a region the browser reads as its words change.
  const [heard, setHeard] = useState(false);
  const tap = (fn: () => void) => () => {
    fn();
    if (Platform.OS !== 'web') return;
    setHeard(true);
    setTimeout(() => setHeard(false), HEARD_MS);
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <StepButton icon="remove" label={minusLabel} value={value} onPress={tap(onMinus)} disabled={minusDisabled} />
      <Text style={{ minWidth: 40, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <StepButton icon="add" label={plusLabel} value={value} onPress={tap(onPlus)} disabled={plusDisabled} />
      {Platform.OS === 'web' ? (
        <View aria-live="polite" style={OFF_SCREEN}>
          <Text>{heard ? value : ''}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** How long the amount stays in the web's region after a tap, long enough to be read once. */
const HEARD_MS = 1500;

function StepButton({ icon, label, value, onPress, disabled }: { icon: 'add' | 'remove'; label: string; value: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={stepButtonName(label, value, Platform.OS)}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed && !disabled ? C.cardHigh : C.cardAlt })}>
      <Ionicons name={icon} size={18} color={disabled ? C.textFaint : C.text} />
    </Pressable>
  );
}
