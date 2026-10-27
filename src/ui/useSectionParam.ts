import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { sectionFromLink } from '../core/bar';

/**
 * A tab with sections that a link can name with ?s= (the coach, Me, a
 * notification). The named section opens, then the param is cleared, so the
 * same link works again later. A link takes effect only when ?s= changes, so
 * a param still in the address (a cold load, before the clearing lands) never
 * pulls back a section picked by hand.
 */
export function useSectionParam<T extends string>(sections: readonly T[]): [T, (s: T) => void] {
  // The screen's own navigation, so the clearing lands on this screen's route whatever is in front by then.
  const navigation = useNavigation<{ setParams: (params: { s?: string }) => void }>();
  const { s } = useLocalSearchParams<{ s?: string }>();
  const [section, setSection] = useState<T>(() => sectionFromLink(sections, s, undefined) ?? sections[0]);
  const [seen, setSeen] = useState<unknown>(s);
  // A new link wins over what was open: state that follows a changed value is adjusted while rendering.
  if (s !== seen) {
    setSeen(s);
    const linked = sectionFromLink(sections, s, seen);
    if (linked !== null) setSection(linked);
  }
  useEffect(() => {
    if (s === undefined) return;
    // Cleared after this commit: on a cold load the web address starts following the navigation only after
    // the screens' first effects, so a change made in one never leaves the address.
    const id = setTimeout(() => navigation.setParams({ s: undefined }), 0);
    return () => clearTimeout(id);
  }, [s, navigation]);
  return [section, setSection];
}
