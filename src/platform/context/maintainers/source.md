---
title: "Editing and saving"
---

Source editing is a shared platform capability used by Prototypes, Systems, and Documentation. It has no separate module, route section, or navigation entry.

## File workflow

Right-click a file-backed navigation item to **Edit source** or **View source** when read-only. Its menu also exposes **Open in editor**, **Reveal in Finder**, **Copy link**, and **Copy path**. Module-specific actions such as renaming remain subject to that module's permissions.

**Open in editor** checks installed Cursor, Visual Studio Code, VSCodium, Zed, and Sublime Text applications or executables. A supported `LAUNCH_EDITOR` name takes priority. On macOS it opens the application directly, so its terminal command need not be installed. If none can open, it reveals the file and explains that **Edit source** is available inside Studio. Launch and reveal failures are visible. The same-origin server action accepts only existing, non-hidden source files or folders under `src/`, without symlinks or traversal.

Locally, **⌘' / Ctrl+'** toggles the selected page between rendering and source. The editor receives focus when opened; returning focuses the rendered content. **⌘S / Ctrl+S** saves. **Done** also returns to the rendered view. **⌘; / Ctrl+;** toggles navigation in either view.

Returning or navigating away with unsaved changes requires confirmation. External edits reload clean editors and offer a conflict choice when local changes are unsaved. Saving checks the version read from disk before writing.

Source editing is available during local development. Published pages retain their reading experience and copying actions without repository editing.

## Settings restart

Saving configuration can restart the development server. The settings API identifies each runtime instance. After restart, the server explicitly requests one page reload so module availability and configuration refresh together. Settings also checks for a new ready instance to recover when the WebSocket reload is missed. A bounded wait reports a recovery error instead of leaving the form disabled indefinitely.

The initiating tab keeps an **Applying changes** transition across the reload. The server injects this surface before React and styles load. Its colors and typography remain stable until the refreshed Settings snapshot is ready. The transition then fades away and confirms success once through the standard toast. Failed loads release the transition so the recovery error remains usable. A save's transition belongs to the page that saved: another page in the tab, reached by Back or a typed URL, drops it rather than waiting for a Settings snapshot that page never loads. A change from outside the tab (the CLI, an agent, another tab) covers whichever page is open, and that page's first render after the restart releases it.

## Navigation handoff

Internal links use TanStack Router. Destination loaders prepare their content, layout, and page renderer before committing navigation. The current page stays visible during preparation. The persistent shell shows **Opening page** after a 200 ms wait. Intent preloading prepares likely destinations without showing progress. Loader failures use the route error surface with retry.

File readers share `prepareFile` from `app/data/fileTypeModule.ts`. It awaits the file loader and the page's optional `preload` together. Use TanStack `lazyRouteComponent` for deferred page renderers so successful preloading makes their first render synchronous. System guidance and the owner knowledge browser prepare documents in route loaders, rather than fetching after mount. Source routes prepare their editor code independently of rendered files so broken code remains repairable.

Document scroll resets before paint when its identity changes. Content edits preserve the current scroll position. Embedded previews remain mounted through unrelated manifest updates. Canvas previews reload for their own file identity or explicit file-change notifications.

Development manifest and file-loader notifications share a serialized refresh queue. Prepared pages remain cached until repository notifications invalidate them. Known file changes invalidate matching active and cached file readers. Manifest changes refresh the shared inventory and route data. Bursts merge into one refresh. Edits arriving during a refresh schedule one trailing refresh. All Markdown scopes self-accept compiled updates. Manual and reference readers use `createMarkdownLoader`, which retains updated modules and distinguishes reference rendering from ordinary document rendering. Managed operations that restart the development server retain their separate operation status surfaces.

## Artifact revision and preview lifecycle

Supplied renderers use `core/artifact-lifecycle/index.ts`. Team renderers use the public `#studio/lifecycle` entry for the same state controller, input digests and DOM evidence. Its versioned state separates three facts:

| Fact | Meaning |
| --- | --- |
| Source revision | SHA-256 of the observed artifact source, plus a separate digest of its relevant rendering inputs. |
| Preparation | A generation and attempt ticket for that revision. A later observation, attempt, pause, or disposal invalidates older work. |
| Displayed revision | Inputs acknowledged after the renderer commits its output. A successful file save or import alone cannot acknowledge them. |

Permanent resource IDs locate artifacts. Content revisions describe inputs; they are neither permanent IDs nor repository history. Save-conflict versions remain independent of preview revisions.

The lifecycle phase is `unknown`, `preparing`, `ready`, `error`, `paused`, or `disposed`. Freshness is separate: `current` matches the latest observed source inputs, `stale` retains older output, `unknown` lacks source evidence, and `empty` has no acknowledged output. A failure can retain working output or clear it, according to the renderer. Readiness requires matching source and displayed inputs. It does not imply successful backend requests or complete nested embeds.

Views and file-backed Markdown use compiled-input evidence in development. The revision endpoint hashes the artifact, its local Vite dependency graph, the shared stylesheet, and registered theme inputs. Relative CSS imports join that inventory. Each evaluated module records the exact source input used in its transformation. Shared stylesheet evaluation also records its theme inputs. Matching records and a renderer commit are both required. Dependency-only changes can therefore make output stale even when the artifact hash is unchanged.

This evidence covers local source and styles. Runtime-fetched data, remote assets, browser storage, layout dimensions, and interaction state are separate. Imported local assets without compiled evidence remain unverified. Limits, unavailable inputs, or a missing acknowledgement produce `unknown`, never fabricated readiness. Waiting for compilation evidence is bounded. Published compiled previews report `unknown` because they have no live repository comparison; rendering and error handling still work. Instrumentation and the revision endpoint are development-only.

