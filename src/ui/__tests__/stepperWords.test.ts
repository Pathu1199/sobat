import { describe, expect, it } from 'vitest';
import { stepButtonName } from '../stepperWords';

describe('the − and + of an amount, for a screen reader', () => {
  it('on the web, which reads no value on a button, the amount shown is part of each button\'s name', () => {
    expect(stepButtonName('Less chapati', '2', 'web')).toBe('Less chapati, 2');
    expect(stepButtonName('More poha', '1½', 'web')).toBe('More poha, 1½');
  });

  it('on a phone the name stays what the button changes, and the amount is read as its value', () => {
    expect(stepButtonName('Less chapati', '2', 'ios')).toBe('Less chapati');
    expect(stepButtonName('Less chapati', '2', 'android')).toBe('Less chapati');
  });
});
