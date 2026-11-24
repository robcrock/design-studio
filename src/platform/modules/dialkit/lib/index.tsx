// @module/dialkit: DialKit's dials for a prototype view (README.md). `useDialKit` is DialKit's own hook, so a view
// that leaves Studio keeps working by importing it from 'dialkit' instead. In a local Studio's view preview the
// panel shows, with Save to code to write the values into the view's code; published sites and embeds show no panel.
import { useEffect } from 'react';
import { useDialKit as useDialKitValues, type DialConfig, type ResolvedValues, type UseDialOptions } from 'dialkit';

export type { DialConfig } from 'dialkit';

export function useDialKit<T extends DialConfig>(name: string, config: T, options?: UseDialOptions): ResolvedValues<T> {
  useEffect(() => {
    if (import.meta.env.DEV && document.documentElement.dataset.previewSurface === 'page')
      void import('./panel').then(panel => panel.start());
  }, []);
  return useDialKitValues(name, config, options);
}
