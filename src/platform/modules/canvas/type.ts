import { canvasIdentity } from './identity.ts';
// A canvas: a page you can arrange things on. Views and documents from its own prototype sit on it
// beside sticky notes, text, and arrows, drawn with Excalidraw. The file is Excalidraw's own
// format (an .excalidraw file is JSON), so its name, without the extension, is the canvas's name
// in the navigation.
import { defineFileType, parsePrototypeAddress } from '#studio/files';

// Version 1 of the canvas file (see format.ts). A newer one is opened but never saved over.
const KNOWN_VERSION = 1;

export default defineFileType({
  capabilities: { source: true, create: true, fidelity: false, embeds: ['document'], actions: [] },
  systemUsage: 'independent',
  inPrototype: true,
  inSystemContent: false,
  fallback: false,
  label: 'Canvas',
  identity: canvasIdentity,
  extensions: ['.excalidraw'],
  language: 'json',

  template: () =>
    `${JSON.stringify(
      {
        type: 'excalidraw',
        version: 2,
        studioVersion: KNOWN_VERSION,
        elements: [],
        appState: { viewBackgroundColor: '#ffffff' },
        files: {},
      },
      null,
      2,
    )}\n`,

  check: ({ source, prototype }) => {
    let canvas: { elements?: unknown; files?: unknown; studioVersion?: unknown };
    try {
      canvas = JSON.parse(source);
    } catch (error) {
      return [`it isn't valid JSON (${(error as Error).message}).`];
    }
    if (!canvas || typeof canvas !== 'object' || Array.isArray(canvas)) return ['a canvas is one JSON object.'];
    const problems: string[] = [];
    if (!Array.isArray(canvas.elements)) problems.push('"elements" must be a list (use [] for an empty canvas).');
    else if (canvas.elements.some(el => (el as { type?: string })?.type === 'image'))
      problems.push(
        "a canvas can't hold images: their bytes would be stored inside the file. Remove the image elements, and put the view itself on the canvas instead of a screenshot of it.",
      );
    if (canvas.files && Object.keys(canvas.files).length)
      problems.push('"files" must be empty. Images aren\'t stored in a canvas.');
    // A canvas shows only its own prototype's items, so a prototype is all of its own. Links are stored as app
    // paths ("/prototypes/samples/hello-world/lofi/main", or the older "/samples/hello-world/lofi/main").
    if (prototype && Array.isArray(canvas.elements)) {
      // (This file can import only ../index.ts, so the address is checked here in both forms.)
      const isHere = (link: string) => {
        if (prototype.studioId) {
          const address = parsePrototypeAddress(link.split(/[?#]/)[0]);
          return Boolean(address?.artifactId && address.prototypeId === prototype.studioId);
        }
        return (
          link.startsWith(`/prototypes/${prototype.contributor}/${prototype.id}/`) ||
          link.startsWith(`/${prototype.contributor}/${prototype.id}/`)
        );
      };
      const elsewhere = new Set<string>();
      for (const el of canvas.elements as { link?: unknown }[]) {
        const link = el?.link;
        if (typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') && !isHere(link))
          elsewhere.add(link);
      }
      if (elsewhere.size)
        problems.push(
          `it links to another prototype (${[...elsewhere].slice(0, 3).join(', ')}${elsewhere.size > 3 ? ', …' : ''}). A canvas shows only items from its own prototype: copy the view into this prototype, then link that copy.`,
        );
      // A view shows one of its system's screens, so each view on a canvas says which: customData.viewport,
      // the screen width in pixels. The canvas tools write it; it is never assumed.
      const assigned = new Set(
        (prototype.artifacts ?? []).filter(a => a.systemUsage === 'assigned' && a.studioId).map(a => a.studioId),
      );
      const unsized = (canvas.elements as { link?: unknown; customData?: { viewport?: unknown } }[]).filter(el => {
        if (typeof el?.link !== 'string') return false;
        const artifactId = parsePrototypeAddress(el.link.split(/[?#]/)[0])?.artifactId;
        const viewport = el.customData?.viewport;
        return (
          artifactId &&
          assigned.has(artifactId) &&
          !(Number.isInteger(viewport) && (viewport as number) >= 200 && (viewport as number) <= 4096)
        );
      });
      if (unsized.length)
        problems.push(
          `${unsized.length} view${unsized.length === 1 ? " doesn't" : "s don't"} say which screen ${unsized.length === 1 ? 'it is' : 'they are'} shown at. Give each view's element "customData": { "viewport": <screen width> }, a width from 200 to 4096 such as its system's first screen (system.ts screens), or set it with the canvas update tool's \`screen\`.`,
        );
    }
    const v = canvas.studioVersion ?? 1;
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > KNOWN_VERSION)
      problems.push(
        `"studioVersion" must be a whole number from 1 to ${KNOWN_VERSION}. A newer file needs a newer copy of the app.`,
      );
    return problems;
  },
});
