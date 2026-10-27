import React from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEased, useEntrance } from './animated';
import { C, F, lh, lift, MICRO, onThemeChange, S } from './theme';

/** Extra reach around a pill, so a 35-point chip still takes a 44-point finger. */
const PILL_SLOP = { top: 6, bottom: 6, left: 4, right: 4 };

export function Screen({ children, refreshing, wide }: { children: React.ReactNode; refreshing?: boolean; wide?: boolean }) {
  return (
    <ScrollView
      style={st.screen}
      contentContainerStyle={[st.screenContent, wide && { maxWidth: S.maxWide, paddingHorizontal: S.gutterWide, paddingTop: 4 }]}
      keyboardShouldPersistTaps="handled">
      {refreshing ? <ActivityIndicator color={C.accent} /> : null}
      {children}
      <View style={{ height: 56 }} />
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  tone,
  flat,
  rail,
  still,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  tone?: string;
  flat?: boolean;
  rail?: string;
  /** No entrance animation, for cards that re-mount often. */
  still?: boolean;
}) {
  const { opacity, translateY } = useEntrance();
  return (
    <Animated.View
      style={[
        st.card,
        flat ? { backgroundColor: 'transparent', borderColor: 'transparent', padding: 0, shadowOpacity: 0, elevation: 0 } : lift(1),
        tone ? { borderColor: tone } : null,
        rail ? { borderLeftWidth: 4, borderLeftColor: rail } : null,
        style,
        still ? null : { opacity, transform: [{ translateY }] },
      ]}>
      {children}
    </Animated.View>
  );
}

/** Screen and card titles. All three are the one title size now; the names stay so screens need not change. */
export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function H3({ children }: { children: React.ReactNode }) {
  return (
    <Text accessibilityRole="header" style={st.title}>
      {children}
    </Text>
  );
}
export function P({ children, dim, style }: { children: React.ReactNode; dim?: boolean; style?: any }) {
  return <Text style={[st.p, dim && { color: C.textDim }, style]}>{children}</Text>;
}
export function Small({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[st.small, color ? { color } : null]}>{children}</Text>;
}

/** The small quiet label over a section or beside a stat. Normal case, as the words are written. */
export function Micro({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[MICRO, { color: color ?? C.textFaint }]}>{children}</Text>;
}

/** A section heading with an optional quiet note on the right. */
export function SectionHeader({ title, meta, color, icon }: { title: string; meta?: string; color?: string; icon?: React.ReactNode }) {
  return (
    <View style={[st.row, { justifyContent: 'space-between', marginTop: 4 }]}>
      <View style={[st.row, { gap: 7 }]}>
        {icon}
        <Text accessibilityRole="header" style={[MICRO, { color: color ?? C.textDim }]}>
          {title}
        </Text>
      </View>
      {meta ? <Micro>{meta}</Micro> : null}
    </View>
  );
}

/** One language at a time: the chosen language when a translation is given, English otherwise. */
export function BiText({ en, alt, size = F.body, color, weight = '500' }: { en: string; alt?: string; size?: number; color?: string; weight?: '400' | '500' }) {
  return <Text style={{ color: color ?? C.text, fontSize: size, lineHeight: lh(size), fontWeight: weight }}>{alt || en}</Text>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.row, style]}>{children}</View>;
}

/**
 * The button. Primary is the one teal action on a screen, its words in dark
 * ink (onAccent); soft and ghost are the quieter choices; danger is for
 * deleting. Never shorter than a finger.
 */
export function Btn({
  label,
  onPress,
  tone = 'primary',
  small,
  disabled,
  style,
  icon,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger' | 'soft';
  small?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
  /** What a screen reader says when the visible label is not enough on its own. */
  accessibilityLabel?: string;
}) {
  const bg = tone === 'primary' ? C.accent : tone === 'danger' ? C.redSoft : tone === 'soft' ? C.accentDim : 'transparent';
  const border = tone === 'ghost' ? C.borderStrong : bg;
  const fg = tone === 'primary' ? C.onAccent : tone === 'danger' ? C.red : tone === 'soft' ? C.accentText : C.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        small && st.btnSmall,
        style,
      ]}>
      {icon ? <View style={{ marginRight: 7 }}>{icon}</View> : null}
      <Text style={[st.btnText, { color: fg }, small && st.btnTextSmall]}>{label}</Text>
    </Pressable>
  );
}

