// The stored form of a canvas: an Excalidraw scene kept small and stable so canvases diff cleanly in
// git and an agent can read them. Shared by the app (format.ts) and the command line (cli.ts), so
// it imports nothing.
//
// - Deleted elements are never stored (undoing a delete is in-memory history).
// - Images are never stored and `files` is always empty: an image's bytes would be written into
//   this file. A canvas shows the view itself instead.
// - Fields at Excalidraw's default are dropped; `restoreElements` fills them back in on load.
//   `version`, `versionNonce` and `index` are kept: merging changes needs them.
// - Numbers are rounded, keys are sorted, and volatile fields (`updated`) are dropped. `created` is
//   kept only on sticky notes, which show it as their date.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { resourceId, type ResourceId } from '#studio/files';

export type Stored = Record<string, any>;

// Excalidraw's own file version (keeps the file opening on excalidraw.com).
const EXCALIDRAW_FILE_VERSION = 2;
// This app's version of the stored shape. Bump it when the shape changes, and upgrade older files
// in `parseCanvas` (format.ts). type.ts checks against the same number.
export const FORMAT_VERSION = 1;

export const DEFAULT_BACKGROUND = '#ffffff';

// Fields dropped when equal to Excalidraw's element defaults.
const DEFAULTS: Record<string, unknown> = {
  angle: 0,
  backgroundColor: 'transparent',
  boundElements: null,
  customData: undefined,
  fillStyle: 'solid',
  frameId: null,
  groupIds: [],
  isDeleted: false,
  link: null,
  locked: false,
  opacity: 100,
  roughness: 1,
  roundness: null,
  strokeColor: '#1e1e1e',
  strokeStyle: 'solid',
  strokeWidth: 2,
};
const VOLATILE = new Set(['updated']);

const round = (n: number) => (Number.isFinite(n) && !Number.isInteger(n) ? Math.round(n * 100) / 100 : n);

// A deep copy with numbers rounded and object keys sorted.
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, stable((value as Stored)[key])]),
    );
  }
  return typeof value === 'number' ? round(value) : value;
}

const isDefault = (key: string, value: unknown) => {
  if (!(key in DEFAULTS)) return false;
  const def = DEFAULTS[key];
  return Array.isArray(def) ? Array.isArray(value) && value.length === 0 : value === def;
};

// One element in stored form. `mapLink` turns a link into its stored form (an app path).
export function slimElement(element: Stored, mapLink: (link: string) => string = link => link): Stored {
  const out: Stored = {};
  for (const [key, raw] of Object.entries(element)) {
    const value = key === 'link' && typeof raw === 'string' ? mapLink(raw) : raw;
    if (value === undefined || VOLATILE.has(key) || isDefault(key, value)) continue;
    if (key === 'created' && element.type !== 'stickynote') continue;
    out[key] = value;
  }
  return stable(out) as Stored;
}

// The canvas file's text. Only what the canvas restores is kept of the app state: the background
// and grid. The camera is per person (camera.ts).
export function stringifyScene(
  elements: readonly Stored[],
  appState: { viewBackgroundColor?: string; gridSize?: number | null } = {},
  mapLink?: (link: string) => string,
  studioId?: ResourceId | null,
): string {
  const scene = {
    type: 'excalidraw',
    version: EXCALIDRAW_FILE_VERSION,
    studioVersion: FORMAT_VERSION,
    ...(studioId != null ? { studioId: resourceId(studioId) } : {}),
    elements: elements.filter(el => !el.isDeleted && el.type !== 'image').map(el => slimElement(el, mapLink)),
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor || DEFAULT_BACKGROUND,
      ...(appState.gridSize != null ? { gridSize: appState.gridSize } : {}),
    },
    files: {},
  };
  return `${JSON.stringify(scene, null, 2)}\n`;
}
