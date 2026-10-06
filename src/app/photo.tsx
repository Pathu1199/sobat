import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { FOOD_PHOTO_SCHEMA, foodPhotoPrompt } from '../ai/prompts';
import { toISODate } from '../core/date';
import { newId } from '../core/id';
import { defaultPortion, resolveByName, searchFoods, toMealItem } from '../core/foods';
import { mealTypeForHour } from '../core/nutrition';
import { pendingCount } from '../core/queue';
import type { FoodItem, MealItem, MealType } from '../core/types';
import { makeT } from '../i18n';
import { useAI } from '../services/useAI';
import { useApp } from '../store/AppProvider';
import { BiText, Btn, Card, Divider, Field, Micro, Pill, Row, Screen, SectionHeader, Segmented, Small } from '../ui/components';
import { C, F, S } from '../ui/theme';

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

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function PhotoScreen() {
  const app = useApp();
  const router = useRouter();
  const { askJSON, online } = useAI();
  const lang = app.state.profile.lang;
  const t = makeT(lang);
  const en = makeT('en');

  const [uri, setUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForHour(app.hour));

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
  const queued = pendingCount(app.state.photoQueue);

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
      setError(t('perm_denied'));
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
    else setError(t('photo_unreadable'));
  }

  function queue(base64: string, sourceUri?: string) {
    const now = new Date();
    app.queuePhoto({
      id: newId(),
      uri: sourceUri ?? uri ?? '',
      base64,
      at: now.toISOString(),
      date: toISODate(now),
      attempts: 0,
    });
    setError(t('queued'));
  }

  async function analyse(base64: string, sourceUri?: string) {
    if (!online) {
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
    } catch {
      if (online) setError(t('model_unreadable'));
      else queue(base64, sourceUri);
    } finally {
      setBusy(false);
    }
  }

  function swap(key: string, food: FoodItem) {
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, food, estimated: false, grams: defaultPortion(food)?.grams ?? x.grams } : x)));
    setEditing(null);
    setSearch('');
  }

  function save() {
    if (items.length === 0) return;
    const now = new Date();
    const changed = drafts.filter((d) => d.food && d.food.name_en.toLowerCase() !== d.rawName.toLowerCase());
    app.addMeal({
      id: newId(),
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
      {!uri ? (
        <Card>
          <View
            style={{
              borderWidth: 1,
              borderColor: C.borderStrong,
              borderStyle: 'dashed',
              borderRadius: S.radius,
              paddingVertical: 38,
              alignItems: 'center',
              gap: 12,
            }}>
            <Ionicons name="camera-outline" size={30} color={C.accent} />
            <Text style={{ color: C.text, fontSize: F.body, fontWeight: '500' }}>{t('photo_title')}</Text>
            <Micro>{t('photo_hint')}</Micro>
          </View>
          <Row style={{ gap: 8 }}>
            <Btn label={t('take_photo')} onPress={() => pick(true)} style={{ flex: 1 }} />
            <Btn tone="soft" label={t('pick_photo')} onPress={() => pick(false)} style={{ flex: 1 }} />
          </Row>
          {!online ? <Small color={C.amber}>{t('ai_offline_hint')}</Small> : null}
          {queued > 0 ? (
            <Small color={C.cyan}>{(queued === 1 ? t('photos_queued') : t('photos_queued_plural')).replace('{n}', String(queued))}</Small>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Image source={{ uri }} style={{ width: '100%', height: 190, borderRadius: S.radiusSm }} resizeMode="cover" />
          {busy ? (
            <Row>
              <ActivityIndicator color={C.accent} />
              <Micro>{t('analysing')}</Micro>
            </Row>
          ) : null}
          {error ? <Small color={C.amber}>{error}</Small> : null}
          <Row style={{ gap: 8 }}>
            <Btn small tone="soft" label={t('take_photo')} onPress={() => pick(true)} style={{ flex: 1 }} />
            <Btn small tone="ghost" label={t('cancel')} onPress={() => router.back()} style={{ flex: 1 }} />
          </Row>
        </Card>
      )}

      {drafts.length > 0 ? (
        <>
          <Segmented value={mealType} onChange={setMealType} options={MEAL_TYPES.map((m) => ({ key: m, label: en(m) }))} />

          <View style={{ gap: 10 }}>
            <SectionHeader title={t('detected')} meta={`${drafts.length}`} />
            <Card>
              {drafts.map((d, idx) => {
                const item = items[idx];
                const displayEn = d.food ? d.food.name_en : d.rawName;
                const displayMr = d.food ? d.food.name_mr : d.nameMrGuess;
                return (
                  <View key={d.key} style={{ gap: 9 }}>
                    {idx > 0 ? <Divider /> : null}
                    <Row style={{ justifyContent: 'space-between' }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <BiText en={displayEn} alt={lang === 'en' ? undefined : displayMr} />
                        <Micro>{`${item.grams} g`}</Micro>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{item.kcal}</Text>
                        <Micro>kcal</Micro>
                      </View>
                      <Pressable onPress={() => setDrafts((x) => x.filter((y) => y.key !== d.key))} hitSlop={8}>
                        <Ionicons name="close" size={16} color={C.textGhost} />
                      </Pressable>
                    </Row>

                    <Row style={{ gap: 6, flexWrap: 'wrap' }}>
                      {d.estimated ? <Pill label={t('estimated')} color={C.amberSoft} textColor={C.amber} tone={C.amber} /> : null}
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
                            <Row style={{ justifyContent: 'space-between', paddingVertical: 7 }}>
                              <BiText en={f.name_en} alt={lang === 'en' ? undefined : f.name_mr} size={F.small} />
                              <Micro>{`${f.kcal_100g} /100g`}</Micro>
                            </Row>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          </View>

          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: C.text, fontSize: 28, fontWeight: '300' }}>{totalKcal}</Text>
                <Micro>{`kcal · ${totalProtein} g ${t('protein')}`}</Micro>
              </View>
              <Btn label={t('save')} onPress={save} />
            </Row>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
