import { describe, expect, it } from 'vitest';
import { spokenLine, toastMs, toastSpeech } from '../toastWords';

describe('a toast, for a screen reader', () => {
  it('says the toast\'s words and, when it has one, the name of its button', () => {
    expect(toastSpeech('Added 500 ml water')).toBe('Added 500 ml water');
    expect(toastSpeech('Added 500 ml water', 'Undo')).toBe('Added 500 ml water. Undo');
  });

  it('does not stop a sentence twice', () => {
    expect(toastSpeech('Saved.', 'Undo')).toBe('Saved. Undo');
    expect(toastSpeech('जतन केले।', 'मागे घ्या')).toBe('जतन केले। मागे घ्या');
  });
});

describe('phrases said one after another', () => {
  it('are sentences with one full stop between two, the empty ones left out', () => {
    expect(spokenLine(['Weight, smoothed: No weigh-in yet.', 'Goal 80 kg'])).toBe('Weight, smoothed: No weigh-in yet. Goal 80 kg');
    expect(spokenLine(['Weight, smoothed: 80.2 kg', '', 'Last weigh-in 2 Oct 2026.', null, 'Goal reached'])).toBe('Weight, smoothed: 80.2 kg. Last weigh-in 2 Oct 2026. Goal reached');
    expect(spokenLine(['Streak: 5 days', 'Opens Progress.'])).toBe('Streak: 5 days. Opens Progress.');
    expect(spokenLine([undefined, 'Open the plan'])).toBe('Open the plan');
    expect(spokenLine([])).toBe('');
  });
});

describe('how long a toast stays', () => {
  it('two seconds with nothing to tap, five with a button', () => {
    expect(toastMs(false, false)).toBe(2000);
    expect(toastMs(true, false)).toBe(5000);
  });

  it('with a screen reader on, a toast with a button stays ten seconds, time to reach it; one without stays two', () => {
    expect(toastMs(true, true)).toBe(10000);
    expect(toastMs(false, true)).toBe(2000);
  });
});
