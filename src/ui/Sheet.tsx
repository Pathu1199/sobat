import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetBottomPad } from './sheetPad';
import { C, F, lh, S } from './theme';
import { useBreakpoint } from './useBreakpoint';
import { useKeyboardUp } from './useKeyboardUp';

/**
 * A bottom sheet on the phone, a centred panel on the desktop. It moves up
 * above the keyboard, so a grams box or an amount near its bottom is never
 * hidden behind it: the sheet's window draws edge to edge on Android too, so
 * the system does not resize it and both phones pad by the keyboard's height.
 * A browser moves its own page for its keyboard. The room kept for the
 * home indicator goes while the keyboard is up, so no gap shows between the
 * sheet and the keyboard.
 */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const wide = useBreakpoint() !== 'mobile';
  const insets = useSafeAreaInsets();
  // Listens to the keyboard only while open: a closed sheet stays mounted on many screens.
  const keyboardUp = useKeyboardUp(open);
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'web' ? undefined : 'padding'} style={{ flex: 1, backgroundColor: C.scrim }}>
        {/* The scrim closes on a tap; screen readers close with their own escape gesture or Back, so neither layer is announced. */}
        <Pressable onPress={onClose} accessible={false} style={{ flex: 1, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
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
              paddingBottom: sheetBottomPad({ wide, keyboardUp, inset: insets.bottom }),
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
      </KeyboardAvoidingView>
    </Modal>
  );
}
