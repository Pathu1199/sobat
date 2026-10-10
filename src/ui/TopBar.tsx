import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from './components';
import { C, F, S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** One compact bar per tab. Replaces the stock navigation header. */
export function TopBar({
  title,
  alt,
  subtitle,
  right,
  left,
}: {
  title: string;
  alt?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const wide = useBreakpoint() === 'desktop';
  return (
    <View style={{ backgroundColor: C.bg }}>
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
          <Text numberOfLines={1} style={{ color: C.text, fontSize: F.h2, fontWeight: '800', letterSpacing: -0.5 }}>
            {alt || title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: C.textDim, fontSize: F.tiny, fontWeight: '600', letterSpacing: 0.2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/** A tab screen: TopBar, then the scrolling body. */
export function Page({
  title,
  alt,
  subtitle,
  right,
  left,
  wide,
  header = true,
  children,
}: {
  title: string;
  alt?: string;
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
      {header ? <TopBar title={title} alt={alt} subtitle={subtitle} right={right} left={left} /> : null}
      <Screen wide={wide}>{children}</Screen>
    </View>
  );
}
