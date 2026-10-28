import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetBottomPad } from './sheetPad';
import { C, F, lh, S } from './theme';
import { useBreakpoint } from './useBreakpoint';
import { useKeyboardUp } from './useKeyboardUp';

/**
 * The frame every sheet shares: a bottom sheet on the phone, a centred panel
 * on the desktop, over a dimmed page that closes it on a tap. It moves up
 * above the keyboard, so a grams box or an amount near its bottom is never
 * hidden behind it: the sheet's window draws edge to edge on Android too, so
 * the system does not resize it and both phones pad by the keyboard's height.
 * A browser moves its own page for its keyboard. The room kept for the home
 * indicator goes while the keyboard is up, so no gap shows between the sheet
 * and the keyboard. Escape closes it on the web (the browser's Modal calls
 * `onRequestClose`), Back on Android, and a screen reader's escape gesture on
 * iOS. A `tall` sheet keeps one height whatever it holds, for a list that
 * fills it; any other is as tall as its content, up to most of the screen.
 */
export function SheetFrame({ open, onClose, maxWidth = 520, tall = false, children }: { open: boolean; onClose: () => void; maxWidth?: number; tall?: boolean; children: React.ReactNode }) {
  const wide = useBreakpoint() !== 'mobile';
  const insets = useSafeAreaInsets();
  // Listens to the keyboard only while open: a closed sheet stays mounted on many screens.
  const keyboardUp = useKeyboardUp(open);
  const radius = S.radius + 4;
  return (
    <Modal visible={open} transparent animationType={wide ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={{ flex: 1, backgroundColor: C.scrim, justifyContent: wide ? 'center' : 'flex-end', alignItems: 'center' }}>
        {/* The dimmed page behind closes the sheet on a tap; screen readers close it with their escape gesture or Back, so it is not announced. */}
        <Pressable onPress={onClose} accessible={false} style={StyleSheet.absoluteFill} />
        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={{
            width: '100%',
            maxWidth: wide ? maxWidth : undefined,
            ...(tall ? { height: wide ? '86%' : '92%' } : { maxHeight: '88%' }),
            backgroundColor: C.card,
            borderWidth: S.hairline,
            borderColor: C.borderStrong,
            borderTopLeftRadius: radius,
            borderTopRightRadius: radius,
            borderBottomLeftRadius: wide ? radius : 0,
            borderBottomRightRadius: wide ? radius : 0,
            paddingBottom: sheetBottomPad({ wide, keyboardUp, inset: insets.bottom }),
            overflow: 'hidden',
          }}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A sheet with a title and its content in a scrolling column, in the shared frame. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const wide = useBreakpoint() !== 'mobile';
  return (
    <SheetFrame open={open} onClose={onClose}>
      {!wide ? <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: C.borderStrong, marginTop: 8 }} /> : null}
      <View style={{ paddingHorizontal: S.padLg, paddingTop: 14, paddingBottom: 6 }}>
        <Text accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: '500' }}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: S.padLg, paddingBottom: S.padLg, gap: 12 }} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SheetFrame>
  );
}
