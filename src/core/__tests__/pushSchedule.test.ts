import { describe, expect, it } from 'vitest';
import { pushStep } from '../pushSchedule';

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
