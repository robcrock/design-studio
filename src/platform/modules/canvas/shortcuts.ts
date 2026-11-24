// Canvas keyboard shortcuts on top of Excalidraw's:
//   ⌘. / Ctrl+.  hide or show all canvas controls
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { CaptureUpdateAction } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { artifactShortcut } from '@/platform/app/shell/artifactShortcuts';

const typing = (target: EventTarget | null) =>
  (target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable="true"]');

export function useCanvasShortcuts(api: ExcalidrawImperativeAPI | null, container: RefObject<HTMLElement | null>) {
  const [controlsHidden, setControlsHidden] = useState(false);
  const toggleControls = useCallback(() => setControlsHidden(hidden => !hidden), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '.' || !(event.metaKey || event.ctrlKey) || typing(event.target)) return;
      event.preventDefault();
      toggleControls();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleControls]);

  // Reserve unshifted apostrophe for source. Handle the shifted grid combination before
  // Excalidraw's handler, which otherwise accepts both combinations.
  useEffect(() => {
    const el = container.current;
    if (!el || !api) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const action = artifactShortcut(event);
      if (!action || typing(event.target) || el.querySelector('[role="dialog"], [role="menu"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action === 'grid')
        api.updateScene({
          appState: { gridModeEnabled: !api.getAppState().gridModeEnabled, objectsSnapModeEnabled: false },
          captureUpdate: CaptureUpdateAction.EVENTUALLY,
        });
    };
    el.addEventListener('keydown', onKeyDown, true);
    return () => el.removeEventListener('keydown', onKeyDown, true);
  }, [api, container]);

  return { controlsHidden, toggleControls };
}
