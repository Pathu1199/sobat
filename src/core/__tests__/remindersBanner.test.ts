import { describe, expect, it } from 'vitest';
import { EMPTY_STATE } from '../../store/defaults';
import { bannerState, isAppleMobile, type BannerInput } from '../remindersBanner';

const TODAY = '2026-10-31';
const REMINDERS = EMPTY_STATE.settings.reminders;
const ALL_OFF = Object.fromEntries(Object.keys(REMINDERS).map((k) => [k, false])) as BannerInput['reminders'];
// The pinned web app on an iPhone, never asked, with the relay set up and the default reminders on.
const pinned: BannerInput = { platform: 'web', appleMobile: true, standalone: true, permission: 'default', pushConfigured: true, pushRelay: false, reminders: REMINDERS, today: TODAY };
const android: BannerInput = { ...pinned, platform: 'android', appleMobile: false, standalone: false, pushConfigured: false };

describe('bannerState', () => {
  it('a browser tab on an iPhone or iPad is told to add the app to the Home Screen, whatever it was set up with', () => {
    // Safari in a tab has no notifications at all.
    expect(bannerState({ ...pinned, standalone: false, permission: 'unsupported' })).toBe('install');
    expect(bannerState({ ...pinned, standalone: false, permission: 'unsupported', pushConfigured: false })).toBe('install');
  });

  it('from the Home Screen, never asked and the relay set up: one tap turns reminders on', () => {
    expect(bannerState(pinned)).toBe('enable');
    // Installed on a computer counts the same.
    expect(bannerState({ ...pinned, appleMobile: false })).toBe('enable');
  });

  it('allowed before but never switched on: the same tap switches it on; allowed and on, nothing shows', () => {
    expect(bannerState({ ...pinned, permission: 'granted' })).toBe('enable');
    expect(bannerState({ ...pinned, permission: 'granted', pushRelay: true })).toBeNull();
  });

  it('a permission refused on the web points to the Guide, from the Home Screen or in a tab', () => {
    expect(bannerState({ ...pinned, permission: 'denied' })).toBe('blocked');
    expect(bannerState({ ...pinned, permission: 'denied', standalone: false, appleMobile: false })).toBe('blocked');
    expect(bannerState({ ...pinned, permission: 'denied', pushRelay: true })).toBe('blocked');
  });

  it('the Android app asks while it may, points to the Guide once the phone no longer asks, and says nothing once allowed', () => {
    expect(bannerState(android)).toBe('enable');
    expect(bannerState({ ...android, permission: 'denied' })).toBe('blocked');
    expect(bannerState({ ...android, permission: 'granted' })).toBeNull();
    expect(bannerState({ ...android, permission: 'unsupported' })).toBeNull();
  });

  it('anything else shows nothing: a computer\'s browser tab, the Home Screen without the relay, an iOS too old for notifications, the iPhone app', () => {
    expect(bannerState({ ...pinned, appleMobile: false, standalone: false })).toBeNull();
    expect(bannerState({ ...pinned, pushConfigured: false })).toBeNull();
    expect(bannerState({ ...pinned, permission: 'unsupported' })).toBeNull();
    expect(bannerState({ ...pinned, platform: 'ios' })).toBeNull();
  });

  it('never shows while every reminder is switched off; one switch on is enough', () => {
    for (const state of [pinned, { ...pinned, standalone: false }, { ...pinned, permission: 'denied' as const }, android]) {
      expect(bannerState({ ...state, reminders: ALL_OFF })).toBeNull();
      expect(bannerState({ ...state, reminders: { ...ALL_OFF, water: true } })).not.toBeNull();
    }
  });

  it('counts only the switches, so a list of times among the reminders does not keep it showing', () => {
    const withTimes = { ...ALL_OFF, checklistTimes: ['20:30'] } as BannerInput['reminders'];
    expect(bannerState({ ...pinned, reminders: withTimes })).toBeNull();
  });

  it('put away, it stays away for the rest of the day and comes back the next day', () => {
    expect(bannerState({ ...pinned, hiddenOn: TODAY })).toBeNull();
    expect(bannerState({ ...android, permission: 'denied', hiddenOn: TODAY })).toBeNull();
    expect(bannerState({ ...pinned, hiddenOn: '2026-10-30' })).toBe('enable');
    expect(bannerState({ ...pinned, today: '2026-11-01', hiddenOn: TODAY })).toBe('enable');
  });
});

describe('isAppleMobile', () => {
  it('knows an iPhone and an iPad, also an iPad asking for the desktop site, and nothing else', () => {
    expect(isAppleMobile('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X)', 'iPad', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isAppleMobile('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
    expect(isAppleMobile('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l', 5)).toBe(false);
  });
});
