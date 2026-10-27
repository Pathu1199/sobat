import { useEffect, useRef } from 'react';
import { FOOD_PHOTO_SCHEMA, foodPhotoPrompt } from '../ai/prompts';
import { toISODate } from '../core/date';
import { defaultPortion, resolveByName, toMealItem } from '../core/foods';
import { EATEN_NOW_MS, slotAt } from '../core/pattern';
import { MAX_ATTEMPTS, nextToProcess } from '../core/queue';
import type { MealItem } from '../core/types';
import { loadPhoto, removePhoto } from './photoStore';
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
        // Older queue entries carried the bytes themselves; newer ones keep them aside.
        const base64 = photo.base64 ?? (await loadPhoto(photo.id));
        if (!base64) {
          // Nothing to analyse: the bytes were lost, so the entry is just noise.
          store.unqueuePhoto(photo.id);
          return;
        }
        const result = await askRef.current<{ items?: VisionItem[] }>(
          [{ role: 'user', content: foodPhotoPrompt([]) }, { role: 'user', content: '', images: [base64] }],
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
          if (photo.attempts + 1 >= MAX_ATTEMPTS) await removePhoto(photo.id);
          return;
        }

        const at = new Date(photo.at || Date.now());
        // The slot whose turn it was when the photo was taken, by the person's own pattern.
        // One taken just now is left to find its slot the way any meal eaten now does.
        const slot = slotAt(store.state.routine, at.getHours() * 60 + at.getMinutes());
        const justNow = Math.abs(Date.now() - at.getTime()) <= EATEN_NOW_MS;
        store.addMeal({
          id: `q-${photo.id}`,
          at: at.toISOString(),
          date: photo.date || toISODate(at),
          type: slot?.type ?? 'snack',
          slotId: justNow ? undefined : slot?.id,
          items,
          kcal: items.reduce((a, i) => a + i.kcal, 0),
          protein: Math.round(items.reduce((a, i) => a + i.protein, 0)),
          photoUri: photo.uri,
          note: 'needs_review',
        });
        store.unqueuePhoto(photo.id);
        await removePhoto(photo.id);
      } catch (e) {
        store.failPhoto(photo.id, String(e));
        if (photo.attempts + 1 >= MAX_ATTEMPTS) await removePhoto(photo.id);
      } finally {
        working.current = false;
      }
    })();
  }, [online, queued]);
}
