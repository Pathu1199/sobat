import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { PALETTE_IDS } from '../core/palette';
import { makeT } from '../i18n';
import { useApp } from '../store/AppProvider';
import { chosenProps } from '../ui/chosen';
import { C, F, lh, PALETTE_SETS, S, themeMode } from '../ui/theme';

/**
 * Settings → Appearance: the three palettes as swatches, each its action
 * colour with its reward colour on it, in the light or dark the app is in,
 * and its name under it. The chosen one is ringed and says it is chosen; a
 * tap switches the whole app, and the choice reaches the user's other devices.
 */
export function PaletteSwatches() {
  const app = useApp();
  const t = makeT(app.state.profile.lang);
  const chosen = app.state.settings.palette;
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {PALETTE_IDS.map((id) => {
        const p = PALETTE_SETS[id][themeMode()];
        const on = id === chosen;
        const name = t(`palette_${id}`);
        return (
          <Pressable
            key={id}
            onPress={() => app.setSettings({ palette: id })}
            accessibilityRole="button"
            accessibilityLabel={name}
            {...chosenProps(on)}
            style={({ pressed }) => ({ flex: 1, minHeight: S.touch, alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4, borderRadius: S.radiusSm, borderWidth: 2, borderColor: on ? C.accentText : 'transparent', opacity: pressed ? 0.8 : 1 })}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: p.gold, borderWidth: 2, borderColor: C.card }} />
            </View>
            <Text style={{ color: C.text, fontSize: F.small, lineHeight: lh(F.small), textAlign: 'center' }}>{name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
