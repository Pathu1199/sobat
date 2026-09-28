import { DEFAULT_BREAK_SETTINGS, type BreakLog, type BreakSettings } from '../core/breaks';
import type { AppState } from '../core/types';
import { EMPTY_STATE } from './defaults';

/** The shape break settings had in version 1. */
type V1BreakSettings = {
  enabled?: boolean;
  workMinutes?: number;
  breakSeconds?: number;
  allowSkip?: boolean;
  quietStartHour?: number;
  quietEndHour?: number;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** True once the settings carry the four-kind shape. */
function isV2Settings(v: unknown): v is BreakSettings {
  return isRecord(v) && isRecord(v.micro) && isRecord(v.long);
}

function upgradeSettings(old: unknown): BreakSettings {
  if (isV2Settings(old)) {
    // Already migrated; fill any key a newer default added.
    return { ...DEFAULT_BREAK_SETTINGS, ...old };
  }
  const v1 = (isRecord(old) ? old : {}) as V1BreakSettings;
  return {
    ...DEFAULT_BREAK_SETTINGS,
    enabled: v1.enabled ?? DEFAULT_BREAK_SETTINGS.enabled,
    // The one timer the person had configured becomes the micro break.
    micro: {
      ...DEFAULT_BREAK_SETTINGS.micro,
      everyMinutes: v1.workMinutes ?? DEFAULT_BREAK_SETTINGS.micro.everyMinutes,
      seconds: v1.breakSeconds ?? DEFAULT_BREAK_SETTINGS.micro.seconds,
    },
    // "Skipping not allowed" was the old way of saying strict.
    strictness: v1.allowSkip === false ? 'strict' : 'normal',
    quietStartHour: v1.quietStartHour ?? DEFAULT_BREAK_SETTINGS.quietStartHour,
    quietEndHour: v1.quietEndHour ?? DEFAULT_BREAK_SETTINGS.quietEndHour,
  };
}

function upgradeLogs(old: unknown, microSeconds: number): BreakLog[] {
  if (!Array.isArray(old)) return [];
  return old.map((raw) => {
    const l = (isRecord(raw) ? raw : {}) as Partial<BreakLog> & { workedMinutes?: number };
    return {
      id: String(l.id ?? Date.now()),
      date: String(l.date ?? ''),
      at: String(l.at ?? ''),
      // Every break logged before this version was the single timer, i.e. micro.
      kind: l.kind ?? 'micro',
      action: l.action === 'skipped' ? 'skipped' : 'taken',
      workedMinutes: Number(l.workedMinutes ?? 0),
      seconds: Number(l.seconds ?? microSeconds),
    };
  });
}

/**
 * Brings a stored blob up to the current shape. Never throws: a corrupt or
 * foreign file yields a fresh state rather than bricking the app.
 */
export function migrateState(raw: unknown): AppState {
  if (!isRecord(raw) || !isRecord(raw.profile)) return { ...EMPTY_STATE };
  const breakSettings = upgradeSettings(raw.breakSettings);
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: 2,
    profile: { ...EMPTY_STATE.profile, ...(raw.profile as object) },
    settings: { ...EMPTY_STATE.settings, ...(isRecord(raw.settings) ? raw.settings : {}) },
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
  };
}
