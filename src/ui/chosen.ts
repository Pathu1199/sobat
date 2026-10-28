import { Platform } from 'react-native';

/**
 * How a chip or a day button says it is the chosen one. A phone reads
 * "selected" on a button. The web does not: a browser reads aria-selected
 * only on an option, a tab or a row, so a button there says "pressed"
 * instead. Spread onto the Pressable; a control given no state claims none.
 */
export function chosenProps(on: boolean | undefined, os: string = Platform.OS): { 'aria-pressed'?: boolean } | { 'aria-selected'?: boolean } {
  return os === 'web' ? { 'aria-pressed': on } : { 'aria-selected': on };
}
