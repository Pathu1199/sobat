import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatQty, gramsText, lineGrams, parseGrams, type BasketLine } from '../core/basket';
import { defaultPortion, foodName, portionLabel } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem, Lang } from '../core/types';
import { fill, makeT } from '../i18n';
import { Btn, Row } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/** A measure's name: one of the food's own portions, else the household measure. */
function measureName(food: FoodItem, unit: string, t: (key: string) => string, lang: Lang): string {
  const own = food.portions.find((p) => p.unit === unit);
  return own ? portionLabel(own, lang) : t(`measure_${unit}`);
}

/**
 * One food in the add sheet. Not in the meal yet: its usual portion and
 * calories, and a + a finger wide. In the meal: a − / + with any count and a
 * grams box under it; − at the last step takes the food out. The name opens
 * the food sheet to pick another measure.
 */
export function FoodRow({
  food,
  line,
  lang,
  onAdd,
  onStep,
  onGrams,
  onOpen,
}: {
  food: FoodItem;
  line: BasketLine | undefined;
  lang: Lang;
  onAdd: () => void;
  onStep: (by: 1 | -1) => void;
  onGrams: (grams: number) => void;
  onOpen: () => void;
}) {
  const t = makeT(lang);
  const name = foodName(food, lang);
  const p = defaultPortion(food);
  const grams = line ? lineGrams(line) : p?.grams ?? 100;
  const measure = line ? measureName(food, line.unit, t, lang) : p ? portionLabel(p, lang) : '';
  const kcal = kcalForGrams(food, grams).kcal;
  return (
    <View style={{ paddingVertical: 6, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={fill(t('add_open_food'), { food: name })}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          <FoodThumb food={food} lang={lang} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={2} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
              {measure ? `${measure} · ${kcal} kcal` : `${kcal} kcal`}
            </Text>
          </View>
        </Pressable>
        {line ? null : (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={fill(t('add_food_named'), { food: name })}
            style={({ pressed }) => ({ width: S.touch, height: S.touch, borderRadius: S.touch / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? C.accentSoft : C.accentDim })}>
            <Ionicons name="add" size={22} color={C.accentText} />
          </Pressable>
        )}
      </View>
      {line ? (
        <Row style={{ gap: 12, paddingLeft: 52 }}>
          <QtyStepper value={formatQty(line.count)} onMinus={() => onStep(-1)} onPlus={() => onStep(1)} minusLabel={fill(t('qty_less'), { food: name })} plusLabel={fill(t('qty_more'), { food: name })} />
          <GramsBox line={line} onChange={onGrams} label={fill(t('add_grams_of'), { food: name })} />
        </Row>
      ) : null}
    </View>
  );
}

/**
 * The grams of one line, typed; the count follows, and the grams stay exactly
 * as typed. While typing, the box keeps what is typed (gramsText), and only a
 * plain amount (parseGrams) changes the line, so "12abc" changes nothing.
 */
function GramsBox({ line, onChange, label }: { line: BasketLine; onChange: (grams: number) => void; label: string }) {
  const [draft, setDraft] = useState<{ text: string; grams: number } | null>(null);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput
        value={gramsText(draft, line)}
        onChangeText={(v) => {
          setDraft({ text: v, grams: lineGrams(line) });
          const g = parseGrams(v);
          if (g !== null) onChange(g);
        }}
        onBlur={() => setDraft(null)}
        keyboardType="numeric"
        accessibilityLabel={label}
        style={{ width: 76, minHeight: S.touch, paddingHorizontal: 10, borderRadius: 12, borderWidth: S.hairline, borderColor: C.border, backgroundColor: C.cardAlt, color: C.text, fontSize: F.body, textAlign: 'right' }}
      />
      <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>g</Text>
    </View>
  );
}

/** Photo and barcode as two small buttons, and a food of the person's own. */
export function ToolsRow({ lang, onPhoto, onBarcode, onCustom }: { lang: Lang; onPhoto: () => void; onBarcode: () => void; onCustom: () => void }) {
  const t = makeT(lang);
  return (
    <View style={{ gap: 8, paddingTop: 14 }}>
      <Row style={{ gap: 8 }}>
        <Btn small tone="soft" icon={<Ionicons name="camera-outline" size={15} color={C.accentText} />} label={t('add_photo')} onPress={onPhoto} style={{ flex: 1 }} />
        <Btn small tone="soft" icon={<Ionicons name="barcode-outline" size={15} color={C.accentText} />} label={t('scan_barcode')} onPress={onBarcode} style={{ flex: 1 }} />
      </Row>
      <Btn small tone="ghost" label={t('custom_food')} onPress={onCustom} />
    </View>
  );
}
