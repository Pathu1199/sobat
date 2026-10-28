import { router, type Href } from 'expo-router';

/**
 * Opens a page of the tabs from a page that is shown both on its own, over
 * the tabs (/plan, /history), and as a section inside a tab (Food).
 *
 * On its own page the tabs are already under it, so the link goes back down
 * to them (`dismissTo`, the stack's POP_TO), and Back from there leaves the
 * app's tabs as they were. `navigate` would put a second copy of the tabs on
 * top in expo-router 57: the root stack moves back to a route of another name
 * only when the action asks it to pop.
 *
 * Inside a tab, the tab navigator makes the move with `navigate`; it has no
 * POP_TO, so `dismissTo` would do nothing there. `inTab` comes from the tab's
 * route file, which renders the page with it.
 */
export function toTabs(href: Href, inTab: boolean): void {
  if (inTab) router.navigate(href);
  else router.dismissTo(href);
}
