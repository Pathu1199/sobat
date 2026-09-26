import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useEased } from './animated';
import { C, F, MICRO, S } from './theme';

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

export function Card({ children, style, tone, flat, rail }: { children: React.ReactNode; style?: ViewStyle; tone?: string; flat?: boolean; rail?: string }) {
  return (
    <View
      style={[
        st.card,
        flat && { backgroundColor: 'transparent', borderColor: 'transparent', padding: 0 },
        tone ? { borderColor: tone } : null,
        rail ? { borderLeftWidth: 2, borderLeftColor: rail } : null,
        style,
      ]}>
      {children}
    </View>
  );
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

/** The tiny uppercase caption that labels almost everything in this design. */
export function Micro({ children, color }: { children: React.ReactNode; color?: string }) {
  return <Text style={[MICRO, { color: color ?? C.textFaint }]}>{children}</Text>;
}

/** A section heading with an optional quiet note on the right. */
export function SectionHeader({ title, meta, color }: { title: string; meta?: string; color?: string }) {
  return (
    <View style={[st.row, { justifyContent: 'space-between', marginTop: 4 }]}>
      <Micro color={color ?? C.textDim}>{title}</Micro>
      {meta ? <Micro>{meta}</Micro> : null}
    </View>
  );
}

/** English name with its Marathi form beside it, as the design shows them. */
export function BiText({ en, alt, size = F.body, color, weight = '500' }: { en: string; alt?: string; size?: number; color?: string; weight?: '400' | '500' | '600' }) {
  return (
    <Text style={{ color: color ?? C.text, fontSize: size, fontWeight: weight }}>
      {en}
      {alt ? <Text style={{ color: C.textFaint, fontWeight: '400' }}> {alt}</Text> : null}
    </Text>
  );
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
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger' | 'soft';
  small?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}) {
  const bg = tone === 'primary' ? C.accent : tone === 'danger' ? C.redSoft : tone === 'soft' ? C.cardAlt : 'transparent';
  const border = tone === 'ghost' ? C.border : tone === 'soft' ? C.border : bg;
  const fg = tone === 'primary' ? C.white : tone === 'danger' ? C.text : C.text;
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        st.btn,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        small && { paddingVertical: 9, paddingHorizontal: 13 },
        style,
      ]}>
      {icon ? <View style={{ marginRight: 7 }}>{icon}</View> : null}
      <Text style={[st.btnText, { color: fg }, small && { fontSize: F.small }]}>{label}</Text>
    </Pressable>
  );
}

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
  const bg = active ? C.accent : color ?? C.cardAlt;
  const bd = active ? C.accent : tone ?? C.border;
  const fg = active ? C.white : textColor ?? C.textDim;
  const body = (
    <View style={[st.pill, { backgroundColor: bg, borderColor: bd }]}>
      <Text style={[st.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

/** A status chip: a coloured dot and a tiny label, used in headers. */
export function StatusChip({ label, color = C.accent }: { label: string; color?: string }) {
  return (
    <View style={[st.pill, { backgroundColor: C.cardAlt, borderColor: C.border, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={[MICRO, { color: C.textDim }]}>{label}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={st.segmented}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={[st.segment, on && { backgroundColor: C.accent }]}>
            <Text style={[MICRO, { color: on ? C.white : C.textDim }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  multiline,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'numeric';
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ gap: 7, flex: 1 }}>
      {label ? <Micro>{label}</Micro> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={C.textGhost}
        multiline={multiline}
        autoFocus={autoFocus}
        style={[st.input, multiline && { minHeight: 78, textAlignVertical: 'top' }]}
      />
    </View>
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
        <Text numberOfLines={1} style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>
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
        <Text style={{ color: value === null ? C.textGhost : C.text, fontSize: F.micro, fontWeight: '600' }}>
          {value === null ? '·' : `${value}%`}
        </Text>
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
          <Text style={{ color: i.color ?? C.text, fontSize: F.h3, fontWeight: '500' }}>{i.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** A quoted line, used for the Marathi aside inside the decision card. */
export function Quote({ children, color = C.cyan }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: color, paddingLeft: 12, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: F.small, fontStyle: 'italic', lineHeight: 19 }}>{children}</Text>
    </View>
  );
}

/** A bulleted point with a small dot, as used in the advice list. */
export function Bullet({ children, color = C.accent }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={[st.row, { alignItems: 'flex-start', gap: 9 }]}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color, marginTop: 8 }} />
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 20, flex: 1 }}>{children}</Text>
    </View>
  );
}

/** A list row: leading icon, title with subtitle, trailing value. */
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
    <View style={[st.row, { paddingVertical: 11, gap: 12 }]}>
      {icon ? <View style={st.rowIcon}>{icon}</View> : null}
      <View style={{ flex: 1, gap: 3 }}>
        <BiText en={title} alt={alt} size={F.body} />
        {sub ? <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{sub}</Text> : null}
      </View>
      {value ? (
        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
          {value}
          {valueUnit ? <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '400' }}> {valueUnit}</Text> : null}
        </Text>
      ) : null}
      {trailing}
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export function Divider() {
  return <View style={st.divider} />;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={st.empty}>
      <Text style={{ color: C.textGhost, fontSize: F.small }}>{text}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  screenContent: { padding: S.pad, gap: S.gap, maxWidth: 780, width: '100%', alignSelf: 'center' },
  card: { backgroundColor: C.card, borderRadius: S.radius, borderWidth: S.hairline, borderColor: C.border, padding: S.padLg, gap: 12 },
  h1: { color: C.text, fontSize: F.h1, fontWeight: '600', letterSpacing: -0.5 },
  h2: { color: C.text, fontSize: F.h2, fontWeight: '600', letterSpacing: -0.3 },
  h3: { color: C.text, fontSize: F.h3, fontWeight: '600' },
  p: { color: C.text, fontSize: F.body, lineHeight: 21 },
  small: { color: C.textDim, fontSize: F.small, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: S.radiusSm,
    borderWidth: S.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnText: { fontSize: F.body, fontWeight: '600' },
  pill: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 999, borderWidth: S.hairline },
  pillText: { fontSize: F.tiny, fontWeight: '500' },
  segmented: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 999, borderWidth: S.hairline, borderColor: C.border, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 999, alignItems: 'center' },
  input: {
    backgroundColor: C.bgAlt,
    borderWidth: S.hairline,
    borderColor: C.border,
    borderRadius: S.radiusSm,
    paddingHorizontal: 13,
    paddingVertical: 11,
    color: C.text,
    fontSize: F.body,
  },
  barTrack: { backgroundColor: C.cardAlt, overflow: 'visible', width: '100%' },
  divider: { height: S.hairline, backgroundColor: C.border },
  empty: { paddingVertical: 22, alignItems: 'center' },
});
