import { router } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { IconButton } from '../ui/IconButton';

/**
 * The back control on every page the root stack opens over the tabs: a 44 pt
 * round button named in the person's language ("Back"), in place of the
 * header's own, which on the web is 30 pt and is read by the name of the route
 * under it ("(tabs), back"). It goes back down the stack, or to Today when
 * nothing is under the page.
 */
export function HeaderBack({ label }: { label: string }) {
  return (
    <View style={Platform.OS === 'web' ? { marginStart: 4 } : undefined}>
      <IconButton
        name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
        label={label}
        onPress={() => (router.canGoBack() ? router.back() : router.dismissTo('/'))}
      />
    </View>
  );
}