/** A chip. With onPress it is a button, and `active` is announced as selected. */
export function Pill({
  label,
  color,
  textColor,
  onPress,
  active,
  tone,
}: {
  label: string;
  color?: string;
  textColor?: string;
  onPress?: () => void;
  active?: boolean;
  tone?: string;
}) {
  const bg = active ? C.accent : color ?? C.card;
  const bd = active ? C.accent : tone ?? C.border;
  const fg = active ? C.onAccent : textColor ?? C.text;
  const body = (
    <View style={[st.pill, { backgroundColor: bg, borderColor: bd }]}>
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} hitSlop={PILL_SLOP} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

/** A status chip: a coloured dot and a small label, used in headers. */
export function StatusChip({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <View style={[st.pill, { backgroundColor: C.cardAlt, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={[MICRO, { color: C.textDim }]}>{label}</Text>
    </View>
  );
}

/** Two to four choices side by side, one selected. Read out as tabs, with the selected one marked. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={st.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected: on }}
            style={[st.segment, on && { backgroundColor: C.card, ...lift(1) }]}>
            <Text style={[MICRO, { color: on ? C.accentText : C.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A text box with its label above it; the label is also what a screen reader calls the box. */
export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  multiline,
  autoFocus,
  accessibilityLabel,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  /** For a box without a visible label. */
  accessibilityLabel?: string;
}) {
  return (
    <View style={{ gap: 7, flex: 1 }}>
      {label ? <Micro>{label}</Micro> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.textFaint}
        multiline={multiline}
        autoFocus={autoFocus}
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        style={[st.input, multiline && { minHeight: 78, textAlignVertical: 'top' }]}
      />
    </View>
  );
}

/** A labelled switch row with a one-line reason under it. The whole row is the switch. */
export function Toggle({ title, desc, on, onToggle }: { title: string; desc: string; on: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={desc}
      accessibilityState={{ checked: on }}
      style={({ pressed }) => [st.row, { justifyContent: 'space-between', gap: 14, minHeight: S.touch, opacity: pressed ? 0.8 : 1 }]}>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{title}</Text>
        <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{desc}</Text>
      </View>
      <View
        style={{
          width: 46,
          height: 27,
          borderRadius: 999,
          backgroundColor: on ? C.accent : C.cardAlt,
          borderWidth: S.hairline,
          borderColor: on ? C.accent : C.borderStrong,
          padding: 3,
          justifyContent: 'center',
          alignItems: on ? 'flex-end' : 'flex-start',
        }}>
        <View style={{ width: 19, height: 19, borderRadius: 999, backgroundColor: on ? C.onAccent : C.textFaint }} />
      </View>
    </Pressable>
  );
}

export function Bar({ value, max, color = C.accent, height = 4, marker }: { value: number; max: number; color?: string; height?: number; marker?: number }) {
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={[st.barTrack, { height, borderRadius: height }]}>
      <View style={{ width: `${pct * 100}%`, backgroundColor: color, height, borderRadius: height }} />
      {marker !== undefined && marker > 0 && marker < 1 ? (
        <View
          style={{
            position: 'absolute',
            left: `${marker * 100}%`,
            top: -2,
            width: 2,
            height: height + 4,
            borderRadius: 1,
            backgroundColor: C.textDim,
          }}
        />
      ) : null}
    </View>
  );
}

/** A labelled bar row: name on the left, value on the right, bar underneath. */
export function MeterRow({
  label,
  alt,
  value,
  total,
  unit,
  color = C.accent,
  marker,
}: {
  label: string;
  alt?: string;
  value: number;
  total: number;
  unit?: string;
  color?: string;
  marker?: number;
}) {
  return (
    <View style={{ gap: 7 }}>
      <View style={[st.row, { justifyContent: 'space-between', gap: 10 }]}>
        <View style={{ flexShrink: 1, minWidth: 0 }}>
          <BiText en={label} alt={alt} size={F.small} color={C.textDim} weight="400" />
        </View>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>
          {value.toLocaleString()}
          <Text style={{ color: C.textFaint, fontWeight: '400' }}>
            {' / '}
            {total.toLocaleString()}
            {unit ? ` ${unit}` : ''}
          </Text>
        </Text>
      </View>
      <Bar value={value} max={total} color={color} marker={marker} />
    </View>
  );
}

export function Ring({
  value,
  max,
  size = 140,
  stroke = 8,
  color = C.accent,
  track = C.cardAlt,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const safe = Math.max(28, size);
  const r = (safe - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const target = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const pct = useEased(target);
  return (
    <View style={{ width: safe, height: safe, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={safe} height={safe} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={safe / 2} cy={safe / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={safe / 2}
          cy={safe / 2}
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

/** A small ring with a percentage inside and a caption beneath. */
export function RingStat({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 8, minWidth: 52 }}>
      <Ring value={value ?? 0} max={100} size={44} stroke={3} color={color} track={C.cardAlt}>
        <Text style={{ color: value === null ? C.textFaint : C.text, fontSize: F.small, fontWeight: '500' }}>{value === null ? '·' : `${value}%`}</Text>
      </Ring>
      <Text style={[MICRO, { color: C.textFaint }]}>{label}</Text>
    </View>
  );
}

/** The four-up statistic strip under the decision card. */
export function StatQuad({ items }: { items: { label: string; value: string; color?: string }[] }) {
  return (
    <View style={[st.row, { justifyContent: 'space-between', paddingTop: 4 }]}>
      {items.map((i) => (
        <View key={i.label} style={{ alignItems: 'center', flex: 1, gap: 5 }}>
          <Micro>{i.label}</Micro>
          <Text style={{ color: i.color ?? C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A quoted line, used for the Marathi aside inside the decision card. */
export function Quote({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: color, paddingLeft: 12, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>{children}</Text>
    </View>
  );
}

/** A list row: leading icon, title with subtitle, trailing value. With onPress it is one button, at least a finger tall. */
export function ListRow({
  icon,
  title,
  alt,
  sub,
  value,
  valueUnit,
  onPress,
  trailing,
}: {
  icon?: React.ReactNode;
  title: string;
  alt?: string;
  sub?: string;
  value?: string;
  valueUnit?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
}) {
  const body = (
    <View style={[st.row, { paddingVertical: 11, gap: 12, minHeight: S.touch }]}>
      {icon ? <View style={st.rowIcon}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <BiText en={title} alt={alt} size={F.body} />
        {sub ? <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{sub}</Text> : null}
      </View>
      {value ? (
        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>
          {value}
          {valueUnit ? <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '400' }}> {valueUnit}</Text> : null}
        </Text>
      ) : null}
      {trailing}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button">
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function Divider() {
  return <View style={st.divider} />;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{text}</Text>
    </View>
  );
}

// Baked once per theme; rebuilt when the palette or the text size changes (the tree remounts right after).
function buildStyles() {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    screenContent: { padding: S.pad, gap: S.gap, maxWidth: 780, width: '100%', alignSelf: 'center' },
    card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: S.hairline, borderColor: C.border, padding: S.padLg, gap: 12 },
    title: { color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' },
    p: { color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '400' },
    small: { color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
    btn: {
      minHeight: 48,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: S.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
    },
    btnSmall: { minHeight: S.touch, paddingVertical: 8, paddingHorizontal: 14 },
    btnText: { fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' },
    btnTextSmall: { fontSize: F.small, lineHeight: lh(F.small) },
    pill: { paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, borderWidth: S.hairline },
    pillText: { fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' },
    segmented: { flexDirection: 'row', backgroundColor: C.cardAlt, borderRadius: 999, padding: 4 },
    segment: { flex: 1, minHeight: S.touch, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    input: {
      minHeight: 48,
      backgroundColor: C.cardAlt,
      borderWidth: S.hairline,
      borderColor: C.border,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 11,
      color: C.text,
      fontSize: F.body,
    },
    barTrack: { backgroundColor: C.cardAlt, overflow: 'visible', width: '100%' },
    divider: { height: S.hairline, backgroundColor: C.border },
    empty: { paddingVertical: 22, alignItems: 'center' },
  });
}

let st = buildStyles();
onThemeChange(() => {
  st = buildStyles();
});
