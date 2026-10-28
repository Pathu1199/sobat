import { router } from 'expo-router';
import React from 'react';
import { Platform, View, type ColorValue } from 'react-native';
import { IconButton } from '../ui/IconButton';

/**
 * The back control on every page the root stack opens over the tabs: a 44 pt
 * round button named in the person's language ("Back"), in place of the
 * header's own, which on the web is 30 pt and is read by the name of the route
 * under it ("(tabs), back"). It goes back down the stack, or to Today when
 * nothing is under the page. The arrow takes the header's tint when the
 * header passes one (`headerTintColor`), as the header's own arrow would.
 */
export function HeaderBack({ label, tintColor }: { label: string; tintColor?: ColorValue }) {
  return (
    <View style={Platform.OS === 'web' ? { marginStart: 4 } : undefined}>
      <IconButton
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        label={label}
        color={tintColor}
        onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/'))}
      />
    </View>
  );
}
