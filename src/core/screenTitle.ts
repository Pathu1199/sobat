/**
 * The web page title for each address, as an i18n key, so a browser tab and
 * its history say which page they are. Pages with no entry show the app name.
 */
export const TITLES: Record<string, string> = {
  '/': 'tab_today',
  '/me': 'tab_me',
  '/progress': 'tab_progress',
  '/coach': 'tab_coach',
  '/body': 'tab_body',
  '/food': 'tab_food',
  '/sleep-tab': 'hdr_sleep',
  '/sleep': 'hdr_sleep',
  '/plan-tab': 'hdr_plan',
  '/plan': 'hdr_plan',
  '/abhyas': 'abhyas',
  '/log': 'add_food',
  '/settings': 'hdr_settings',
  '/customize': 'hdr_customize',
  '/history': 'hdr_history',
  '/guide': 'hdr_guide',
  '/journey': 'hdr_journey',
  '/photo': 'hdr_photo',
  '/scan': 'hdr_scan',
  '/memory': 'hdr_memory',
  '/foods': 'hdr_foods',
  '/recipes': 'hdr_recipes',
  '/session': 'hdr_session',
  '/routine': 'pattern_title',
  '/admin': 'hdr_admin',
  '/growth': 'charts',
  '/fit': 'fit_title',
  '/mind': 'mind_title',
};

export function titleKeyFor(pathname: string): string | null {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return TITLES[path] ?? null;
}

/** "Today · Dhyey"; just "Dhyey" where no page is named. */
export function pageTitle(pathname: string, word: (key: string) => string): string {
  const key = titleKeyFor(pathname);
  return key ? `${word(key)} · ${word('app_name')}` : word('app_name');
}
