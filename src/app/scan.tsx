import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { CustomFoodForm } from '../components/CustomFoodForm';
import { kcalForGrams } from '../core/nutrition';
import type { FoodItem } from '../core/types';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Btn, Card, Divider, H2, H3, P, Row, Screen, Small } from '../ui/components';
import { C, F } from '../ui/theme';

type OffProduct = {
  status: number;
  product?: {
    product_name?: string;
    product_name_mr?: string;
    brands?: string;
    serving_quantity?: number;
    nutriments?: Record<string, number>;
  };
};

/**
 * Barcode lookup for packaged food, using Open Food Facts. It is the one place
 * the app reaches the internet, and only for a barcode: no personal data is
 * sent, and everything found is cached as a custom food so it works offline
 * the next time.
 */
export default function ScanScreen() {
  const app = useApp();
  const router = useRouter();
  const t = makeT(app.state.profile.lang);
  const [permission, requestPermission] = useCameraPermissions();

  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<FoodItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function lookup(barcode: string) {
    if (busy || code === barcode) return;
    setCode(barcode);
    setBusy(true);
    setNotFound(false);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
      const json = (await res.json()) as OffProduct;
      const p = json.product;
      const n = p?.nutriments ?? {};
      const kcal100 = n['energy-kcal_100g'];
      if (json.status !== 1 || !p?.product_name || !Number.isFinite(kcal100)) {
        setNotFound(true);
        return;
      }
      const grams = Number.isFinite(p.serving_quantity) && (p.serving_quantity ?? 0) > 0 ? Number(p.serving_quantity) : 100;
      const food: FoodItem = {
        id: `off-${barcode}`,
        name_en: [p.brands?.split(',')[0], p.product_name].filter(Boolean).join(' ').trim(),
        name_mr: p.product_name_mr || p.product_name,
        name_hi: p.product_name_mr || p.product_name,
        category: 'packaged',
        kcal_100g: Math.round(kcal100 as number),
        protein_100g: Math.round((n.proteins_100g ?? 0) * 10) / 10,
        carbs_100g: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
        fat_100g: Math.round((n.fat_100g ?? 0) * 10) / 10,
        portions: [
          { unit: 'serving', label_en: `1 serving (${grams} g)`, label_mr: `१ सर्विंग (${grams} ग्रॅ)`, label_hi: `1 सर्विंग (${grams} ग्राम)`, grams },
          { unit: 'piece', label_en: '100 g', label_mr: '१०० ग्रॅ', label_hi: '100 ग्राम', grams: 100 },
        ],
        default_portion: 'serving',
        tags: ['packaged'],
        source: 'OFF',
      };
      // Cached locally, so the same packet works without a connection next time.
      app.addCustomFood(food);
      setFound(food);
    } catch {
      setNotFound(true);
    } finally {
      setBusy(false);
    }
  }

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <Card>
          <H3>{t('scan_barcode')}</H3>
          <Small>Barcode scanning needs the phone app. Add it by hand instead.</Small>
          <CustomFoodForm onSaved={() => router.back()} onCancel={() => router.back()} />
        </Card>
      </Screen>
    );
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <Card>
          <H3>{t('perm_camera')}</H3>
          <Small>{t('perm_camera_why')}</Small>
          <Btn label={t('perm_allow')} onPress={requestPermission} />
        </Card>
      </Screen>
    );
  }

  if (found) {
    const per = found.portions[0];
    const n = kcalForGrams(found, per.grams);
    return (
      <Screen>
        <Card tone={C.accent}>
          <Small color={C.accent}>{t('barcode_found')}</Small>
          <H2>{found.name_en}</H2>
          <Divider />
          <Row style={{ justifyContent: 'space-between' }}>
            <P>{per.label_en}</P>
            <Text style={{ color: C.text, fontSize: F.h3, fontWeight: '600' }}>{n.kcal} kcal</Text>
          </Row>
          <Small>
            {n.protein} g {t('protein')} · {found.kcal_100g} kcal / 100 g
          </Small>
          <Btn label={t('done')} onPress={() => router.replace('/log')} />
          <Btn
            tone="ghost"
            label={t('scan_barcode')}
            onPress={() => {
              setFound(null);
              setCode(null);
            }}
          />
        </Card>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }}
        onBarcodeScanned={({ data }) => lookup(data)}
      />
      <View style={{ padding: 16, gap: 10 }}>
        <Small>{busy ? '...' : t('scanning')}</Small>
        {notFound ? (
          <Card>
            <Small color={C.amber}>{t('barcode_not_found')}</Small>
            <CustomFoodForm onSaved={() => router.replace('/log')} onCancel={() => setNotFound(false)} />
          </Card>
        ) : null}
        <Btn tone="ghost" label={t('cancel')} onPress={() => router.back()} />
      </View>
    </View>
  );
}
