import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { C, F } from './theme';

/** A thin line with a soft fill, for weight over time. */
export function LineChart({
  data,
  height = 120,
  color = C.teal,
  goal,
  format = (v: number) => String(v),
}: {
  data: { date: string; value: number }[];
  height?: number;
  color?: string;
  goal?: number;
  format?: (v: number) => string;
}) {
  const [width, setWidth] = React.useState(300);
  const points = data.filter((d) => d.value > 0);
  if (points.length < 2) return <ChartEmpty height={height} />;

  const values = points.map((p) => p.value);
  const candidates = goal !== undefined ? [...values, goal] : values;
  const min = Math.min(...candidates);
  const max = Math.max(...candidates);
  const span = max - min || 1;
  const pad = 10;
  const w = Math.max(width, 40);
  const h = height;

  const x = (i: number) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (h - pad * 2);

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      <Svg width={w} height={h}>
        <Path d={area} fill={color} fillOpacity={0.12} />
        {goal !== undefined ? (
          <Line x1={pad} y1={y(goal)} x2={w - pad} y2={y(goal)} stroke={C.textFaint} strokeWidth={1} strokeDasharray="4 4" />
        ) : null}
        <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <Circle key={p.date} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4 : 2.5} fill={color} />
        ))}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ color: C.textFaint, fontSize: F.tiny }}>{format(points[0].value)}</Text>
        <Text style={{ color: C.text, fontSize: F.tiny }}>{format(points[points.length - 1].value)}</Text>
      </View>
    </View>
  );
}

/** Bars against a dashed target line. Over the line turns amber. */
export function BarChart({
  data,
  height = 120,
  target,
  color = C.teal,
  overColor = C.amber,
  format = (v: number) => String(v),
}: {
  data: { date: string; value: number }[];
  height?: number;
  target?: number;
  color?: string;
  overColor?: string;
  format?: (v: number) => string;
}) {
  const [width, setWidth] = React.useState(300);
  if (data.length === 0) return <ChartEmpty height={height} />;

  const max = Math.max(...data.map((d) => d.value), target ?? 0, 1);
  const pad = 8;
  const w = Math.max(width, 40);
  const h = height;
  const slot = (w - pad * 2) / data.length;
  const barW = Math.max(2, Math.min(slot * 0.62, 22));
  const y = (v: number) => pad + (1 - v / max) * (h - pad * 2);

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      <Svg width={w} height={h}>
        {target !== undefined ? (
          <Line x1={pad} y1={y(target)} x2={w - pad} y2={y(target)} stroke={C.textFaint} strokeWidth={1} strokeDasharray="4 4" />
        ) : null}
        {data.map((d, i) => {
          const cx = pad + slot * i + slot / 2;
          const top = d.value > 0 ? y(d.value) : h - pad;
          const barH = Math.max(d.value > 0 ? 2 : 0, h - pad - top);
          const fill = target !== undefined && d.value > target ? overColor : color;
          return (
            <Rect
              key={d.date}
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={barH}
              rx={Math.min(3, barW / 2)}
              fill={d.value > 0 ? fill : C.cardAlt}
              fillOpacity={d.value > 0 ? 1 : 0.5}
            />
          );
        })}
      </Svg>
      {target !== undefined ? (
        <Text style={{ color: C.textFaint, fontSize: F.tiny, marginTop: 4 }}>{format(target)}</Text>
      ) : null}
    </View>
  );
}

/** One small square per day: filled when logged, ringed when on target. */
export function ConsistencyStrip({ data }: { data: { date: string; logged: boolean; onTarget: boolean; moved: boolean }[] }) {
  const cell = data.length > 10 ? 14 : 26;
  const gap = data.length > 10 ? 4 : 6;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {data.map((d) => (
        <View
          key={d.date}
          style={{
            width: cell,
            height: cell,
            borderRadius: 4,
            backgroundColor: d.onTarget ? C.teal : d.logged ? C.tealSoft : 'transparent',
            borderWidth: 1,
            borderColor: d.logged ? 'transparent' : C.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {d.moved ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: C.white }} /> : null}
        </View>
      ))}
    </View>
  );
}

/** A day at a glance: 24 slim columns, one per hour. */
export function HourStrip({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 44 }}>
      {hours.map((m, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(2, (m / max) * 44),
            borderRadius: 2,
            backgroundColor: m >= 45 ? C.amber : m > 0 ? C.teal : C.cardAlt,
            opacity: m > 0 ? 1 : 0.4,
          }}
        />
      ))}
    </View>
  );
}

function ChartEmpty({ height }: { height: number }) {
  return (
    <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textFaint, fontSize: F.small }}>-</Text>
    </View>
  );
}
