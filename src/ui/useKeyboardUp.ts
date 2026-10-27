import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Whether the on-screen keyboard is up. iOS says so as the keyboard starts to
 * move and Android once it has; a browser never says, so on the web this
 * stays false (the browser moves its own page for its keyboard).
 */
export function useKeyboardUp(): boolean {
  const [up, setUp] = useState(() => Keyboard.isVisible());
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}
