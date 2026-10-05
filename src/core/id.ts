/**
 * Identifiers for records the app creates.
 *
 * `String(Date.now())` was used for this, which collides whenever two records
 * are made inside the same millisecond — a user message and its reply, or two
 * taps on the water button. The counter makes that impossible, and the
 * timestamp keeps ids roughly sortable by when they were made.
 */

let counter = 0;

export function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
