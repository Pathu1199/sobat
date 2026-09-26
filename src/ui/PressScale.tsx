import React, { useRef } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { M } from './theme';

/** A pressable that shrinks to 0.98 while held. The whole app's touch feel. */
export function PressScale({
  onPress,
  children,
  style,
  disabled,
  accessibilityLabel,
}: {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  // eslint-disable-next-line react-hooks/refs
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.timing(scale, { toValue: v, duration: M.fast, useNativeDriver: true }).start();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={() => to(0.98)}
      onPressOut={() => to(1)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}
