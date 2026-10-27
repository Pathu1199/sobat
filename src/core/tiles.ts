import { loggedAt } from './date';
import type { ISODate, WaterLog, WeightLog } from './types';

/**
 * The numbers behind the living tiles, so every tile reads the same way and
 * each can be tested: how full the art is, what is left, whether the goal is
 * reached, and where the weight line runs. Fractions never pass 1; a tile at
 * its goal stays full while further taps are still counted.
 */

/** How full a tile is: amount over goal, from 0 to 1. A goal of 0 is full once anything is logged. */
export function fillFraction(amount: number, goal: number): number {
  if (!(goal > 0)) return amount > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, amount / goal));
}

export type WaterTile = { fraction: number; bottlesLeft: number; reached: boolean };

/**
 * Water in bottles: the bottles still to drink are rounded up, so half a bottle left is one bottle. The goal is reached
 * when the tile is full, so with no goal above 0 an empty tile is not reached and has no bottles left to count.
 */
export function waterTile(ml: number, goalMl: number, bottleMl: number): WaterTile {
  const fraction = fillFraction(ml, goalMl);
  const reached = fraction === 1;
  const bottlesLeft = reached || !(goalMl > 0) || !(bottleMl > 0) ? 0 : Math.ceil((goalMl - ml) / bottleMl);
  return { fraction, bottlesLeft, reached };
}

export type WalkTile = { fraction: number; minutesLeft: number; reached: boolean };

/** Walking in minutes toward the day's goal, reached when the tile is full, the same way as water. */
export function walkTile(minutes: number, goalMin: number): WalkTile {
  const fraction = fillFraction(minutes, goalMin);
  const reached = fraction === 1;
  return { fraction, minutesLeft: reached || !(goalMin > 0) ? 0 : Math.ceil(goalMin - minutes), reached };
}

/** The night arc: minutes slept over the target. */
export function sleepFraction(minutes: number, targetMinutes: number): number {
  return fillFraction(minutes, targetMinutes);
}

/** The climb: today's streak over the best one, so the climber reaches the summit at the best streak. */
export function streakFraction(streak: number, best: number): number {
  return fillFraction(streak, Math.max(best, streak));
}

export type Point = { x: number; y: number };

/**
 * The weight line: the last eight weigh-ins, oldest first, spread across a
 * 100 × 42 box. Heavier is higher on screen, so y runs down from the top: the
 * heaviest sits at 0 and the lightest at 42; all equal sit in the middle, and
 * a single weigh-in is one point in the centre.
 */
export function weightPoints(weights: WeightLog[], width = 100, height = 42, count = 8): Point[] {
  const last = [...weights].sort((a, b) => a.date.localeCompare(b.date)).slice(-count);
  if (last.length === 0) return [];
  const kgs = last.map((w) => w.kg);
  const max = Math.max(...kgs);
  const min = Math.min(...kgs);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return last.map((w, i) => ({
    x: last.length === 1 ? width / 2 : r1((i / (last.length - 1)) * width),
    y: max === min ? height / 2 : r1(((max - w.kg) / (max - min)) * height),
  }));
}

/**
 * A water log from the water tile: today's is logged now, one added to an earlier day at its noon, the way a walk is
 * (`loggedAt`). Null for a date after today: nothing is drunk in the future.
 */
export function waterLog(input: { id: string; date: ISODate; ml: number; now: Date }): WaterLog | null {
  const at = loggedAt(input.date, input.now);
  return at ? { id: input.id, at: at.toISOString(), date: input.date, ml: input.ml } : null;
}

/** The water logs with one more (`waterLog`) after the others; the same list when a date after today logs nothing. */
export function withWaterAdded(water: WaterLog[], input: { id: string; date: ISODate; ml: number; now: Date }): WaterLog[] {
  const log = waterLog(input);
  return log ? [...water, log] : water;
}

/** The water logs without the one with this id, the others untouched; the same list when no log has it. */
export function withWaterRemoved(water: WaterLog[], id: string): WaterLog[] {
  return water.some((w) => w.id === id) ? water.filter((w) => w.id !== id) : water;
}
