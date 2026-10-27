import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the on-screen keyboard is up. iOS says so as the keyboard starts to
 * move and Android once it has; a browser never says, so on the web this
 * stays false (the browser moves its own page for its keyboard). It listens
 * only while `active` (a sheet listens while it is open) and is false
 * otherwise; coming back, it reads the keyboard again, as it may have moved
 * while nothing listened.
 */
export function useKeyboardUp(active = true): boolean {
  const [up, setUp] = useState(() => active && Keyboard.isVisible());
  useEffect(() => {
    if (!active) return;
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    const read = setTimeout(() => setUp(Keyboard.isVisible()), 0);
    return () => {
      clearTimeout(read);
      show.remove();
      hide.remove();
    };
  }, [active]);
  return active && up;
}
