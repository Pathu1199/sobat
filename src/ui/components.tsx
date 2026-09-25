import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { C, F, S } from './theme';

export function Screen({ children, refreshing }: { children: React.ReactNode; refreshing?: boolean }) {
  return (
    <ScrollView style={st.screen} contentContainerStyle={st.screenContent} keyboardShouldPersistTaps="handled">
      {refreshing ? <ActivityIndicator color={C.teal} /> : null}
      {children}
      <View style={{ height: 48 }} />
    </ScrollView>
  );
}

export function Card({ children, style, tone }: { children: React.ReactNode; style?: ViewStyle; tone?: string }) {
  return <View style={[st.card, tone ? { borderColor: tone } : null, style]}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={st.h1}>{children}</Text>;
}
export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={st.h2}>{children}</Text>;
}
export function H3({ children }: { children: React.ReactNode }) {
  return <Text style={st.h3}>{children}</Text>;
}
export function P({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: any }) {
  return <Text style={[st.p, dim && { color: C.textDim }, style]}>{children}</Text>;
}
export function Small({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.small, color ? { color } : null]}>{children}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.row, style]}>{children}</View>;
}

export function Btn({
  label,
  onPress,
  tone = 'primary',
  small,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger' | 'soft';
  small?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg = tone === 'primary' ? C.teal : tone === 'danger' ? C.redSoft : tone === 'soft' ? C.cardAlt : 'transparent';
  const border = tone === 'ghost' ? C.border : bg;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        style,
      ]}>
      <Text style={[st.btnText, small && { fontSize: F.small }]}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, color = C.cardAlt, textColor = C.text, onPress, active }: { label: string; color?: string; textColor?: string; onPress?: () => void; active?: boolean }) {
  const body = (
    <View style={[st.pill, { backgroundColor: active ? C.teal : color, borderColor: active ? C.teal : C.border }]}>
      <Text style={[st.pillText, { color: active ? C.white : textColor }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  multiline,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6, flex: 1 }}>
      {label ? <Text style={st.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        multiline={multiline}
        style={[st.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

export function Bar({ value, max, color = C.teal, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={[st.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${pct * 100}%`, backgroundColor: color, height, borderRadius: height / 2 }} />
    </View>
  );
}

export function Ring({
  value,
  max,
  size = 140,
  stroke = 12,
  color = C.teal,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.cardAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>{children}</View>
    </View>
  );
}

export function Divider() {
  return <View style={st.divider} />;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Text style={{ color: C.textFaint, fontSize: F.small }}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenContent: { padding: S.pad, gap: S.gap, maxWidth: 760, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: 1, borderColor: C.border, padding: S.pad, gap: 10 },
  h1: { color: C.text, fontSize: F.h1, fontWeight: '600' },
  h2: { color: C.text, fontSize: F.h2, fontWeight: '600' },
  h3: { color: C.text, fontSize: F.h3, fontWeight: '600' },
  p: { color: C.text, fontSize: F.body, lineHeight: 22 },
  small: { color: C.textDim, fontSize: F.small, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: S.radiusSm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: C.white, fontSize: F.body, fontWeight: '600' },
  pill: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: F.small, fontWeight: '500' },
  label: { color: C.textDim, fontSize: F.small },
  input: { backgroundColor: C.bgAlt, borderWidth: 1, borderColor: C.border, borderRadius: S.radiusSm, paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: F.body },
  barTrack: { backgroundColor: C.cardAlt, overflow: 'hidden', width: '100%' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  empty: { paddingVertical: 20, alignItems: 'center' },
});
