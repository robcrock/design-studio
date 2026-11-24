import { useCallback, useSyncExternalStore } from 'react';
import { usePortalContainer } from './portal.ts';

export type ColorMode = 'light' | 'dark';

// Rendered system content takes its mode from the nearest theme boundary's data-color-mode,
// never from `.dark` on <html>. The host's overlay container sits inside that boundary.
export function useColorMode(): ColorMode {
  const boundary = usePortalContainer()?.closest<HTMLElement>('[data-color-mode]') ?? null;
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!boundary) return () => {};
      const observer = new MutationObserver(notify);
      observer.observe(boundary, { attributes: true, attributeFilter: ['data-color-mode'] });
      return () => observer.disconnect();
    },
    [boundary],
  );
  return useSyncExternalStore(
    subscribe,
    () => (boundary?.dataset.colorMode === 'dark' ? 'dark' : 'light'),
    () => 'light',
  );
}
