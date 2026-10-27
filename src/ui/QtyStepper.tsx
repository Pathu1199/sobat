import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { C, F, lh, S } from './theme';

/**
 * − count +. Each button is a full 44-point circle on every platform (the
 * web adds no reach around a control, so the box itself is that size) and is
 * named for screen readers with what it changes ("Less chapati").
 */
export function QtyStepper({ value, onMinus, onPlus, minusLabel, plusLabel }: { value: string; onMinus: () => void; onPlus: () => void; minusLabel: string; plusLabel: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <StepButton icon="remove" label={minusLabel} onPress={onMinus} />
      <Text style={{ minWidth: 40, textAlign: 'center', color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500', fontVariant: ['tabular-nums'] }}>{value}</Text>
      <StepButton icon="add" label={plusLabel} onPress={onPlus} />
    </View>
  );
}

function StepButton({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.cardHigh : C.cardAlt })}>
      <Ionicons name={icon} size={18} color={C.text} />
    </Pressable>
  );
}
