import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { Logo, Wordmark } from '../ui/Logo';
import { C, F, MICRO, S } from '../ui/theme';
import { useBreakpoint } from '../ui/useBreakpoint';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; titleKey: string; bodyKey: string }[] = [
  { icon: 'restaurant-outline', titleKey: 'w_f1_t', bodyKey: 'w_f1_b' },
  { icon: 'camera-outline', titleKey: 'w_f2_t', bodyKey: 'w_f2_b' },
  { icon: 'moon-outline', titleKey: 'w_f3_t', bodyKey: 'w_f3_b' },
  { icon: 'walk-outline', titleKey: 'w_f4_t', bodyKey: 'w_f4_b' },
  { icon: 'timer-outline', titleKey: 'w_f5_t', bodyKey: 'w_f5_b' },
  { icon: 'chatbubble-ellipses-outline', titleKey: 'w_f6_t', bodyKey: 'w_f6_b' },
  { icon: 'calendar-outline', titleKey: 'w_f7_t', bodyKey: 'w_f7_b' },
  { icon: 'wallet-outline', titleKey: 'w_f8_t', bodyKey: 'w_f8_b' },
  { icon: 'phone-portrait-outline', titleKey: 'w_f9_t', bodyKey: 'w_f9_b' },
];

/** The newest Android build, published as a GitHub Release by the deploy workflow. */
const APK_URL = 'https://github.com/Pathu1199/sobat/releases/latest/download/sobat.apk';

export default function Welcome() {
  const router = useRouter();
  const { state } = useApp();
  const bp = useBreakpoint();
  const t = makeT(state.profile.lang);
  const wide = bp !== 'mobile';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={{ maxWidth: 1100, width: '100%', alignSelf: 'center', paddingHorizontal: wide ? 40 : 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 }}>
          <Wordmark size={20} />
          <Pressable
            onPress={() => router.replace('/login')}
            style={{ backgroundColor: C.accent, paddingVertical: 9, paddingHorizontal: 18, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontWeight: '600', fontSize: F.small }}>{t('w_cta')}</Text>
          </Pressable>
        </View>

        <View style={{ paddingTop: wide ? 60 : 32, paddingBottom: 44, maxWidth: 680 }}>
          <View style={{ marginBottom: 22 }}>
            <Logo size={wide ? 64 : 52} />
          </View>
          <Text style={[MICRO, { color: C.accent, marginBottom: 16 }]}>{t('w_eyebrow')}</Text>
          <Text style={{ color: C.text, fontSize: wide ? 52 : 34, fontWeight: '700', lineHeight: wide ? 60 : 42, letterSpacing: -1 }}>
            {t('w_headline')}
          </Text>
          <Text style={{ color: C.textDim, fontSize: wide ? F.h3 : F.body, lineHeight: 26, marginTop: 18 }}>{t('w_sub')}</Text>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 30, flexWrap: 'wrap' }}>
            <Pressable
              onPress={() => router.replace('/login')}
              style={{ backgroundColor: C.accent, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999 }}>
              <Text style={{ color: C.white, fontWeight: '600', fontSize: F.body }}>{t('w_cta')}</Text>
            </Pressable>
            {Platform.OS === 'web' ? (
              <Pressable
                onPress={() => Linking.openURL(APK_URL)}
                style={{ borderWidth: 1, borderColor: C.border, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="logo-android" size={16} color={C.textDim} />
                <Text style={{ color: C.textDim, fontSize: F.body }}>{t('w_download_apk')}</Text>
              </Pressable>
            ) : null}
          </View>
          {Platform.OS === 'web' ? <Text style={{ color: C.textGhost, fontSize: F.tiny, marginTop: 12, lineHeight: 17 }}>{t('w_download_note')}</Text> : null}
        </View>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: wide ? 48 : 24,
            paddingVertical: 26,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderColor: C.border,
          }}>
          <Stat value="240" label={t('w_stat1')} />
          <Stat value="50" label={t('w_stat2')} />
          <Stat value="1" label={t('w_stat3')} accent />
          <Stat value="3" label={t('w_stat4')} />
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingTop: 44 }}>
          {FEATURES.map((f) => (
            <View
              key={f.titleKey}
              style={{
                flexGrow: 1,
                flexBasis: wide ? '30%' : '100%',
                backgroundColor: C.card,
                borderWidth: 1,
                borderColor: C.border,
                borderRadius: S.radius,
                padding: 20,
                gap: 10,
              }}>
              <Ionicons name={f.icon} size={20} color={C.accent} />
              <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{t(f.titleKey)}</Text>
              <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 20 }}>{t(f.bodyKey)}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            marginTop: 40,
            backgroundColor: C.cardAlt,
            borderWidth: 1,
            borderColor: C.accentDim,
            borderRadius: S.radius,
            padding: wide ? 32 : 22,
            flexDirection: wide ? 'row' : 'column',
            alignItems: wide ? 'center' : 'flex-start',
            gap: 18,
          }}>
          <Ionicons name="lock-closed-outline" size={24} color={C.cyan} />
          <View style={{ flex: 1, gap: 7 }}>
            <Text style={{ color: C.text, fontSize: F.h2, fontWeight: '600', letterSpacing: -0.3 }}>{t('w_privacy_t')}</Text>
            <Text style={{ color: C.textDim, fontSize: F.body, lineHeight: 23 }}>{t('w_privacy_b')}</Text>
          </View>
        </View>

        <View style={{ paddingTop: 44, gap: 16 }}>
          <Text style={[MICRO, { color: C.textDim }]}>{t('w_how')}</Text>
          <View style={{ flexDirection: wide ? 'row' : 'column', gap: 14 }}>
            {[1, 2, 3].map((n) => (
              <View key={n} style={{ flex: 1, gap: 8 }}>
                <Text style={{ color: C.accent, fontSize: 30, fontWeight: '200', letterSpacing: -1 }}>{n}</Text>
                <Text style={{ color: C.text, fontSize: F.body, fontWeight: '600' }}>{t(`w_step${n}_t`)}</Text>
                <Text style={{ color: C.textDim, fontSize: F.small, lineHeight: 20 }}>{t(`w_step${n}_b`)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ paddingTop: 44, alignItems: 'flex-start', gap: 12 }}>
          <Pressable
            onPress={() => router.replace('/login')}
            style={{ backgroundColor: C.accent, paddingVertical: 15, paddingHorizontal: 34, borderRadius: 999 }}>
            <Text style={{ color: C.white, fontWeight: '600', fontSize: F.body }}>{t('w_cta')}</Text>
          </Pressable>
          <Text style={[MICRO, { color: C.textGhost }]}>{`${t('made_by')} · ${t('w_footer')}`}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={{ minWidth: 120 }}>
      <Text style={{ color: accent ? C.cyan : C.text, fontSize: 32, fontWeight: '200', letterSpacing: -1 }}>{value}</Text>
      <Text style={[MICRO, { color: C.textFaint, marginTop: 4 }]}>{label}</Text>
    </View>
  );
}
