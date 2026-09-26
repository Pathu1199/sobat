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

  useEffect(() => {
    if (!online || working.current) return;
    const photo = nextToProcess(app.state.photoQueue);
    if (!photo) return;

    working.current = true;
    (async () => {
      try {
        const result = await askJSON<{ items?: VisionItem[] }>(
          [{ role: 'user', content: foodPhotoPrompt([]) }, { role: 'user', content: '', images: [photo.base64] }],
          FOOD_PHOTO_SCHEMA,
          true,
        );
        const items: MealItem[] = (result.items ?? []).map((v) => {
          const match = resolveByName(app.foods, v.name_en);
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
          app.failPhoto(photo.id, 'nothing recognised');
          return;
        }

        const at = new Date(photo.at || Date.now());
        app.addMeal({
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
        app.unqueuePhoto(photo.id);
      } catch (e) {
        app.failPhoto(photo.id, String(e));
      } finally {
        working.current = false;
      }
    })();
  }, [online, app.state.photoQueue.length]);
}
