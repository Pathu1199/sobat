import React, { useState } from 'react';
import { View } from 'react-native';
import type { FoodItem } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H3, Pill, Row, Small } from '../ui/components';
import { C } from '../ui/theme';

const CATEGORIES = ['grain', 'dal', 'veg', 'nonveg', 'dairy', 'snack', 'sweet', 'beverage', 'fruit', 'fast_food', 'other'];

/**
 * Adding your own food. The search screen has always told people to do this;
 * this is the form that actually does it. Entry is per serving, because that
 * is what a packet or a home recipe tells you, not per 100 g.
 */
export function CustomFoodForm({ initialName, onSaved, onCancel }: { initialName?: string; onSaved: (f: FoodItem) => void; onCancel: () => void }) {
  const app = useApp();
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  const [nameEn, setNameEn] = useState(initialName ?? '');
  const [nameMr, setNameMr] = useState('');
  const [kcal, setKcal] = useState('');
  const [grams, setGrams] = useState('150');
  const [protein, setProtein] = useState('');
  const [category, setCategory] = useState('other');

  const kcalN = parseFloat(kcal);
  const gramsN = parseFloat(grams);
  const proteinN = parseFloat(protein) || 0;
  const valid = nameEn.trim().length > 1 && Number.isFinite(kcalN) && kcalN > 0 && Number.isFinite(gramsN) && gramsN > 0;

  function save() {
    if (!valid) return;
    const per100 = (n: number) => Math.round((n / gramsN) * 100 * 10) / 10;
    // Whatever is not protein is split the usual way, so macros stay plausible.
    const kcalFromProtein = proteinN * 4;
    const rest = Math.max(0, kcalN - kcalFromProtein);
    const carbsG = (rest * 0.6) / 4;
    const fatG = (rest * 0.4) / 9;

    const food: FoodItem = {
      id: `custom-${Date.now()}`,
      name_en: nameEn.trim(),
      name_mr: nameMr.trim() || nameEn.trim(),
      name_hi: nameMr.trim() || nameEn.trim(),
      category,
      kcal_100g: Math.round(per100(kcalN)),
      protein_100g: per100(proteinN),
      carbs_100g: per100(carbsG),
      fat_100g: per100(fatG),
      portions: [
        {
          unit: 'serving',
          label_en: `1 serving (${Math.round(gramsN)} g)`,
          label_mr: `१ वाटी (${Math.round(gramsN)} ग्रॅ)`,
          label_hi: `1 सर्विंग (${Math.round(gramsN)} ग्राम)`,
          grams: Math.round(gramsN),
        },
      ],
      default_portion: 'serving',
      tags: ['custom'],
      source: 'estimate',
    };
    app.addCustomFood(food);
    onSaved(food);
  }

  return (
    <Card tone={C.teal}>
      <H3>{t('custom_food')}</H3>
      <Small>{t('custom_food_hint')}</Small>

      <Field label={t('custom_name_en')} value={nameEn} onChangeText={setNameEn} placeholder="Aunty's poha" />
      <Field label={t('custom_name_mr')} value={nameMr} onChangeText={setNameMr} placeholder="पोहे" />

      <Row style={{ gap: 12 }}>
        <Field label={t('custom_kcal')} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="270" />
        <Field label={t('custom_grams')} value={grams} onChangeText={setGrams} keyboardType="numeric" placeholder="150" />
      </Row>
      <Field label={`${t('protein')} (g, ${t('portion').toLowerCase()})`} value={protein} onChangeText={setProtein} keyboardType="numeric" placeholder="5" />

      <Small>{t('custom_category')}</Small>
      <Row style={{ flexWrap: 'wrap', gap: 6 }}>
        {CATEGORIES.map((c) => (
          <Pill key={c} label={c.replace('_', ' ')} active={category === c} onPress={() => setCategory(c)} />
        ))}
      </Row>

      <Divider />
      <Row style={{ gap: 8 }}>
        <Btn label={t('save')} onPress={save} disabled={!valid} style={{ flex: 1 }} />
        <Btn tone="ghost" label={t('cancel')} onPress={onCancel} style={{ flex: 1 }} />
      </Row>
    </Card>
  );
}
