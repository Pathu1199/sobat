import { describe, expect, it } from 'vitest';
import { sheetBottomPad } from '../sheetPad';

describe('sheetBottomPad: the room under a bottom sheet', () => {
  it("keeps the sheet's last row clear of the home indicator on a phone", () => {
    expect(sheetBottomPad({ wide: false, keyboardUp: false, inset: 34 })).toBe(34);
  });

  it('drops that room while the keyboard is up, since the keyboard covers the home indicator', () => {
    expect(sheetBottomPad({ wide: false, keyboardUp: true, inset: 34 })).toBe(0);
  });

  it('a centred panel on a wide screen never needs it', () => {
    expect(sheetBottomPad({ wide: true, keyboardUp: false, inset: 34 })).toBe(0);
  });
});
