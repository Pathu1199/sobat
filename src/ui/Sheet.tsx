import React from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, F, lh, S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** A bottom sheet on the phone, a centred panel on the desktop. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const wide = useBreakpoint() !== 'mobile';
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      {/* The scrim closes on a tap; screen readers close with their own escape gesture or Back, so neither layer is announced. */}
      <Pressable onPress={onClose} accessible={false} style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        <Pressable
          onPress={() => {}}
          accessible={false}
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            width: '100%',
            maxWidth: wide ? 520 : undefined,
            maxHeight: '88%',
            backgroundColor: C.card,
            borderWidth: S.hairline,
            borderColor: C.borderStrong,
            borderTopLeftRadius: S.radius + 4,
            borderTopRightRadius: S.radius + 4,
            borderBottomLeftRadius: wide ? S.radius + 4 : 0,
            borderBottomRightRadius: wide ? S.radius + 4 : 0,
            paddingBottom: wide ? 0 : insets.bottom,
          }}>
          {!wide ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginTop: 8 }} /> : null}
          <View style={{ paddingHorizontal: S.padLg, paddingTop: 14, paddingBottom: 6 }}>
            <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
              {title}
            </Text>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
