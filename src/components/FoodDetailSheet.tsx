import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatQty, stepCount, stepFor } from '../core/basket';
import { defaultPortion, foodName, measuresFor, portionLabel, styleOf } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem } from '../core/types';
import { FOOD_IMAGES } from '../data/foodImages';
import { fill, makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Divider, Field, Micro, Pill, Row, Small } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { Sheet } from '../ui/Sheet';
import { C, F, lh, S } from '../ui/theme';

/** The food's picture or, with none, the first letter of its name on a plain tile. No pictograms: a food row carries no emoji. */
export function FoodThumb({ food, size = 44 }: { food: FoodItem; size?: number }) {
  const { state } = useApp();
  const src = FOOD_IMAGES[food.id];
  if (src) return <Image source={src} style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt }} contentFit="cover" transition={150} />;
  const initial = Array.from(foodName(food, state.profile.lang).trim())[0] ?? '';
  const type = size >= 64 ? F.title : F.body;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: C.textDim, fontSize: type, lineHeight: lh(type), fontWeight: '500' }}>{initial}</Text>
    </View>
  );
}

export type Chosen = { food: FoodItem; unit: string; gramsPerUnit: number; count: number };

/**
 * One food, looked at properly before it goes in: the picture, the measure,
 * any amount (− / + by a whole or a half, or the grams typed), and the
 * calories and macros for exactly that amount, from the database.
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
  // What is being typed in the grams box; null shows the grams the count works out to.
  const [gramsDraft, setGramsDraft] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // A different food starts from its own default portion again.
  const id = food?.id ?? null;
  if (id !== openId) {
    setOpenId(id);
    setCount(initial?.count ?? 1);
    setGramsDraft(null);
    const p = food ? defaultPortion(food) : undefined;
    setMeasure(initial ? { unit: initial.unit, grams: initial.gramsPerUnit } : p ? { unit: p.unit, grams: p.grams } : { unit: 'bowl', grams: 150 });
  }
  if (!food || !measure) return null;
  const f = food;
  const m = measure;
  const name = foodName(f, lang);
  const style = styleOf(f);
  const grams = Math.round(m.grams * count);
  const n = kcalForGrams(f, grams);
  const options = measuresFor(f).map((x) => ({
    ...x,
    label: x.own ? portionLabel(f.portions.find((p) => p.unit === x.unit)!, lang) : t(`measure_${x.unit}`),
  }));

  // Never under one step here, and − never makes a typed amount below a step (half a chapati) larger.
  function step(by: 1 | -1) {
    setGramsDraft(null);
    setCount((c) => {
      const next = Math.max(stepFor(m.unit), stepCount(c, m.unit, by));
      return by < 0 ? Math.min(c, next) : next;
    });
  }

  function typeGrams(v: string) {
    setGramsDraft(v);
    const g = parseFloat(v);
    if (Number.isFinite(g) && g > 0 && g <= 3000) setCount(Math.round((g / m.grams) * 100) / 100);
  }

  return (
    <Sheet open title="" onClose={onClose}>
      <View style={{ gap: 14, marginTop: -8 }}>
        <Row style={{ gap: 14, alignItems: 'flex-start' }}>
          <FoodThumb food={f} size={88} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>{name}</Text>
            {lang !== 'en' ? <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{f.name_en}</Text> : null}
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {style ? <Pill label={t(`style_${style}`)} /> : null}
              {f.tags.includes('healthy_swap') ? <Pill label={t('healthy_pick')} color={C.cardAlt} textColor={C.green} /> : null}
            </Row>
          </View>
        </Row>

        <View style={{ gap: 8 }}>
          <Micro>{t('measure_q')}</Micro>
          <Row style={{ gap: 6, flexWrap: 'wrap' }}>
            {options.map((x) => (
              <Pill
                key={x.unit}
                label={x.label}
                active={m.unit === x.unit}
                onPress={() => {
                  setGramsDraft(null);
                  setMeasure({ unit: x.unit, grams: x.grams });
                }}
              />
            ))}
          </Row>
        </View>

        <View style={{ gap: 8 }}>
          <Micro>{t('how_many')}</Micro>
          <Row style={{ gap: 14, alignItems: 'flex-end' }}>
            <QtyStepper value={formatQty(count)} onMinus={() => step(-1)} onPlus={() => step(1)} minusLabel={fill(t('qty_less'), { food: name })} plusLabel={fill(t('qty_more'), { food: name })} />
            <View style={{ width: 120 }}>
              <Field label={t('qty_grams')} value={gramsDraft ?? String(grams)} onChangeText={typeGrams} keyboardType="numeric" />
            </View>
          </Row>
        </View>

        <Divider />
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Micro>{t('calories')}</Micro>
            <Text style={{ color: C.text, fontSize: F.number, lineHeight: lh(F.number, true), fontWeight: '500' }}>
              {n.kcal}
              <Text style={{ color: C.textFaint, fontSize: F.small, fontWeight: '500' }}> kcal</Text>
            </Text>
          </View>
          <Small color={C.textFaint}>{`${grams} g`}</Small>
        </Row>
        <View style={{ backgroundColor: C.cardAlt, borderRadius: S.radiusSm, padding: 12, gap: 8 }}>
          <Macro icon="fitness-outline" label={t('protein')} value={n.protein} />
          <Macro icon="flame-outline" label={t('carbs')} value={n.carbs} />
          <Macro icon="water-outline" label={t('fat')} value={n.fat} />
        </View>
        {f.source === 'estimate' ? <Small color={C.textFaint}>{t('estimated_values')}</Small> : null}

        <Btn label={initial ? t('done') : t('add_item')} onPress={() => onAdd({ food: f, unit: m.unit, gramsPerUnit: m.grams, count })} />
        <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: 'center', minHeight: S.touch, minWidth: S.touch, justifyContent: 'center', paddingHorizontal: 12 }}>
          <Micro color={C.textDim}>{t('cancel')}</Micro>
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
        <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{label}</Text>
      </Row>
      <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '500' }}>{`${Math.round(value * 10) / 10} g`}</Text>
    </Row>
  );
}
