import { minutesBetween } from './date';
import type { SleepLog } from './types';

export const IDEAL_MINUTES = 450; // 7h30

export type SleepAnswers = { bed: string; wake: string; quality: number; wakeups: number; energy: number };

/**
 * 0 to 100. Duration carries most of the weight, then how it felt,
 * then how broken it was.
 */
export function sleepScore(a: SleepAnswers): number {
  const mins = minutesBetween(a.bed, a.wake);
  const durationScore = mins >= 420 && mins <= 540 ? 60 : Math.max(0, 60 - Math.abs(mins - 480) / 6);
  const qualityScore = ((a.quality - 1) / 4) * 25;
  const wakeupPenalty = Math.min(a.wakeups, 4) * 3;
  const energyScore = ((a.energy - 1) / 4) * 15;
  return Math.max(0, Math.min(100, Math.round(durationScore + qualityScore + energyScore - wakeupPenalty)));
}

export function buildSleepLog(date: string, a: SleepAnswers): SleepLog {
  return { date, ...a, minutes: minutesBetween(a.bed, a.wake), score: sleepScore(a) };
}

/** Negative means short on sleep over the window. */
export function sleepDebt(logs: SleepLog[], days = 7): number {
  const recent = logs.slice(-days);
  if (recent.length === 0) return 0;
  return recent.reduce((sum, l) => sum + (l.minutes - IDEAL_MINUTES), 0);
}

/** Standard deviation of bedtime in minutes. High means an irregular clock. */
export function bedtimeRegularity(logs: SleepLog[], days = 7): number {
  const recent = logs.slice(-days);
  if (recent.length < 2) return 0;
  const mins = recent.map((l) => {
    const [h, m] = l.bed.split(':').map(Number);
    // Shift so late-evening and after-midnight bedtimes sit on one line.
    return h < 12 ? h * 60 + m + 24 * 60 : h * 60 + m;
  });
  const mean = mins.reduce((a, b) => a + b, 0) / mins.length;
  const variance = mins.reduce((a, b) => a + (b - mean) ** 2, 0) / mins.length;
  return Math.round(Math.sqrt(variance));
}

export type SleepFlag = 'short_sleep' | 'irregular' | 'broken_sleep' | 'apnea_screen';

export function sleepFlags(logs: SleepLog[]): SleepFlag[] {
  const flags: SleepFlag[] = [];
  const recent = logs.slice(-7);
  if (recent.length === 0) return flags;
  const avg = recent.reduce((a, l) => a + l.minutes, 0) / recent.length;
  if (avg < 390) flags.push('short_sleep');
  if (bedtimeRegularity(logs) > 75) flags.push('irregular');
  const avgWakeups = recent.reduce((a, l) => a + l.wakeups, 0) / recent.length;
  if (avgWakeups >= 2) flags.push('broken_sleep');
  // Long enough in bed but still low energy: worth a doctor's opinion.
  const lowEnergyDespiteSleep = recent.filter((l) => l.minutes >= 420 && l.energy <= 2).length;
  if (lowEnergyDespiteSleep >= 3) flags.push('apnea_screen');
  return flags;
}

/** Guess bedtime and wake time so the morning check-in is a confirm, not a form. */
export function prefillAnswers(lastActivityHHMM: string | null, firstActivityHHMM: string | null): SleepAnswers {
  return {
    bed: lastActivityHHMM ?? '23:00',
    wake: firstActivityHHMM ?? '07:00',
    quality: 3,
    wakeups: 0,
    energy: 3,
  };
}
