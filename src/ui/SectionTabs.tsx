import React from 'react';
import { ScrollView, View } from 'react-native';
import { Segmented } from './components';
import { S } from './theme';
import { useBreakpoint } from './useBreakpoint';

/** The switch between a tab's sections, sitting just under the header, the same width as the content. */
export function SectionTabs<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const wide = useBreakpoint() === 'desktop';
  return (
    <View style={{ paddingHorizontal: wide ? S.gutterWide : S.gutter, paddingBottom: 6, maxWidth: wide ? S.maxWide : 780, width: '100%', alignSelf: 'center' }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <View style={{ flex: 1, minWidth: options.length * 92 }}>
          <Segmented options={options} value={value} onChange={onChange} />
        </View>
      </ScrollView>
    </View>
  );
}
