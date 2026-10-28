import { router, useFocusEffect } from 'expo-router';

/**
 * Sends a page over the tabs back down to Today, like expo-router's
 * `<Redirect href="/" />` but with `dismissTo` (see `toTabs`): with the tabs
 * already under the page it pops to them instead of putting a second copy on
 * top, and with nothing under it the page is replaced by them. Doing it twice
 * (the page's own move after a sign-in and this one) leaves one copy of the tabs.
 */
export function RedirectToTabs() {
  useFocusEffect(() => {
    router.dismissTo('/');
  });
  return null;
}
