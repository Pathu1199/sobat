/**
 * The ?s= value as one section name. A repeated ?s=a&s=b comes as an array,
 * a new one on every render, which names no one section; read as undefined,
 * it compares equal from one render to the next, so a page that follows the
 * link never sees it change again and again.
 */
export function linkOf(s: unknown): string | undefined {
  return typeof s === 'string' ? s : undefined;
}

/**
 * The section a ?s= link opens on a page with sections (Food, Body, Progress):
 * a link takes effect only when it changes from the last one seen, so a param
 * left in the address never pulls back a section picked by hand. Null when
 * nothing new is asked for or the name is not one of the sections.
 */
export function sectionFromLink<T extends string>(sections: readonly T[], s: unknown, seen: unknown): T | null {
  if (s === seen || typeof s !== 'string') return null;
  return (sections as readonly string[]).includes(s) ? (s as T) : null;
}
