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
