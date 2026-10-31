import type { ISODate, Settings } from './types';

/**
 * The one line at the top of Today that gets reminders to this device, shown
 * only while they cannot reach it. On an iPhone or iPad a web app gets
 * notifications only from the Home Screen, so a browser tab there is told to
 * add it; from the Home Screen, with the relay set up, one tap asks for
 * permission and switches on reminders while the app is closed; a permission
 * refused there is pointed to the Guide, which says where to allow it. A
 * computer's browser tab shows nothing. The Android app asks for permission
 * itself. Nothing shows while every reminder is switched off, or on the day
 * the user put the line away on this device. Pure.
 */
export type BannerKind = 'install' | 'enable' | 'blocked';

/** What the device says about notifications: 'default' while it was never asked or may still ask, 'unsupported' where it cannot show them at all. */
export type NotificationState = 'granted' | 'denied' | 'default' | 'unsupported';

export type BannerInput = {
  /** `Platform.OS`. */
  platform: string;
  /** A browser on an iPhone or iPad (`isAppleMobile`). */
  appleMobile: boolean;
  /** The web app was opened from the Home Screen. */
  standalone: boolean;
  permission: NotificationState;
  /** The relay's address and key are in the app, and this browser can take a push (`pushConfigured`). */
  pushConfigured: boolean;
  /** `settings.pushRelay`: reminders while the app is closed, on the web. */
  pushRelay: boolean;
  /** `settings.reminders`, one switch each. */
  reminders: Settings['reminders'];
  today: ISODate;
  /** The day the line was put away on this device (`settings.remindersBannerHiddenOn`). */
  hiddenOn?: ISODate;
};

export function bannerState(input: BannerInput): BannerKind | null {
  // Only the switches count: a list of times among them is not a reminder switched on.
  const anyOn = Object.values(input.reminders).some((on) => on === true);
  if (!anyOn || input.hiddenOn === input.today) return null;
  if (input.platform === 'web') {
    // A browser tab: an iPhone or iPad gets notifications only from the Home Screen; a computer's tab is not where reminders
    // are meant to come, so a permission it refused is not brought up every day.
    if (!input.standalone) return input.appleMobile ? 'install' : null;
    if (input.permission === 'denied') return 'blocked';
    if (!input.pushConfigured) return null;
    if (input.permission === 'default') return 'enable';
    // Allowed before (the test in Settings asks too) but never switched on reaches the device no better than never asked: the same tap turns it on.
    return input.permission === 'granted' && !input.pushRelay ? 'enable' : null;
  }
  if (input.platform === 'android') {
    if (input.permission === 'default') return 'enable';
    // Refused for good: the phone no longer shows the question, so only its own settings can allow it.
    return input.permission === 'denied' ? 'blocked' : null;
  }
  return null;
}

/** An iPhone, iPod or iPad by what its browser says; an iPad asking for the desktop site says it is a Mac with a touch screen. */
export function isAppleMobile(userAgent: string, platform: string, maxTouchPoints: number): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}
