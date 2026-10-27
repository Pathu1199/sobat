import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

/**
 * A tab with sections that a link can name with ?s= (the coach, Me, a
 * notification). The named section opens, then the param is cleared, so the
 * same link works again later and a section picked by hand is never pulled
 * back by a param left in the address.
 */
export function useSectionParam<T extends string>(sections: readonly T[]): [T, (s: T) => void] {
  const router = useRouter();
  const { s } = useLocalSearchParams<{ s?: string }>();
  const linked = typeof s === 'string' && (sections as readonly string[]).includes(s) ? (s as T) : null;
  const [section, setSection] = useState<T>(linked ?? sections[0]);
  // A new link wins over what was open: state that follows a changed value is adjusted while rendering.
  if (linked !== null && linked !== section) setSection(linked);
  useEffect(() => {
    if (s !== undefined) router.setParams({ s: undefined });
  }, [s, router]);
  return [section, setSection];
}
