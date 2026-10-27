import { describe, expect, it } from 'vitest';
import { EMPTY_STATE } from '../../store/defaults';
import { buildPushSchedule, pushStep } from '../pushSchedule';
import type { AppState } from '../types';

describe('pushStep', () => {
  const here = { configured: true, relayOn: true, known: true, active: true, payload: '{"v":1}', lastSent: '' };

  it('sends a changed schedule for the person using the device, and only once', () => {
    expect(pushStep(here)).toBe('send');
    expect(pushStep({ ...here, lastSent: here.payload })).toBe('none');
  });

  it("removes the relay's copy on a device that is signed out or reset", () => {
    expect(pushStep({ ...here, active: false, payload: '' })).toBe('stop');
    expect(pushStep({ ...here, active: false, payload: '', lastSent: here.payload })).toBe('stop');
  });

  it('decides nothing before the store and the session are known', () => {
    expect(pushStep({ ...here, known: false, active: false, payload: '' })).toBe('none');
  });

  it('leaves the relay alone when background reminders are off or not set up', () => {
    expect(pushStep({ ...here, relayOn: false, active: false })).toBe('none');
    expect(pushStep({ ...here, configured: false, active: false })).toBe('none');
    expect(pushStep({ ...here, relayOn: false })).toBe('none');
  });
});

describe('buildPushSchedule: meal-time prompts', () => {
  // Set up on Monday 12 October 2026.
  const state: AppState = { ...EMPTY_STATE, profile: { ...EMPTY_STATE.profile, onboarded: true, onboardedOn: '2026-10-12' } };
  const build = (s: AppState, today: string) => buildPushSchedule(s, today, (k) => k, 'Asia/Kolkata');

  it('sends each slot at its time plus the grace, from the day after setup', () => {
    const slots = build(state, '2026-10-13').slots;
    expect(slots.map((s) => [s.id, s.at])).toEqual([
      ['breakfast', '09:15'],
      ['lunch', '13:45'],
      ['snack', '16:45'],
      ['dinner', '21:15'],
    ]);
    expect(slots[0]).toMatchObject({ title: 'Breakfast?', body: 'slot_prompt' });
  });

  it('sends none on the day the person finished setup', () => {
    expect(build(state, '2026-10-12').slots).toEqual([]);
  });

  it('sends none with the meal-time prompt off', () => {
    const off: AppState = { ...state, settings: { ...state.settings, reminders: { ...state.settings.reminders, mealPrompt: false } } };
    expect(build(off, '2026-10-13').slots).toEqual([]);
  });
});
