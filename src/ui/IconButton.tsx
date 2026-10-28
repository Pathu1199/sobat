import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';
import { C } from './theme';

/** A 44 pt round icon button. `ref` reaches the button itself, so a page can put the focus back on it. */
export function IconButton({
  name,
  label,
  onPress,
  disabled,
  ref,
}: {
  name: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  ref?: React.Ref<View>;
}) {
  return (
    <Pressable
      ref={ref}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? C.cardAlt : 'transparent',
        opacity: disabled ? 0.3 : 1,
      })}>
      <Ionicons name={name} size={22} color={C.textDim} />
    </Pressable>
  );
}
