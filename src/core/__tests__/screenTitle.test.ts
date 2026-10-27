import { describe, expect, it } from 'vitest';
import { makeT } from '../../i18n';
import { pageTitle, TITLES, titleKeyFor } from '../screenTitle';

describe('page titles', () => {
  it('names each address, ignoring the query and a trailing slash', () => {
    expect(titleKeyFor('/')).toBe('tab_today');
    expect(titleKeyFor('/food?s=plan')).toBe('tab_food');
    expect(titleKeyFor('/settings/')).toBe('hdr_settings');
    expect(titleKeyFor('/sleep-tab')).toBe('hdr_sleep');
    expect(titleKeyFor('/welcome')).toBeNull();
  });

  it('puts the page before the app name, and the app name alone where no page is named', () => {
    const words: Record<string, string> = { tab_me: 'Me', app_name: 'Sobat' };
    const word = (k: string) => words[k] ?? k;
    expect(pageTitle('/me', word)).toBe('Me · Sobat');
    expect(pageTitle('/welcome', word)).toBe('Sobat');
  });

  it('every page title is a word the English list has, never the raw key', () => {
    const en = makeT('en');
    for (const key of Object.values(TITLES)) expect(en(key), key).not.toBe(key);
  });
});
