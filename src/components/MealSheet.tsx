import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { localHHMM } from '../core/date';
import { defaultPortion, scaleMealItem, toMealItem } from '../core/foods';
import type { Meal, MealItem } from '../core/types';
import { makeT } from '../i18n';
import { useFeedback } from '../services/feedback';
import { useApp } from '../store/AppProvider';
import { BiText, Btn, Divider, Micro, Pill, Row } from '../ui/components';
import { Sheet } from '../ui/Sheet';
import { C, F } from '../ui/theme';

const MULTIPLIERS = [0.5, 1, 1.5, 2];

/** Shows a logged meal's lines; portions can be changed, lines removed, the meal deleted. */
export function MealSheet({ meal, onClose }: { meal: Meal | null; onClose: () => void }) {
  const app = useApp();
  const fb = useFeedback();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const [items, setItems] = useState<MealItem[]>(meal?.items ?? []);
  const [opened, setOpened] = useState<number[]>([]);
  const [openId, setOpenId] = useState<string | null>(meal?.id ?? null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The working copy resets whenever a different meal (or none) opens. Doing
  // this during render, rather than in an effect, keeps the first paint in
  // sync and avoids a redundant extra render.
  const mealId = meal?.id ?? null;
  if (mealId !== openId) {
    setOpenId(mealId);
    setItems(meal?.items ?? []);
    setOpened((meal?.items ?? []).map((i) => i.grams));
    setConfirmDelete(false);
  }

  if (!meal) return null;
  // Narrowed once so the closures below (which TS otherwise treats as possibly
  // seeing `meal` turn null before they run) can use it directly.
  const current = meal;

  const kcal = items.reduce((a, i) => a + i.kcal, 0);
  const protein = Math.round(items.reduce((a, i) => a + i.protein, 0));
  const changed = JSON.stringify(items) !== JSON.stringify(meal.items);

  function setGrams(index: number, grams: number) {
    setItems((list) =>
      list.map((it, i) => {
        if (i !== index) return it;
        const food = it.foodId ? app.foods.find((f) => f.id === it.foodId) : undefined;
        return food ? toMealItem(food, grams, it.estimated) : scaleMealItem(it, grams);
      }),
    );
  }

  function save() {
    app.updateMeal({ ...current, items, kcal, protein });
    fb.haptic('success');
    fb.notify(t('toast_meal_saved').replace('{kcal}', String(kcal)));
    onClose();
  }

  function remove() {
    app.removeMeal(current.id);
    fb.haptic('light');
    onClose();
  }

  return (
    <Sheet open={!!meal} onClose={onClose} title={`${t(meal.type)} · ${localHHMM(meal.at)}`}>
      {items.length === 0 ? <Micro>{t('nothing_logged')}</Micro> : null}
      {items.map((it, idx) => {
        const food = it.foodId ? app.foods.find((f) => f.id === it.foodId) : undefined;
        const portion = food ? defaultPortion(food) : undefined;
        const unitGrams = portion?.grams ?? opened[idx] ?? it.grams;
        return (
          <View key={`${it.name_en}-${idx}`} style={{ gap: 8 }}>
            {idx > 0 ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 3 }}>
                <BiText en={it.name_en} alt={lang === 'en' ? undefined : it.name_mr} />
                <Micro>{`${it.grams} g${it.estimated ? ` · ${t('estimated')}` : ''}`}</Micro>
              </View>
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>
                {it.kcal}
                <Text style={{ color: C.textFaint, fontSize: F.tiny, fontWeight: '500' }}> kcal</Text>
              </Text>
              <Pressable
                onPress={() => {
                  setItems((l) => l.filter((_, i) => i !== idx));
                  setOpened((l) => l.filter((_, i) => i !== idx));
                }}
                hitSlop={8}
                accessibilityLabel={t('delete')}>
                <Ionicons name="close" size={17} color={C.textFaint} />
              </Pressable>
            </Row>
            <Row style={{ gap: 6, flexWrap: 'wrap' }}>
              {MULTIPLIERS.map((m) => (
                <Pill key={m} label={`${m}x`} active={Math.round(unitGrams * m) === it.grams} onPress={() => setGrams(idx, unitGrams * m)} />
              ))}
            </Row>
          </View>
        );
      })}
      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '500' }}>{kcal}</Text>
          <Micro>{`kcal · ${protein} g ${t('protein')}`}</Micro>
        </View>
        <Row style={{ gap: 8 }}>
          {confirmDelete ? (
            <>
              <Btn small tone="danger" label={t('delete')} onPress={remove} />
              <Btn small tone="ghost" label={t('cancel')} onPress={() => setConfirmDelete(false)} />
            </>
          ) : (
            <Btn small tone="ghost" label={t('delete')} onPress={() => setConfirmDelete(true)} />
          )}
          <Btn small label={t('save')} onPress={save} disabled={!changed || items.length === 0} />
        </Row>
      </Row>
    </Sheet>
  );
}
