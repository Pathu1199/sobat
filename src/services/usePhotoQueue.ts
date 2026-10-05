import { useEffect, useRef } from 'react';
import { FOOD_PHOTO_SCHEMA, foodPhotoPrompt } from '../ai/prompts';
import { toISODate } from '../core/date';
import { defaultPortion, resolveByName, toMealItem } from '../core/foods';
import { mealTypeForHour } from '../core/nutrition';
import { nextToProcess } from '../core/queue';
import type { MealItem } from '../core/types';
import { useAI } from './useAI';
import { useApp } from '../store/AppProvider';

type VisionItem = { name_en: string; name_mr?: string; grams_est: number; confidence: number };

/**
 * Works through photos taken while the PC was off. Each one becomes a meal
 * flagged for review rather than being silently trusted, because nobody saw
 * the result when it was produced.
 */
export function usePhotoQueue() {
  const app = useApp();
  const { askJSON, online } = useAI();
  const working = useRef(false);

  // The effect fires on a deliberately narrow trigger: a photo arrived, or the
  // PC came back. Reading the store and the model through refs keeps both
  // current without widening that trigger — widening it would retry a photo
  // the model just failed on straight away, three times over, instead of
  // waiting for the next real change.
  const appRef = useRef(app);
  const askRef = useRef(askJSON);
  useEffect(() => {
    appRef.current = app;
    askRef.current = askJSON;
  });

  const queued = app.state.photoQueue.length;

  useEffect(() => {
    if (!online || working.current) return;
    const store = appRef.current;
    const photo = nextToProcess(store.state.photoQueue);
    if (!photo) return;

    working.current = true;
    (async () => {
      try {
        const result = await askRef.current<{ items?: VisionItem[] }>(
          [{ role: 'user', content: foodPhotoPrompt([]) }, { role: 'user', content: '', images: [photo.base64] }],
          FOOD_PHOTO_SCHEMA,
          true,
        );
        const items: MealItem[] = (result.items ?? []).map((v) => {
          const match = resolveByName(store.foods, v.name_en);
          const grams = Math.max(20, Math.round(v.grams_est || (match ? (defaultPortion(match)?.grams ?? 100) : 100)));
          if (match) return toMealItem(match, grams, false);
          return {
            name_en: v.name_en,
            name_mr: v.name_mr ?? '',
            grams,
            kcal: Math.round((grams / 100) * 180),
            protein: Math.round((grams / 100) * 5 * 10) / 10,
            carbs: Math.round((grams / 100) * 25 * 10) / 10,
            fat: Math.round((grams / 100) * 6 * 10) / 10,
            estimated: true,
          };
        });

        if (items.length === 0) {
          store.failPhoto(photo.id, 'nothing recognised');
          return;
        }

        const at = new Date(photo.at || Date.now());
        store.addMeal({
          id: `q-${photo.id}`,
          at: at.toISOString(),
          date: photo.date || toISODate(at),
          type: mealTypeForHour(at.getHours()),
          items,
          kcal: items.reduce((a, i) => a + i.kcal, 0),
          protein: Math.round(items.reduce((a, i) => a + i.protein, 0)),
          photoUri: photo.uri,
          note: 'needs_review',
        });
        store.unqueuePhoto(photo.id);
      } catch (e) {
        store.failPhoto(photo.id, String(e));
      } finally {
        working.current = false;
      }
    })();
  }, [online, queued]);
}
