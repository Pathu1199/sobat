import { Platform } from 'react-native';
import { DEFAULT_BREAK_SETTINGS, type BreakLog, type BreakSettings } from '../core/breaks';
import type { AppState } from '../core/types';
import { DEFAULT_ROUTINE } from '../core/routine';
import { DEFAULT_OLLAMA_URL, EMPTY_STATE, OLD_OLLAMA_PLACEHOLDER } from './defaults';

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
  // A phone should not blank its own screen every twenty minutes. Long breaks
  // and posture still arrive as notifications.
  const phone = Platform.OS !== 'web';
  const base: BreakSettings = phone
    ? { ...DEFAULT_BREAK_SETTINGS, micro: { ...DEFAULT_BREAK_SETTINGS.micro, enabled: false } }
    : DEFAULT_BREAK_SETTINGS;
  if (isV2Settings(old)) return { ...base, ...old };
  const v1 = (isRecord(old) ? old : {}) as V1BreakSettings;
  return {
    ...base,
    enabled: v1.enabled ?? base.enabled,
    micro: {
      ...base.micro,
      everyMinutes: v1.workMinutes ?? base.micro.everyMinutes,
      seconds: v1.breakSeconds ?? base.micro.seconds,
    },
    strictness: v1.allowSkip === false ? 'strict' : 'normal',
    quietStartHour: v1.quietStartHour ?? base.quietStartHour,
    quietEndHour: v1.quietEndHour ?? base.quietEndHour,
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

/** Routine meals saved before they had times get the default time for their id, else a sensible one by meal. */
function upgradeRoutine(old: unknown, fromVersion: number): AppState['routine'] {
  const r = { ...EMPTY_STATE.routine, ...(isRecord(old) ? old : {}) } as AppState['routine'];
  // Version 3 made the routine opt-in. Stores from before start with it off; one tap on the routine screen brings it back.
  if (fromVersion < 3) r.enabled = false;
  const byType: Record<string, string> = { breakfast: '08:30', lunch: '13:00', snack: '16:00', dinner: '20:30' };
  r.slots = (Array.isArray(r.slots) ? r.slots : []).map((s) =>
    s.time ? s : { ...s, time: DEFAULT_ROUTINE.slots.find((d) => d.id === s.id)?.time ?? byType[s.type] ?? '13:00' },
  );
  return r;
}

/** An address nobody changed from the old placeholder moves to this platform's default. */
function upgradeAppSettings(old: unknown): AppState['settings'] {
  const s = { ...EMPTY_STATE.settings, ...(isRecord(old) ? old : {}) };
  if (s.ollamaUrl === OLD_OLLAMA_PLACEHOLDER) s.ollamaUrl = DEFAULT_OLLAMA_URL;
  return s;
}

/**
 * Brings a stored blob up to the current shape. Never throws: a corrupt or
 * foreign file yields a fresh state rather than bricking the app.
 */
export function migrateState(raw: unknown): AppState {
  if (!isRecord(raw) || !isRecord(raw.profile)) return { ...EMPTY_STATE };
  const breakSettings = upgradeSettings(raw.breakSettings);
  const fromVersion = typeof raw.version === 'number' ? raw.version : 1;
  const settings = upgradeAppSettings(raw.settings);
  // Version 4: the weigh-in moved to Sunday, and the start weight became a
  // fixed point rather than whichever weigh-in happened to be oldest.
  if (fromVersion < 4 && settings.weighDay === 1) settings.weighDay = 0;
  // Version 5: reminders space out. Nothing closer than an hour unless chosen.
  if (fromVersion < 5 && settings.nudgeMinutes < 60) settings.nudgeMinutes = 60;
  const profile = { ...EMPTY_STATE.profile, ...(raw.profile as object) } as AppState['profile'];
  if (profile.startWeightKg === undefined) {
    const weights = Array.isArray(raw.weights) ? ([...(raw.weights as AppState['weights'])].sort((a, b) => a.date.localeCompare(b.date))) : [];
    profile.startWeightKg = weights[0]?.kg ?? profile.weightKg;
  }
  return {
    ...EMPTY_STATE,
    ...(raw as Partial<AppState>),
    version: 5,
    profile,
    settings,
    breakSettings,
    breaks: upgradeLogs(raw.breaks, breakSettings.micro.seconds),
    // Older stores have no routine; one saved before a field existed gets the default for it.
    routine: upgradeRoutine(raw.routine, fromVersion),
    spend: Array.isArray(raw.spend) ? (raw.spend as AppState['spend']) : [],
    schedule: { ...EMPTY_STATE.schedule, ...(isRecord(raw.schedule) ? raw.schedule : {}) },
  };
}
