import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { formatQty, gramsDraftAfter, gramsText, lineGrams, parseGrams, type BasketLine } from '../core/basket';
import { defaultPortion, foodName, measureName } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem, Lang } from '../core/types';
import { fill, makeT } from '../i18n';
import { Btn, Row } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/**
 * One food in the add sheet. Not in the meal yet: its usual portion and
 * calories, and a + a finger wide. In the meal: how many of which measure and
 * the line's calories, a − / + with any count and a grams box under it; − at
 * the last step takes the food out. The name opens the food sheet to pick
 * another measure; a screen reader hears the words shown, calories included.
 * What is typed in the grams box lives here, so − and + can drop it.
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
  const [draft, setDraft] = useState<string | null>(null);
  const name = foodName(food, lang);
  const p = defaultPortion(food);
  const grams = line ? lineGrams(line) : p?.grams ?? 100;
  const kcal = kcalForGrams(food, grams).kcal;
  const measure = line ? `${formatQty(line.count)} × ${measureName(food, line.unit, lang)}` : p ? measureName(food, p.unit, lang) : '';
  const sub = measure ? `${measure} · ${kcal} kcal` : `${kcal} kcal`;
  const step = (by: 1 | -1) => {
    setDraft(gramsDraftAfter('step'));
    onStep(by);
  };
  return (
    <View style={{ paddingVertical: 6, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => {
            setDraft(gramsDraftAfter('open'));
            onOpen();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${sub}`}
          accessibilityHint={t('add_open_food')}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, opacity: pressed ? 0.7 : 1 })}>
          <FoodThumb food={food} lang={lang} size={40} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text numberOfLines={2} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
              {name}
            </Text>
            <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
              {sub}
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
          <QtyStepper value={formatQty(line.count)} onMinus={() => step(-1)} onPlus={() => step(1)} minusLabel={fill(t('qty_less'), { food: name })} plusLabel={fill(t('qty_more'), { food: name })} />
          <GramsBox
            text={gramsText(draft, line)}
            onType={(v) => {
              setDraft(gramsDraftAfter({ typed: v }));
              const g = parseGrams(v);
              if (g !== null) onGrams(g);
            }}
            onLeave={() => setDraft(gramsDraftAfter('leave'))}
            label={fill(t('add_grams_of'), { food: name })}
          />
        </Row>
      ) : null}
    </View>
  );
}

/**
 * The grams of one line, typed; the count follows, and the grams stay exactly
 * as typed. Only a plain amount (parseGrams) changes the line, so "12abc"
 * changes nothing. A tap selects what is there, so typing replaces it.
 */
function GramsBox({ text, onType, onLeave, label }: { text: string; onType: (v: string) => void; onLeave: () => void; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <TextInput
        value={text}
        onChangeText={onType}
        onBlur={onLeave}
        selectTextOnFocus
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