Mermaid source renders through Pele's lazy entry point with the same lifecycle controller. Inputs include source, measured font families, intrinsic content width, color mode, and invalidation revision. It acknowledges a successful SVG after DOM insertion. New source, font, size, or theme input invalidates older attempts. Font readiness precedes measurement, hidden zero-width hosts wait for reveal, and listeners/observers are disposed on unmount. A 15-second asynchronous watchdog reports an unverified diagram and ignores late completion; it cannot interrupt synchronous parsing/layout/SVG generation. Explicit source, edge, and output limits bound input size, not CPU time. Markdown's own acknowledgement does not acknowledge the independent diagrams or view embeds inside it. Canvas scene saving keeps its existing version/conflict model; each live view or diagram on the canvas owns its preview lifecycle.

### Updates and recovery

Existing file notifications, loader caches, and the serialized route refresh queue remain authoritative. Lifecycle observation does not introduce another file watcher, agent runtime, or write path. Source reads ignore superseded responses and reread after save completion. Unsaved edits retain their conflict choice and server-side version protection.

A source notification invalidates readiness. An old cached component can remain visible through a failed compilation, but cannot acknowledge new source. Compilation failures stay latched until matching repaired inputs commit. Render failures clear the affected output. Missing or incomplete files remain repairable through source mode. Preparation deadlines produce an actionable unknown state. Existing Vite diagnostics remain available during local compilation failures.

Renderers cancel superseded asynchronous work logically. The child bridge additionally validates artifact, session, and document identity, and orders lifecycle messages by an independent monotonic sequence. This allows a source move to replace its controller without confusing a reset attempt count with stale transport. Disposal cancels pending observations and releases listeners and deadlines.

### State and lifetime

| Situation | Policy |
| --- | --- |
| Ordinary React edit | Preserve interaction state when Fast Refresh can preserve the component. Hook signature changes or incompatible exports may reset it. Revision observation does not force a remount. |
| Color mode or source toggle | Keep the page runtime and state. A hidden source-mode preview is inert and continues HMR. |
| Another view in the same prototype | Keep the child document; replace the selected component and its lifecycle controller. Component-local state does not transfer between artifacts. |
| Another prototype or document reload | Dispose the previous runtime and create a fresh session/document. |
| Offscreen canvas embed | Keep retained embeds mounted and receiving updates within the canvas budget. Hiding is not a lifecycle pause. |
| Canvas eviction, removal, or page departure | Dispose the embed and its lifecycle. Returning creates a fresh preview; its interaction state is not durable. |
| Explicit adapter pause | Invalidate pending preparation, retain displayed output, and require fresh preparation after resume. Current page and canvas adapters do not use pause. |

[Canvas hosting](../../modules/canvas/README.md#shared-artifact-host) owns admission and retention. Lifecycle information does not create another scheduling policy.

### Integration and inspection

`lifecycleAttributes` exposes the same `data-artifact-*` phase, freshness, source/input/displayed revisions, and commit count across renderer boundaries. React previews retain their `data-preview-*` attributes and validated `studio:preview-state` event. Their new bubbling `studio:artifact-lifecycle` event includes artifact identity, session, runtime, surface, and lifecycle state. Non-iframe readers expose their own identity and revision attributes.

Lifecycle evidence does not provide component/prop/token mapping, write authorization, or cross-harness DOM access.

Agent activity is nullable and independent. Only an explicit integration supplies a named provider and `idle` or `working` state. File/build/render changes never infer activity. Current adapters supply no provider; chat and progress remain in the coding harness.

## Source ownership

Each module maps its navigation items to real files and supplies file access and permissions. Prototype ownership, system context constraints, and platform file allowlists continue to apply. Contributors edit their own prototypes. Assigned maintainers edit their active systems. Admins edit platform, module, and Studio sources and manage all prototypes. The server rechecks current grants and archive status on each write. System identity and availability fields use managed system actions so references and dependent prototypes stay consistent. The editor does not grant permission or infer a prototype from a platform document.

Manual chapters and owner README documents have separate source files. Each reader edits its own complete Markdown document. Systems components expose Page, Examples, and Component file tabs. Systems overview and icon pages expose their overview source; generated theme pages expose their theme CSS. A system without an overview source exposes its declaration instead. Skills expose a file picker for `SKILL.md` and supporting files, preserving the skill’s directory structure.

## Implementation

- `src/platform/core/source/SourceEditor.tsx`: shared CodeMirror editor, syntax selection, save state, route blocking, and external-change handling. Its `SourceAccess` contract supplies a repository path, read/write callbacks, and editability.
- `src/platform/core/source/useSourceView.ts`: shared source URL state (`?mode=source`), keyboard toggle, and return focus.
- `src/platform/core/source/sourceTheme.ts`, `markdownSource.ts`, `mermaidSource.ts`: shared Flexoki highlighting, including Mermaid fences in Markdown. CSS theme files also receive syntax highlighting.
- `src/platform/app/source/ArtifactSource.tsx`: prototype and system context access adapter.
- `src/platform/app/shell/FileNavItem.tsx` and `FileActionItems.tsx`: file-backed navigation and common actions. File trees use the same actions with their own structure.
- `src/platform/node/build/files/source.js`: versioned, size-limited access to explicitly allowlisted Documentation and Systems files. Prototype and system context access retain their existing file policies.

File-backed navigation shares `FileTree` and `FileError` from `#studio/ui`. Owners supply explicit creation, permission, movement, ordering, and bundle policies. Prototypes owns artifact creation; Systems owns context and skill rules. The shared tree contains neither Systems creation handlers nor skill format assumptions. Server authorization remains mandatory.
