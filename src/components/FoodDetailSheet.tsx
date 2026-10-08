import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { defaultPortion, foodIcon, measuresFor, portionLabel, styleOf } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem } from '../core/types';
import { FOOD_IMAGES } from '../data/foodImages';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Micro, Pill, Row, Small } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F, S } from '../ui/theme';

const QTYS = [0.5, 1, 1.5, 2, 3];

/** The food's picture, or its pictogram when there is none. */
export function FoodThumb({ food, size = 44 }: { food: FoodItem; size?: number }) {
  const src = FOOD_IMAGES[food.id];
  if (src) return <Image source={src} style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt }} contentFit="cover" transition={150} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{foodIcon(food)}</Text>
    </View>
  );
}

export type Chosen = { food: FoodItem; unit: string; gramsPerUnit: number; count: number };

/**
 * One food, looked at properly before it goes in: the picture, how much and
 * in what measure, and the calories and macros for exactly that amount. The
 * same shape as the apps people already know, so nothing needs explaining.
 */
export function FoodDetailSheet({
  food,
  initial,
  onAdd,
  onClose,
}: {
  food: FoodItem | null;
  /** Editing a line already in the basket: start from its measure and amount. */
  initial?: { unit: string; gramsPerUnit: number; count: number } | null;
  onAdd: (c: Chosen) => void;
  onClose: () => void;
}) {
  const { state } = useApp();
  const lang = state.profile.lang;
  const t = makeT(lang);
  const [count, setCount] = useState(1);
  const [measure, setMeasure] = useState<{ unit: string; grams: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // A different food starts from its own default portion again.
  const id = food?.id ?? null;
  if (id !== openId) {
    setOpenId(id);
    setCount(initial?.count ?? 1);
    const p = food ? defaultPortion(food) : undefined;
    setMeasure(initial ? { unit: initial.unit, grams: initial.gramsPerUnit } : p ? { unit: p.unit, grams: p.grams } : { unit: 'bowl', grams: 150 });
  }
  if (!food || !measure) return null;
  const f = food;
  const style = styleOf(f);
  const grams = Math.round(measure.grams * count);
  const n = kcalForGrams(f, grams);
  const options = measuresFor(f).map((m) => ({
    ...m,
    label: m.own ? portionLabel(f.portions.find((p) => p.unit === m.unit)!, lang) : t(`measure_${m.unit}`),
  }));

  return (
    <Sheet open title="" onClose={onClose}>
      <View style={{ gap: 14, marginTop: -8 }}>
        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
          <FoodThumb food={f} size={88} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600', letterSpacing: -0.3 }}>{f.name_en}</Text>
            {lang !== 'en' ? <Text style={{ color: C.textDim, fontSize: F.body }}>{lang === 'hi' ? f.name_hi : f.name_mr}</Text> : null}
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {style ? <Pill label={t(`style_${style}`)} /> : null}
              {f.tags.includes('healthy_swap') ? <Pill label={t('healthy_pick')} color={C.cardAlt} textColor={C.green} /> : null}
            </Row>
          </View>
        </Row>

        <View style={{ gap: 8 }}>
          <Micro>{t('measure_q')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {options.map((m) => (
              <Pill key={m.unit} label={m.label} active={measure.unit === m.unit} onPress={() => setMeasure({ unit: m.unit, grams: m.grams })} />
            ))}
          </Row>
        </View>

        <View style={{ gap: 8 }}>
          <Micro>{t('how_many')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {QTYS.map((q) => (
              <Pill key={q} label={`${q}`} active={count === q} onPress={() => setCount(q)} />
            ))}
          </Row>
        </View>

        <Divider />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Micro>{t('calories')}</Micro>
            <Text style={{ color: C.text, fontSize: F.display - 6, fontWeight: '700', letterSpacing: -1 }}>
              {n.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500', letterSpacing: 0 }}> kcal</Text>
            </Text>
          </View>
          <Small color={C.textFaint}>{`${grams} g`}</Small>
        </Row>
        <View style={{ backgroundColor: C.cardAlt, borderRadius: S.radiusSm, padding: 12, gap: 8 }}>
          <Macro icon="fitness-outline" label={t('protein')} value={n.protein} />
          <Macro icon="flame-outline" label={t('carbs')} value={n.carbs} />
          <Macro icon="water-outline" label={t('fat')} value={n.fat} />
        </View>
        {f.source === 'estimate' ? <Small color={C.textGhost}>{t('estimated_values')}</Small> : null}

        <Btn label={initial ? t('done') : t('add_item')} onPress={() => onAdd({ food: f, unit: measure.unit, gramsPerUnit: measure.grams, count })} />
        <Pressable onPress={onClose} style={{ alignSelf: 'center', paddingVertical: 6 }}>
          <Micro color={C.textFaint}>{t('cancel')}</Micro>
        </Pressable>
      </View>
    </Sheet>
  );
}

function Macro({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row style={{ gap: 8 }}>
        <Ionicons name={icon} size={14} color={C.textFaint} />
        <Text style={{ color: C.textDim, fontSize: F.small }}>{label}</Text>
      </Row>
      <Text style={{ color: C.text, fontSize: F.small, fontWeight: '600' }}>{`${Math.round(value * 10) / 10} g`}</Text>
    </Row>
  );
}
