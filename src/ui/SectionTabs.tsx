import React from 'react';
import { ScrollView, View } from 'react-native';
import { Segmented } from './components';
import { sectionRowMinWidth, sectionsScroll } from './segmentGeometry';
import { S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/**
 * The switch between a tab's sections, sitting just under the header, the
 * same width as the content; four fit a phone, more scroll, each as wide as
 * its name on one line (ui/segmentGeometry.ts).
 */
export function SectionTabs<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const wide = useBreakpoint() === 'desktop';
  const scroll = sectionsScroll(options.length);
  return (
    <View style={{ paddingHorizontal: wide ? S.gutterWide : S.gutter, paddingBottom: 6, maxWidth: wide ? S.maxWide : 780, width: '100%', alignSelf: 'center' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        {/* A row that scrolls is as wide as its names need, and at least the screen: its sections share what is left over. */}
        <View style={scroll ? { flexGrow: 1, flexShrink: 0, minWidth: sectionRowMinWidth(options.length) } : { flex: 1, minWidth: sectionRowMinWidth(options.length) }}>
          <Segmented options={options} value={value} onChange={onChange} fit={scroll} />
        </View>
      </ScrollView>
    </View>
  );
}
