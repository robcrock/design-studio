# Canvas contract

A page to arrange things on: live views and diagrams, and cards for documents from its own prototype, beside native
Excalidraw text, shapes, and arrows. It's [Excalidraw](https://github.com/excalidraw/excalidraw) with the app's
look, and its design comes from Design Studio's canvas. Agent contract: `src/platform/modules/canvas/skills/use-canvas/SKILL.md`.
Human orientation: [Prototypes & systems](/documentation/manual/prototypes#what-belongs-in-a-prototype).

Native Excalidraw tools are the authoring default, including text for screen annotations. Sticky notes are Excalidraw's own `stickynote` element (N, or the toolbar): its text shrinks to fit, then the note grows. There is no Library; Canvas hides Excalidraw's.

Trackpad gestures pan the canvas, including over linked frame headers; modifier-wheel gestures retain Excalidraw's zoom behavior. The canvas contains overscroll so horizontal panning does not fall through to browser history navigation. Frame headers still open their artifacts when clicked.

**This folder is a self-contained file type.** Core never imports it (`src/platform/node/check/check-modules.js`),
so the app runs with or without it. Canvas doesn't import another file type either: it asks the
shared `#studio/data` inspection and `#studio/ui` artifact host how to show an artifact. Browser and CLI sizing use the same surface declaration.

Canvas declares `systemUsage: 'independent'`. Its scene remains readable locally when the prototype's assigned system is missing; each embed checks its own artifact dependency. `references.ts` owns scene-link repair during moves and copies, preserving scene identity and updating changed element versions.

### The model

- **One file per canvas:** `<name>.excalidraw`, anywhere in a prototype. An Excalidraw scene as JSON.
  The name in the navigation comes from the file name.
- **Source identity:** a declared top-level `studioId` survives browser and CLI saves. Creation assigns it explicitly. A canvas written directly gets one from the dev server or the next `pnpm canvas` call, or from `pnpm studio identify <prototype-folder> --yes`. Missing identity fails the build. See [Resource identity](../../context/maintainers/resource-identity.md).
- **Items are embeds.** A view, diagram, or document on a canvas is an Excalidraw `embeddable` element whose
  `link` is the artifact's address in the app (`/prototypes/<prototype-id>/artifacts/<artifact-id>`). The link resolves through
  the manifest (`src/platform/app/artifacts/artifactLinks.ts`) to a prototype and an artifact, and the artifact's file type
  decides how it looks: a type that declares the canvas surface in `capabilities.embeds` and provides an `Embed` (views and diagrams on canvases) shows live, any other
  type shows a card (`src/platform/app/artifacts/ArtifactCard.tsx`), and a link to nothing shows "Not found".
- **Views are pictures.** A view is laid out at a screen width and scaled down to the element's width,
  cropped at the bottom. Each view element states its screen width in `customData.viewport`; the check
  fails a view without one. The canvas writes its system's first screen (`screens` in system.ts) when a view is
  placed, and the agent tools' `screen` sets another of its screens or any width, only when asked. New views are
  a third of their screen width and 900 px of height, so views at different screens compare at one scale.
  Resizing the element changes the crop, not the screen. Nothing in it takes clicks.
- **Agents** use the tools in tools.ts, live in the open canvas or on the file (src/platform/modules/canvas/skills/use-canvas/SKILL.md). Tools select artifacts by source filename and store permanent links. CLI mutations require the owner or an Admin and an active prototype; read-only tools preserve the file.
- **Dev:** edits save to the file through the same file layer as the Source view, and changes made to the
  file from outside (an agent) are taken in live. **Deployed:** the committed file, read-only.
- **Opening:** the route prepares the canvas code, text, and local contributor identity before mounting. Development pre-bundles Excalidraw and embedded UI primitives to avoid dependency-discovery reloads. One quiet surface hides scene initialization and staggered preview mounting. Its status appears after 200 ms as a subtle, theme-aware text shimmer. The animation uses CSS and becomes static text for reduced motion. Once the opening camera has painted, the initial visible live embeds can hold the reveal for at most 2 seconds from editor readiness. Committed previews and errors settle the wait. Offscreen embeds and overview cards do not hold it. The scene reveals once with a 160 ms fade, disabled for reduced motion. Later panning and updates keep the canvas visible. Preview admission and retention remain unchanged.
- **Color mode:** the editor and canvas previews follow Studio's mode, including on refresh. The mode subscription rechecks after mounting to catch saved preferences applied by the shell. Excalidraw controls use Studio tokens in both modes; embedded views keep their assigned system's mode rules.
- **Moved embeds:** permanent artifact links survive source moves. The prototype file layer still repairs filesystem dependencies; copied canvases remap links to the copied artifacts. See [Links and renaming](../prototypes/README.md#links-and-renaming) for scope and limits.

### Where things are

| File | What it does |
| --- | --- |
| `type.ts` | The spec the build reads: extension, template (an empty scene), and `check` (valid JSON, no images) |
| `open.tsx` | Icon, and `load`: the file's text (from the file layer in dev, bundled in production). Loads `Canvas` lazily, so Excalidraw isn't in the main bundle |
| `loader.ts` | The glob of canvas files for the deployed site |
| `CanvasEmbed.tsx` | Read-only, fitted document preview; no saving or editor tools |
| `Canvas.tsx` | Wires the pieces into `<Excalidraw>` |
| `theme.ts` | Shares Studio's current color mode between the editor and canvas previews |
| `canvas.css` | The app's theme for Excalidraw's UI, from the app's tokens, and how its top row compacts when the canvas is narrow |
| `format.ts` | The file format: slim and stable so canvases diff cleanly. No deleted elements, no images, defaults dropped, numbers rounded, keys sorted, links stored as app paths |
| `useCanvasFile.ts` | Saving and taking in changes: debounce, one save at a time, base version and conflict merge, retry with backoff, flush on leaving |
| `mergeRemote.ts` | Merging a changed file into unsaved edits |
| `embeds.tsx` | How an artifact renders on a canvas; sizing rules for new ones; culling off-screen ones |
| `liveViews.ts` | Preview admission and retention |
| `opening.ts` | The bounded opening wait and shared renderer readiness inspection |
| `CanvasOpening.tsx` | The shared opening lifecycle and status surface for pages and document embeds |
| `camera.ts` | Where a canvas opens: where you left it, or fitted to its content |
| `tools.ts` | The agent tools, defined once: what each does and takes (`help`), and running them on a list of elements. Pure |
| `elements.ts`, `slim.ts` | Building blocks for the tools (colors, text sizes, arrows), and the small stable stored form. Pure, shared with the command line |
| `agent.ts` | The tools in the open canvas: `window.__studioCanvas`, dev only |
| `cli.ts` | The same tools on the file, for agents with no browser: `pnpm canvas` |
| `mermaid.ts` | Lays out Mermaid with Excalidraw's converter for the `mermaid` tool (with linkedom as the DOM in `cli.ts`) |
| `menu.tsx`, `shortcuts.ts`, `ControlTooltip.tsx`, `helpDialog.ts` | The trimmed Excalidraw UI: menu and desktop layout, ⌘., fast tooltips, Help dialog |

Excalidraw is patched to hide the link icon on embeds (`patches/README.md`). `UIOptions.getFormFactor` in `menu.tsx` keeps its desktop layout, since the app is often narrow beside other panels. Its fonts load from
Excalidraw's CDN.

### Remove it

Follow the [manage-modules skill](../../skills/manage-modules/SKILL.md) and use the removal preview. It identifies consumers and retained dependencies.

The module owns the canvas CLI and agent rule. Its npm package and any unused patch configuration need separate cleanup after removal.

### Document embeds

Fitted, read-only canvases in Markdown use the same quiet opening surface, bounded wait, and single reveal as canvas pages. Their frames keep their dimensions while the scene and nested previews load. A lightweight registered pending surface covers reference resolution and lazy canvas-code loading with the same appearance and status timing. Fitted embeds still mount their nested previews together and do not use the editor's admission gate. Source and theme updates preserve the revealed canvas. Changing the embedded canvas identity starts a fresh opening.

### Preview lifetime

Retained view and diagram embeds use the [shared artifact lifecycle contract](../../context/maintainers/source.md#artifact-revision-and-preview-lifecycle). Offscreen hiding preserves mounted runtimes and updates within the existing admission/eviction policy; it does not pause them. Mounted views are [still embeds](../view/README.md#still-embeds): each holds its motion once rendered, except the one selected item, which plays until it is deselected. Eviction, removal, or leaving disposes their listeners and pending work. Canvas scene saving retains its separate version and conflict model.

## Shared artifact host

Canvas uses the common artifact resolver for sizing, opening readiness, and agent metadata. `ArtifactHost` owns frames, cards, pending rendering, lazy format preparation, and error containment. Canvas owns its scene, dimensions, inert interaction, overview label, camera, and retention policy. Admission allows one new preview per 150 ms, with a target budget of 30 retained previews and a five-second retention grace. Visible or grace-protected previews can temporarily exceed the budget. Hiding an admitted preview changes layout/paint visibility without unmounting it or replacing its readiness evidence.
