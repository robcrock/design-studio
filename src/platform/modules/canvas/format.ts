import { canvasIdentity } from './identity.ts';
// The canvas file: an Excalidraw scene, kept small and stable so canvases diff cleanly in git and
// an agent can read and edit them.
//
// - Deleted elements are never stored (undoing a delete is in-memory history).
// - Images are never stored and `files` is always empty: an image's bytes would be written into
//   this file. A canvas shows the view itself instead.
// - Fields at Excalidraw's default are dropped; `restoreElements` fills them back in on load.
//   `version`, `versionNonce` and `index` are kept: merging changes needs them.
// - Numbers are rounded, keys are sorted, and volatile fields (`updated`) are dropped. `created` is
//   kept only on sticky notes, which show it as their date.
// - A link to an item is stored as its address in the app ("/samples/hello-world/lofi/main"),
//   so a canvas works on any host and under any base path.
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { appPathOf } from '@/platform/app/artifacts/artifactLinks';
import { type ResourceId } from '../../core/fileTypes';
import { DEFAULT_BACKGROUND, FORMAT_VERSION, stringifyScene, type Stored } from './slim';

export type ParsedCanvas = {
  studioId: ResourceId | null;
  elements: Stored[];
  background: string;
  gridSize: number | null;
  // Written by a newer copy of the app: open it, never save over it.
  tooNew: boolean;
};

export function parseCanvas(text: string): ParsedCanvas {
  const file = JSON.parse(text) as {
    elements?: unknown;
    appState?: { viewBackgroundColor?: string; gridSize?: number | null };
    studioVersion?: unknown;
  };
  if (!file || typeof file !== 'object' || !Array.isArray(file.elements))
    throw new Error("This isn't a canvas file: it has no list of elements.");
  const version = file.studioVersion ?? 1;
  if (!Number.isInteger(version) || (version as number) < 1)
    throw new Error(`Unknown canvas version: ${JSON.stringify(file.studioVersion)}`);
  return {
    studioId: canvasIdentity.read(text),
    elements: withOrigin(file.elements as Stored[]),
    background: file.appState?.viewBackgroundColor || DEFAULT_BACKGROUND,
    gridSize: file.appState?.gridSize ?? null,
    tooNew: (version as number) > FORMAT_VERSION,
  };
}

// Stored links are addresses in the app; Excalidraw wants whole URLs.
function withOrigin(elements: Stored[]): Stored[] {
  const prefix = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}`;
  return elements.map(el =>
    typeof el.link === 'string' && el.link.startsWith('/') && !el.link.startsWith('//')
      ? { ...el, link: `${prefix}${el.link}` }
      : el,
  );
}

export function serializeCanvas(
  elements: readonly ExcalidrawElement[],
  appState: { viewBackgroundColor?: string; gridSize?: number | null } = {},
  studioId?: ResourceId | null,
): string {
  // An item's link is its app path; any other link (there shouldn't be one) is kept as it is.
  return stringifyScene(elements as unknown as Stored[], appState, link => appPathOf(link) ?? link, studioId);
}
