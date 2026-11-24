# Documentation contract

The Documentation module owns the human Manual at `/documentation/manual`. The shared platform owns the platform and module Context and Skills browser at `/documentation/context/<owner>`. Manual chapters explain using Studio; the browser displays original README, context, and skill files.

## Manual pages

Human chapters live in `src/platform/modules/documentation/pages/*.md`. Each requires `title` and numeric `order` frontmatter. Optional `description` supplies a summary; `section` groups navigation. The filename supplies its slug; `index.md` opens at the Manual root.

The module scans its canonical chapter folder through its optional `build.ts` ([build hook](../../context/modules.md#capability-files)), which supplies the manifest's Manual data, the folder the dev server watches, and the chapters the Documentation surface can edit. Discovery does not depend on module registry initialization.

A capability chapter declares `module: <id>`. Discovery includes it only when the module is installed and enabled. Disabling or removing the capability preserves the chapter but hides its reading route, navigation, and search target. Unassociated chapters remain available while Manual is enabled.

Invalid metadata produces a local warning and fails strict builds. Source mode keeps malformed chapters repairable. The sidebar lists reference pages. There is no previous/next reading sequence.

## Context and Skills sources

The shared browser uses registered owners from the manifest: Platform and enabled modules. Navigation selects documents from each owner's catalog group, rather than directory ancestry. Each owner's README entry renders its canonical README when present; without one it displays discovered context and skills. Additional top-level module contracts remain accessible under that owner.

The instruction browser has fixed Platform and Modules section headings. Each owner lists its README, context documents, and skill entry documents directly, without Context or Skills folder layers. Icons identify the source type. Document, Context, or Skill labels appear on hover or keyboard focus. Row backgrounds appear on hover or keyboard focus, and the selected document retains its background and distinct text styling. README stays explicitly named; other entries use human-readable names. Module branches collapse, remember choices while browsing, and open for the current document. One Search control filters owners, entries, types, and source paths. Matching branches open temporarily; clearing the search restores expansion choices.

This navigation supports reading and source access. It has no creation, dragging, renaming, moving, or deletion controls. Skills expose supporting files through their source-mode picker rather than separate navigation entries. Repository ownership and folders remain unchanged.

The navigation stays mounted when opening another instruction document or switching source mode. Its scroll position, search, and expansion choices persist while the document view changes.

Context entries use the document's declared title for both navigation and the page heading. Filenames remain source identifiers rather than separate display names.

Platform knowledge lives in `src/platform/context/`, with knowledge and technical requirements at the same level. Module and system context and skills live under their respective owners. Component API pages remain beside components and are exposed by Systems.

The browser uses the same source inventory and file readers as system content. Skills retain their file picker for supporting references, scripts, and assets. Generated harness adapters are discovery outputs and have no separately authored procedure.

Legacy Reference and Knowledge URLs redirect to the appropriate scope. System guidance opens in Systems at `/systems/<id>/context` or `/systems/<id>/skills`. Redirects preserve source mode and anchors. They do not create another documentation source.

## Availability and search

Disabling or removing Documentation hides Manual and its module rail entry. The shared header reads the enabled module’s landing contribution to show the Manual tab; it imports no Manual implementation. The shared Context and Skills browser remains directly accessible. Prototype Documents is independent of both readers.

The command menu groups Places, Systems, Prototypes, and Manual in that order. It lists system entries, prototypes, and enabled Manual chapters without individual system files or a Context and Skills link. Individual platform and module README, context, and skill files stay in the instruction browser and are excluded from the command menu. The instruction browser’s search matches titles and source paths, not full document text. Disabled or removed module guidance is excluded.

## Source access

Manual chapters and owner READMEs edit their own complete documents through the shared documentation editor. Context and skill files use their existing file access policies. Navigation exposes Edit source, Open in editor, Reveal in Finder, Copy link, and Copy path where local permissions allow them. Instruction document menus have no rename or delete actions.

The [shared editor](../../context/maintainers/source.md) supplies keyboard controls, version checks, and unsaved-change handling. Published pages retain reading and copying without repository editing or operating-system actions.

Source access is limited to indexed owner documents and locally repairable Manual files. Removing a capability removes its documents from the allowlist; retained chapters remain repairable when Documentation is enabled.

## Implementation

- `module.ts`, `app.tsx`, `ManualLayout.tsx`, `ManualPage.tsx`, `loadManual.ts`, `manualPages.ts`: Manual availability, navigation, palette entries, the `/documentation` landing, and reading. Chapters come from the manifest's `contributions.documentation` (`types.ts`).
- `pages/*.md`: authored human chapters.
- `src/platform/app/docs/KnowledgePage.tsx` and `src/platform/app/router.tsx`: the shared owner browser and overview routes.
- `build.ts`: Manual chapter discovery, contributed to the manifest. `src/platform/node/build/build-manifest.js`: owner discovery.
- `src/platform/node/lib/platform-references.js`: canonical owner document catalog.
- `src/platform/node/build/remark-title-from-heading.js`: opening titles without hiding document sections.
- `src/platform/app/docs/DocumentationEditor.tsx`, `documentationSource.ts`, `src/platform/node/build/files/source.js`: allowlisted document source editing.

Follow [Documentation standards](../../context/documentation-standards.md) and [Maintain documentation](../../skills/maintain-documentation/SKILL.md) for authoring and verification.

Page loading follows the [shared navigation handoff](../../context/maintainers/source.md#navigation-handoff). Route loaders prepare the reader and content before replacing the current page.
