import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { stepButtonName } from './stepperWords';
import { C, F, lh, S } from './theme';

/**
 * − count +. Each button is a full 44-point circle on every platform (the
 * web adds no reach around a control, so the box itself is that size) and is
 * named for screen readers with what it changes ("Less chapati"), and says the
 * amount shown as its value. The web reads no value on a button, so there the
 * amount is in each name ("Less chapati, 2") and the amount between them is
 * read out when a tap changes it. − is off when it can do nothing.
 */
export function QtyStepper({
  value,
  onMinus,
  onPlus,
  minusLabel,
  plusLabel,
  minusDisabled,
}: {
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusLabel: string;
  plusLabel: string;
  minusDisabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <StepButton icon="remove" label={minusLabel} value={value} onPress={onMinus} disabled={minusDisabled} />
      <Text
        aria-live={Platform.OS === 'web' ? 'polite' : undefined}
        style={{ minWidth: 40, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <StepButton icon="add" label={plusLabel} value={value} onPress={onPlus} />
    </View>
  );
}

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
