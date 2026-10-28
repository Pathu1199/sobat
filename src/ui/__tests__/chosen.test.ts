import { describe, expect, it } from 'vitest';
import { chosenProps } from '../chosen';

describe('a chosen chip or day, for a screen reader', () => {
  it('on the web is a pressed button, which the browser reads, and not a selected one, which a button cannot be', () => {
    expect(chosenProps(true, 'web')).toEqual({ 'aria-pressed': true });
    expect(chosenProps(false, 'web')).toEqual({ 'aria-pressed': false });
  });

  it('on a phone stays selected, as before', () => {
    expect(chosenProps(true, 'ios')).toEqual({ 'aria-selected': true });
    expect(chosenProps(false, 'android')).toEqual({ 'aria-selected': false });
  });

  it('claims no state at all for a control given none', () => {
    expect(chosenProps(undefined, 'web')).toEqual({ 'aria-pressed': undefined });
    expect(chosenProps(undefined, 'ios')).toEqual({ 'aria-selected': undefined });
  });
});
