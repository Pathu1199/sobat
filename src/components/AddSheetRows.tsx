import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { amountText, formatQty, gramsDraftAfter, gramsText, lineGrams, parseGrams, type BasketLine } from '../core/basket';
import { defaultPortion, foodName, inMl, measureName } from '../core/foods';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem, Lang } from '../core/types';
import { fill, makeT } from '../i18n';
import { Btn, Field, Row } from '../ui/components';
import { QtyStepper } from '../ui/QtyStepper';
import { C, F, lh, S } from '../ui/theme';
import { FoodThumb } from './FoodDetailSheet';

/**
 * The small line under a row's name: its words, then the calories in a text
 * of their own that never shrinks, so a line too long for the row cuts the
 * words short and never the calories.
 */
function SubLine({ words, kcal }: { words: string; kcal: number }) {
  const faint = { color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) } as const;
  return (
    <View style={{ flexDirection: 'row', minWidth: 0 }}>
      {words ? (
        <Text numberOfLines={1} style={[faint, { flexShrink: 1 }]}>
          {words}
        </Text>
      ) : null}
      <Text numberOfLines={1} style={[faint, { flexShrink: 0 }]}>{words ? ` · ${kcal} kcal` : `${kcal} kcal`}</Text>
    </View>
  );
}

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
  const measure = line ? amountText(line.count, measureName(food, line.unit, lang)) : p ? measureName(food, p.unit, lang) : '';
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
            <SubLine words={measure} kcal={kcal} />
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
            unit={inMl(food, line.unit) ? t('tile_unit_ml') : 'g'}
            label={fill(t(inMl(food, line.unit) ? 'add_ml_of' : 'add_grams_of'), { food: name })}
          />
        </Row>
      ) : null}
    </View>
  );
}

/**
 * The grams of one line, typed; the count follows, and the grams stay exactly
 * as typed. Only a plain amount (parseGrams) changes the line, so "12abc"
 * changes nothing. A tap selects what is there, so typing replaces it. A
 * drink by the cup or glass says ml (`inMl`): the database counts its ml as
 * its grams.
 */
function GramsBox({ text, onType, onLeave, unit, label }: { text: string; onType: (v: string) => void; onLeave: () => void; unit: string; label: string }) {
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
      <Text style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>{unit}</Text>
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

/** The slot as planned, highlighted: its foods and calories, Ate as planned, and Change to put them in the meal to adjust. */
export function PlannedCard({ title, summary, kcal, lang, onAte, onChange }: { title: string; summary: string; kcal: number; lang: Lang; onAte: () => void; onChange: () => void }) {
  const t = makeT(lang);
  return (
    <View style={{ marginTop: 10, padding: 14, gap: 10, borderRadius: S.radiusSm, borderWidth: 1, borderColor: C.accent, backgroundColor: C.accentDim }}>
      <Text style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>{title}</Text>
      <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>{`${summary} · ${kcal} kcal`}</Text>
      <Row style={{ gap: 8 }}>
        <Btn small label={t('menu_ate_planned')} onPress={onAte} style={{ flex: 1 }} />
        <Btn small tone="ghost" label={t('menu_change')} onPress={onChange} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

/**
 * One row that logs in one tap: the same as yesterday, or a saved meal. A screen reader hears what the tap does and the words
 * under it, calories included. With `kcal`, the calories follow the words in a text of their own and are never cut off.
 */
export function OneTapRow({ icon, title, sub, kcal, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; kcal?: number; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={kcal === undefined ? `${label}, ${sub}` : `${label}, ${sub} · ${kcal} kcal`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: S.touch, paddingVertical: 8, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: C.cardAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={18} color={C.accentText} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ color: C.text, fontSize: F.body, lineHeight: lh(F.body), fontWeight: '500' }}>
          {title}
        </Text>
        {kcal === undefined ? (
          <Text numberOfLines={1} style={{ color: C.textFaint, fontSize: F.small, lineHeight: lh(F.small) }}>
            {sub}
          </Text>
        ) : (
          <SubLine words={sub} kcal={kcal} />
        )}
      </View>
      <Ionicons name="add-circle-outline" size={22} color={C.accentText} />
    </Pressable>
  );
}

/**
 * After a logged meal of two or more foods: the line saying it was logged
 * (the app-wide toast would sit behind the sheet), and an offer to keep it as
 * one of the person's meals, under a name they choose.
 */
export function SaveAsOffer({ lang, logged, onSave, onSkip }: { lang: Lang; logged: string; onSave: (name: string) => void; onSkip: () => void }) {
  const t = makeT(lang);
  const [name, setName] = useState('');
  return (
    <View style={{ padding: S.padLg, gap: 12 }}>
      <Row style={{ gap: 8 }}>
        <Ionicons name="checkmark-circle" size={18} color={C.accentText} />
        <Text accessibilityLiveRegion="polite" style={{ flex: 1, color: C.textDim, fontSize: F.small, lineHeight: lh(F.small) }}>
          {logged}
        </Text>
      </Row>
      <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
        {t('add_save_as_title')}
      </Text>
      <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: lh(F.body) }}>{t('add_save_as_body')}</Text>
      {/* Field grows to fill its row; in a column it would grow tall instead. */}
      <View style={{ flexDirection: 'row' }}>
        <Field label={t('add_meal_name')} value={name} onChangeText={setName} placeholder={t('add_meal_name_hint')} autoFocus />
      </View>
      <Row style={{ gap: 8 }}>
        <Btn label={t('save')} onPress={() => onSave(name.trim())} disabled={!name.trim()} style={{ flex: 1 }} />
        <Btn tone="ghost" label={t('add_not_now')} onPress={onSkip} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}
