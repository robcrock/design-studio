// The canvas's menu and the parts of Excalidraw's UI it keeps. It removes only what would do
// harm ("Open" replaces the canvas with a file, "Reset the canvas" wipes it) or already has its
// own control (export; light/dark follows the app's color mode). Help, Undo and Redo live only in
// this menu (their corner buttons are hidden in canvas.css). A canvas you can't edit keeps only
// Hide controls: the rest would change it.
import { useEffect, useState } from 'react';
import { MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from '@excalidraw/excalidraw/types';

export const UI_OPTIONS: ExcalidrawProps['UIOptions'] = {
  canvasActions: {
    loadScene: false,
    clearCanvas: false,
    saveToActiveFile: false,
    export: false,
    toggleTheme: false, // also disables its shortcut; the `theme` prop follows the app
  },
  // No images on a canvas: Excalidraw stores an image's bytes inside the canvas file, and a few
  // pasted screenshots would bloat the repo. This one flag also turns off the toolbar button, the
  // 9 shortcut, and pasting and dropping images. A canvas shows the real view instead. The other
  // guards: format.ts (never saved), type.ts (the build fails on one).
  tools: { image: false },
  // The desktop layout at every size. A canvas is often narrow because it sits beside an agent's
  // sidebars, and Excalidraw's phone layout (a bottom bar, a pop-up menu) is harder to use there.
  getFormFactor: () => 'desktop',
};

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const key = (mac: string, other: string) => (MAC ? mac : other);

// Grid and snap-to-objects are personal, ephemeral view settings (never saved in the file) and
// mutually exclusive: turning one on turns the other off, as their own shortcuts do. Tracked from
// the API so the checks stay right when a shortcut is used instead of the menu.
function useAlignment(api: ExcalidrawImperativeAPI | null) {
  const read = () => ({
    grid: Boolean(api?.getAppState().gridModeEnabled),
    snap: Boolean(api?.getAppState().objectsSnapModeEnabled),
  });
  const [modes, setModes] = useState(read);
  useEffect(() => {
    if (!api) return undefined;
    setModes(read());
    return api.onChange((_elements, state) => {
      const next = { grid: Boolean(state.gridModeEnabled), snap: Boolean(state.objectsSnapModeEnabled) };
      setModes(prev => (prev.grid === next.grid && prev.snap === next.snap ? prev : next));
    });
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps
  return modes;
}

// Excalidraw has no undo/redo API; its footer buttons (hidden) still run its history, so pressing
// them keeps its exact behavior, including what's undoable.
const pressHistory = (testId: string) =>
  document.querySelector<HTMLElement>(`.canvas [data-testid="${testId}"]`)?.click();

const Svg = ({ children, flip }: { children: React.ReactNode; flip?: boolean }) => (
  <svg
    viewBox='0 0 20 20'
    width='20'
    height='20'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.25'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
    style={flip ? { transform: 'scaleX(-1)' } : undefined}
  >
    {children}
  </svg>
);
const GridIcon = () => (
  <Svg>
    <path d='M3.333 3.333h13.334v13.334H3.333zM3.333 8.333h13.334M3.333 12.5h13.334M8.333 3.333v13.334M12.5 3.333v13.334' />
  </Svg>
);
const SnapIcon = () => (
  <Svg>
    <path d='M4.167 10a5.833 5.833 0 0 1 11.666 0v5.833h-3.333V10a2.5 2.5 0 0 0-5 0v5.833H4.167zM4.167 12.5H7.5M12.5 12.5h3.333' />
  </Svg>
);
const UndoIcon = ({ redo }: { redo?: boolean }) => (
  <Svg flip={redo}>
    <path d='M7.5 10.833 4.167 7.5 7.5 4.167M4.167 7.5h9.166a3.333 3.333 0 0 1 0 6.667H12.5' />
  </Svg>
);
const EyeIcon = ({ off }: { off?: boolean }) => (
  <svg
    viewBox='0 0 24 24'
    width='20'
    height='20'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    aria-hidden='true'
  >
    <path d='M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z' />
    <circle cx='12' cy='12' r='3' />
    {off && <path d='M4 4l16 16' />}
  </svg>
);

export function CanvasMenu({
  api,
  controlsHidden,
  onToggleControls,
  editable,
}: {
  api: ExcalidrawImperativeAPI | null;
  controlsHidden: boolean;
  onToggleControls: () => void;
  editable: boolean;
}) {
  const { grid, snap } = useAlignment(api);
  const hide = (
    <MainMenu.Item onSelect={onToggleControls} shortcut={key('⌘.', 'Ctrl+.')} icon={<EyeIcon off={!controlsHidden} />}>
      {controlsHidden ? 'Show controls' : 'Hide controls'}
    </MainMenu.Item>
  );
  if (!editable) return <MainMenu>{hide}</MainMenu>;
  return (
    <MainMenu>
      <MainMenu.Item onSelect={() => pressHistory('button-undo')} shortcut={key('⌘Z', 'Ctrl+Z')} icon={<UndoIcon />}>
        Undo
      </MainMenu.Item>
      <MainMenu.Item
        onSelect={() => pressHistory('button-redo')}
        shortcut={key('⇧⌘Z', 'Ctrl+Shift+Z')}
        icon={<UndoIcon redo />}
      >
        Redo
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.Item
        onSelect={() => api?.updateScene({ appState: { gridModeEnabled: !grid, objectsSnapModeEnabled: false } })}
        shortcut={key("⌘⇧'", "Ctrl+Shift+'")}
        icon={<GridIcon />}
        selected={grid}
        aria-pressed={grid}
      >
        Toggle grid
      </MainMenu.Item>
      <MainMenu.Item
        onSelect={() => api?.updateScene({ appState: { objectsSnapModeEnabled: !snap, gridModeEnabled: false } })}
        shortcut={key('⌥S', 'Alt+S')}
        icon={<SnapIcon />}
        selected={snap}
        aria-pressed={snap}
      >
        Snap to objects
      </MainMenu.Item>
      <MainMenu.Separator />
      <MainMenu.DefaultItems.Help />
      {hide}
      <MainMenu.DefaultItems.ChangeCanvasBackground />
    </MainMenu>
  );
}
