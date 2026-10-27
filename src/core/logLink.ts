/**
 * The old /log address. A link to it opens the add sheet once, over Today.
 * The tab bar remembers the tabs seen, so Back from Today could bring /log
 * into view again with the link it already handled; opening the sheet again
 * there would trap the person between Today and the sheet. So a link is
 * handled once: seen again, /log steps back past itself, or, with nothing
 * behind it, hands over to Today. A link is told apart by the object the
 * navigator hands /log: following an address always brings a new one, even
 * with the same words in it, and going back brings the same one again.
 */
export type LogLinkStep = 'open' | 'back' | 'leave';

export function logLinkStep(link: object, handled: { has(link: object): boolean }, canGoBack: boolean): LogLinkStep {
  if (!handled.has(link)) return 'open';
  return canGoBack ? 'back' : 'leave';
}

type TabRoute = { key: string; name: string; params?: object };
/** A tab bar's state as the navigator keeps it: its way back holds `{ type: 'route', key }` entries. */
type TabsState = { index: number; routes: readonly TabRoute[]; history?: unknown[] };

const keyOf = (entry: unknown): unknown => (entry && typeof entry === 'object' && 'key' in entry ? entry.key : undefined);

/**
 * The tab bar's state once /log has handed over: the tab named `to` in front,
 * with `params` when given, and /log (the route `from`) off the way back, so
 * Back from Today goes where the person was before the link and never to
 * /log. (expo-router's replace leaves the replaced tab in a tab bar's way
 * back.) The other tabs are left as they were; with no tab named `to`, the
 * state is unchanged.
 */
export function handOff<S extends TabsState>(state: S, from: string, to: string, params?: object): S {
  const at = state.routes.findIndex((r) => r.name === to);
  if (at < 0) return state;
  const key = state.routes[at].key;
  const routes = params === undefined ? state.routes : state.routes.map((r, i) => (i === at ? { ...r, params } : r));
  const history = state.history && [...state.history.filter((h) => keyOf(h) !== from && keyOf(h) !== key), { type: 'route', key }];
  return { ...state, index: at, routes, history };
}

/**
 * How /log hands over to Today on the web, where the browser's Back replays
 * the addresses it recorded and the browser follows the tab bar's way back by
 * its length: the same length replaces the browser's entry, a shorter one
 * steps the browser back. The reset (`handOff`) when Today is nowhere on the
 * way back (/log loaded on its own, or another page right behind it: the same
 * length, so the browser replaces /log's entry with Today and Back never finds
 * /log again), or when Today is right behind /log (one shorter: the browser
 * steps back onto Today's own entry, so Today is never there twice). A replace
 * only with Today further back, so the browser keeps the pages in between: a
 * reset would take Today out from there, one shorter, and step the browser
 * back past them. A navigator with no way back of its own, or no Today, gets
 * the replace.
 */
export function webHandOff(state: TabsState, from: string, to: string): 'reset' | 'replace' {
  const today = state.routes.find((r) => r.name === to);
  if (!state.history || !today) return 'replace';
  const keys = state.history.map(keyOf);
  if (!keys.includes(today.key)) return 'reset';
  const at = keys.lastIndexOf(from);
  const behind = at > 0 ? keys[at - 1] : undefined;
  return behind === undefined || behind === today.key ? 'reset' : 'replace';
}
