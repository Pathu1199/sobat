import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { FOOD_PHOTO_SCHEMA, foodPhotoPrompt } from '../ai/prompts';
import { toISODate } from '../core/date';
import { defaultPortion, foodName, resolveByName, searchFoods, toMealItem } from '../core/foods';
import { mealTypeForHour } from '../core/nutrition';
import { pendingCount } from '../core/queue';
import type { FoodItem, MealItem, MealType } from '../core/types';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, Field, H2, H3, P, Pill, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

type VisionItem = { name_en: string; name_mr?: string; portion?: string; grams_est: number; confidence: number };
type VisionResult = { items: VisionItem[]; notes?: string };

type Draft = {
  key: string;
  food: FoodItem | null;
  rawName: string;
  nameMrGuess: string;
  grams: number;
  confidence: number;
  estimated: boolean;
};

export default function PhotoScreen() {
  const app = useApp();
  const router = useRouter();
  const { askJSON, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);

  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState<MealType>(mealTypeForHour(new Date().getHours()));

  const items: MealItem[] = drafts.map((d) =>
    d.food
      ? toMealItem(d.food, d.grams, d.estimated)
      : {
          name_en: d.rawName,
          name_mr: d.nameMrGuess,
          grams: d.grams,
          // No database match, so this line is the model's guess and is badged as such.
          kcal: Math.round((d.grams / 100) * 180),
          protein: Math.round((d.grams / 100) * 5 * 10) / 10,
          carbs: Math.round((d.grams / 100) * 25 * 10) / 10,
          fat: Math.round((d.grams / 100) * 6 * 10) / 10,
          estimated: true,
        },
  );
  const totalKcal = items.reduce((a, i) => a + i.kcal, 0);
  const totalProtein = Math.round(items.reduce((a, i) => a + i.protein, 0));

  const corrections = useMemo(
    () =>
      app.state.meals
        .filter((m) => m.photoUri && m.note?.startsWith('corrected:'))
        .slice(-10)
        .map((m) => {
          const [predicted, corrected] = (m.note ?? '').replace('corrected:', '').split('->');
          return { predicted: predicted ?? '', corrected: corrected ?? '' };
        }),
    [app.state.meals],
  );

  async function pick(fromCamera: boolean) {
    setError(null);
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Permission denied');
      return;
    }
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true, allowsEditing: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setUri(asset.uri);
    setDrafts([]);
    if (asset.base64) analyse(asset.base64, asset.uri);
    else setError('Could not read the image');
  }

  async function analyse(base64: string, sourceUri?: string) {
    if (!online) {
      // The screen has always said "queued"; this is what makes that true.
      queue(base64, sourceUri);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await askJSON<VisionResult>(
        [{ role: 'user', content: foodPhotoPrompt(corrections), images: [base64] }],
        FOOD_PHOTO_SCHEMA,
        true,
      );
      const next: Draft[] = (result.items ?? []).map((v, i) => {
        // Calories come from the food list, never from the model.
        const match = resolveByName(app.foods, v.name_en);
        return {
          key: `${i}-${v.name_en}`,
          food: match,
          rawName: v.name_en,
          nameMrGuess: v.name_mr ?? '',
          grams: Math.max(20, Math.round(v.grams_est || (match ? (defaultPortion(match)?.grams ?? 100) : 100))),
          confidence: v.confidence ?? 0.5,
          estimated: !match,
        };
      });
      setDrafts(next);
      if (next.length === 0) setError(t('no_results'));
    } catch (e) {
      if (online) {
        setError('The model did not return a readable answer. Try again or log by hand.');
      } else {
        queue(base64, uri ?? undefined);
      }
    } finally {
      setBusy(false);
    }
  }

  function queue(base64: string, sourceUri?: string) {
    const now = new Date();
    app.queuePhoto({
      id: String(now.getTime()),
      uri: sourceUri ?? uri ?? '',
      base64,
      at: now.toISOString(),
      date: toISODate(now),
      attempts: 0,
    });
    setError(t('queued'));
  }

  function swap(key: string, food: FoodItem) {
    setDrafts((d) =>
      d.map((x) =>
        x.key === key ? { ...x, food, estimated: false, grams: defaultPortion(food)?.grams ?? x.grams } : x,
      ),
    );
    setEditing(null);
    setSearch('');
  }

  function save() {
    if (items.length === 0) return;
    const now = new Date();
    const changed = drafts.filter((d) => d.food && d.food.name_en.toLowerCase() !== d.rawName.toLowerCase());
    app.addMeal({
      id: String(now.getTime()),
      at: now.toISOString(),
      date: toISODate(now),
      type: mealType,
      items,
      kcal: totalKcal,
      protein: totalProtein,
      photoUri: uri ?? undefined,
      // Stored so the next similar photo gets your correction as a hint.
      note: changed.length > 0 ? `corrected:${changed[0].rawName}->${changed[0].food!.name_en}` : undefined,
    });
    router.replace('/');
  }

  return (
    <Screen>
      <Card>
        <H2>{t('photo_title')}</H2>
        <Small>{t('photo_hint')}</Small>
        <Row style={{ gap: 8 }}>
          <Btn label={t('take_photo')} onPress={() => pick(true)} style={{ flex: 1 }} />
          <Btn label={t('pick_photo')} tone="soft" onPress={() => pick(false)} style={{ flex: 1 }} />
        </Row>
        {!online ? <Small color={C.amber}>{t('ai_offline_hint')}</Small> : null}
        {pendingCount(app.state.photoQueue) > 0 ? (
          <Small color={C.blue}>
            {(pendingCount(app.state.photoQueue) === 1 ? t('photos_queued') : t('photos_queued_plural')).replace(
              '{n}',
              String(pendingCount(app.state.photoQueue)),
            )}
          </Small>
        ) : null}
      </Card>

      {uri ? (
        <Card>
          <Image source={{ uri }} style={{ width: '100%', height: 200, borderRadius: 10 }} resizeMode="cover" />
          {busy ? (
            <Row>
              <ActivityIndicator color={C.teal} />
              <Small>{t('analysing')}</Small>
            </Row>
          ) : null}
          {error ? <Small color={C.amber}>{error}</Small> : null}
        </Card>
      ) : null}

      {drafts.length > 0 ? (
        <Card>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {(['breakfast', 'lunch', 'snack', 'dinner'] as MealType[]).map((m) => (
              <Pill key={m} label={t(m)} active={mealType === m} onPress={() => setMealType(m)} />
            ))}
          </Row>
          <Divider />

          {drafts.map((d, idx) => {
            const item = items[idx];
            const displayEn = d.food ? d.food.name_en : d.rawName;
            const displayMr = d.food ? d.food.name_mr : d.nameMrGuess;
            return (
              <View key={d.key} style={{ gap: 8, paddingVertical: 8 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <P>{displayEn}</P>
                    {displayMr ? <Small color={C.teal}>{displayMr}</Small> : null}
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: C.text, fontWeight: '600' }}>{item.kcal} kcal</Text>
                    <Small>{item.grams} g</Small>
                  </View>
                  <Pressable onPress={() => setDrafts((x) => x.filter((y) => y.key !== d.key))} accessibilityLabel={t('delete')}>
                    <Ionicons name="close" size={18} color={C.textFaint} />
                  </Pressable>
                </Row>

                <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                  {d.estimated ? <Pill label={t('estimated')} color={C.amberSoft} /> : null}
                  <Pill label={`${Math.round(d.confidence * 100)}%`} />
                  {[0.5, 1, 1.5, 2].map((mult) => {
                    const base = d.food ? (defaultPortion(d.food)?.grams ?? 100) : 100;
                    return (
                      <Pill
                        key={mult}
                        label={`${mult}x`}
                        active={Math.abs(d.grams - base * mult) < 5}
                        onPress={() => setDrafts((x) => x.map((y) => (y.key === d.key ? { ...y, grams: Math.round(base * mult) } : y)))}
                      />
                    );
                  })}
                  <Pill label={t('edit')} onPress={() => setEditing(editing === d.key ? null : d.key)} />
                </Row>

                {editing === d.key ? (
                  <View style={{ gap: 6 }}>
                    <Field value={search} onChangeText={setSearch} placeholder={t('search_food')} />
                    {searchFoods(app.foods, search || d.rawName, 6).map((f) => (
                      <Pressable key={f.id} onPress={() => swap(d.key, f)}>
                        <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
                          <View style={{ flex: 1 }}>
                            <P>{foodName(f, lang)}</P>
                            <Small>{f.name_mr}</Small>
                          </View>
                          <Small>{f.kcal_100g} /100g</Small>
                        </Row>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Divider />
              </View>
            );
          })}

          <Row style={{ justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600' }}>{totalKcal} kcal</Text>
              <Small>{totalProtein} g {t('protein')}</Small>
            </View>
            <Btn label={t('save')} onPress={save} />
          </Row>
        </Card>
      ) : null}
    </Screen>
  );
}
