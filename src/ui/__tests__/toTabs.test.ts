import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toTabs } from '../../components/toTabs';

// Hoisted above the imports by vitest, so toTabs gets this router and the real package is never loaded.
const router = vi.hoisted(() => ({ navigate: vi.fn(), dismissTo: vi.fn() }));
vi.mock('expo-router', () => ({ router }));

describe('toTabs: opening a page of the tabs from a page over them, or from inside a tab', () => {
  beforeEach(() => {
    router.navigate.mockClear();
    router.dismissTo.mockClear();
  });

  it('goes back down to the tabs already under a page of its own, so no second copy of them is stacked', () => {
    toTabs('/growth', false);
    expect(router.dismissTo).toHaveBeenCalledWith('/growth');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('moves within the tabs from inside a tab, where the tab navigator has nothing to go back down to', () => {
    toTabs('/food?s=routine', true);
    expect(router.navigate).toHaveBeenCalledWith('/food?s=routine');
    expect(router.dismissTo).not.toHaveBeenCalled();
  });
});
