import { normalizeTabs } from './tabs';
import type { TabId } from './types';

/**
 * The tab bar and the Me list, from the extra tabs the person chose. Today
 * and Me are always there, and ➕ (a button, not a tab: it opens the add
 * sheet) sits in the middle of the others. Each item names its tab route, an
 * Ionicons name and a label key, so the bar on a phone and the sidebar on a
 * wide screen show the same list in the same order, and Me always reaches the
 * page of a tab that is not on the bar.
 */
export type BarKey = 'today' | TabId | 'add' | 'me';
export type BarItem = { key: BarKey; route: string | null; icon: string; labelKey: string };

const TODAY: BarItem = { key: 'today', route: 'index', icon: 'today-outline', labelKey: 'tab_today' };
const ADD: BarItem = { key: 'add', route: null, icon: 'add', labelKey: 'add_food' };
const ME: BarItem = { key: 'me', route: 'me', icon: 'person-circle-outline', labelKey: 'tab_me' };
const EXTRA: Record<TabId, BarItem> = {
  progress: { key: 'progress', route: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress' },
  coach: { key: 'coach', route: 'coach', icon: 'chatbubble-ellipses-outline', labelKey: 'tab_coach' },
  body: { key: 'body', route: 'body', icon: 'body-outline', labelKey: 'tab_body' },
  sleep: { key: 'sleep', route: 'sleep-tab', icon: 'moon-outline', labelKey: 'sleep_title' },
  plan: { key: 'plan', route: 'plan-tab', icon: 'calendar-outline', labelKey: 'tab_plan' },
};

/** Today, the extras, Me, with ➕ inserted in the middle: Today · ➕ · Progress · Me by default. */
export function barItems(tabs: unknown): BarItem[] {
  const around = [TODAY, ...normalizeTabs(tabs).map((id) => EXTRA[id]), ME];
  const middle = Math.floor(around.length / 2);
  return [...around.slice(0, middle), ADD, ...around.slice(middle)];
}

export type MeRow = { key: string; icon: string; labelKey: string; subKey?: string; href?: string; sheet?: 'savedMeals' };

/** Me's plain list. Rows are data: a new one is one entry here. */
export function meRows(tabs: unknown): MeRow[] {
  const rows: MeRow[] = [
    { key: 'coach', icon: 'chatbubble-ellipses-outline', labelKey: 'me_coach', href: '/coach' },
    { key: 'body', icon: 'body-outline', labelKey: 'tab_body', subKey: 'me_body_sub', href: '/body' },
    { key: 'plan', icon: 'calendar-outline', labelKey: 'me_plan', href: '/food?s=plan' },
    { key: 'saved', icon: 'bookmark-outline', labelKey: 'me_saved', sheet: 'savedMeals' },
    { key: 'grocery', icon: 'basket-outline', labelKey: 'me_grocery', href: '/food?s=recipes' },
    { key: 'settings', icon: 'settings-outline', labelKey: 'settings', href: '/settings' },
    { key: 'guide', icon: 'help-circle-outline', labelKey: 'hdr_guide', href: '/guide' },
  ];
  // Progress taken off the bar stays one tap away.
  if (!normalizeTabs(tabs).includes('progress')) rows.splice(1, 0, { key: 'progress', icon: 'trending-up-outline', labelKey: 'tab_progress', href: '/progress' });
  return rows;
}
