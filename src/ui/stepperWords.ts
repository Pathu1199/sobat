/**
 * The name of a − or + button beside an amount. A phone reads the amount as
 * the button's value; the web reads no value on a button, so there the amount
 * shown is part of the name ("Less chapati, 2"). Pure, so it is tested
 * without a screen.
 */
export function stepButtonName(label: string, value: string, os: string): string {
  return os === 'web' ? `${label}, ${value}` : label;
}
