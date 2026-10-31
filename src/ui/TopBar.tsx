import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './components';
import { C, F, lh, S, TITLE_WEIGHT } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** How far the tint band reaches under the top of the screen, past the safe area: behind the header and the first block under it. */
export const TINT_BAND = 168;

/** The soft tint at the top of every tab, in the palette's own colour, behind the header and what comes first under it. Drawn first, so the page scrolls over it. */
export function TintBand() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top + TINT_BAND, backgroundColor: C.tint }} />;
}

/** One compact bar per tab, over the tab's tint band. Replaces the stock navigation header. `over` is a small quiet line above the title (Today's date over its greeting). */
export function TopBar({
  title,
  alt,
  over,
  subtitle,
  right,
  left,
}: {
  title: string;
  alt?: string;
  over?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'desktop';
  return (
    <View>
      <View
        style={{
          paddingTop: insets.top + 10,
          paddingBottom: 8,
          paddingHorizontal: wide ? S.gutterWide : S.gutter,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          maxWidth: wide ? S.maxWide : 780,
          width: '100%',
          alignSelf: 'center',
          minHeight: 56 + insets.top,
        }}>
        {left}
        <View style={{ flex: 1, gap: 2 }}>
          {over ? (
            <Text numberOfLines={1} style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
              {over}
            </Text>
          ) : null}
          <Text numberOfLines={1} accessibilityRole="header" style={{ color: C.text, fontSize: F.title, lineHeight: lh(F.title), fontWeight: TITLE_WEIGHT }}>
            {alt || title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: C.textDim, fontSize: F.small, lineHeight: lh(F.small), fontWeight: '400' }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** A tab screen: the tint band, the TopBar, then the scrolling body over the band. */
export function Page({
  title,
  alt,
  over,
  subtitle,
  right,
  left,
  wide,
  header = true,
  children,
}: {
  title: string;
  alt?: string;
  over?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  wide?: boolean;
  /** False when a parent tab already draws the header and the section switch. */
  header?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {header ? <TintBand /> : null}
      {header ? <TopBar title={title} alt={alt} over={over} subtitle={subtitle} right={right} left={left} /> : null}
      <Screen wide={wide} onBand={header}>
        {children}
      </Screen>
    </View>
  );
}
