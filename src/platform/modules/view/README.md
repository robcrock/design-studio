# Views

The required Views module opens `.tsx` and `.jsx` artifacts as actual React components. Each view exports a component as its default export. Underscore helpers are excluded from navigation.

The loader inventories prototype roots and registered module sections. Capabilities follow the shared [file-type contract](../../context/file-types.md). Assignments and source dependencies follow [Prototypes](../prototypes/README.md).

`references.ts` owns reference maintenance for JavaScript, TypeScript, and supporting CSS. The Node-only adapter API supplies target resolution while this module selects code and stylesheet syntax. Views declare `systemUsage: 'assigned'`; a missing assigned system blocks rendering and embeds while source remains available locally.

## Empty views

`identity.ts` owns the leading-comment identity grammar used by `type.ts`. The platform's generic identity tooling consumes that declaration; it does not name View's adapter.

The public runtime entry `@module/view` exports only `emptyView` (experimental). It has no renderer, shell, discovery, or system dependencies. New views export this sentinel as their default until a component is implemented. The loader recognizes that exact function; an arbitrary component returning null is not an empty-view declaration.

Prototype creation and file creation both use the View file type's `template`. Creation allocates the artifact identity separately. There is no second prototype view scaffold. Implementing a view replaces the sentinel import and default export while retaining its identity comment.

The View host owns empty-state presentation in the preview document. Development shows the source path and copyable agent prompt; production shows the empty-state explanation without local source controls. Hosts and authored views resolve the same library entry, so sentinel identity survives bundling. The old `src/lib/emptyView.ts` path is removed.

Empty declarations join the existing incomplete-view recovery path in development. A loader update discards those cached descriptors before reloading them. Unrelated mounted views retain their descriptors and state. This lets an implemented component replace the empty state without changing the artifact's identity or resetting the preview document.

## Preview boundary

Studio loads an artifact descriptor. It does not import or render the prototype component in its document. `ViewFrame` and `ViewEmbed` use `preview/PreviewHost.tsx`; the iframe bootstraps `preview/main.tsx` and loads the real view through `loadView`. `PreviewSurface` owns assigned-system themes, lo-fi mode, navigation scope, portals, and React error containment.

The child uses the published `index.html` entry with validated `studio-preview=1`, session, and configuration parameters. This works with the same Vite development server and static base path as Studio, without another HTML deployment entry. The platform entry chooses the runtime before importing Studio's router. Preserve this separation.

Before stylesheets and modules load, a synchronous head bootstrap applies Studio's saved color mode, or its system fallback, on ordinary pages. Preview documents use their explicitly configured mode instead. This lets page previews receive the correct mode from their first render. The browser's `Canvas` color fills the initial document until Studio background tokens load. Assigned-system surfaces still resolve through `ThemeScope`. The preview bootstrap reads only a boolean appearance hint; the preview runtime remains responsible for validating the full configuration. This does not delay or animate the reveal of embedded views.

A page runtime persists between views of the same prototype. It retains the outgoing screen, inert, while the next view loads. The next prepared view replaces it without a loading-label flash; slow handoffs show status after 200 ms. Retained output cannot acknowledge the incoming artifact. Child attributes distinguish displayed and pending identities. Changing prototype identity tears down the document and creates a new session. Color-mode updates preserve the runtime and component state. Source editing retains an already-open page runtime in a hidden, inert host container; HMR continues there. Directly opening source mode does not require a working preview.

Embeds have their own child documents. They lay out at a screen width (`EmbedProps.viewport` from a canvas, otherwise the prototype's default screen, the first of its system's `screens`), scale and crop to their supplied dimensions, exclude focus and pointer interaction, and set the child root inert. They cannot request host navigation or shortcuts. Invalid or zero dimensions do not mount a runtime.

### Still embeds

An embed configured `still` holds its motion one second after it renders, so it stays on screen as a still picture and costs nothing while untouched. Views share Studio's main thread, and a few looping views otherwise keep a canvas busy every frame. `preview/still.ts` wraps the child window's animation frames and timers: while held, frame and timeout callbacks wait, interval ticks are skipped, and running animations and media pause. Configuring the embed as not still, a file or manifest change, or a hot update releases everything that waited, and a still embed holds again after it settles. The runtime schedules its own work with the native timers. Pages are never still. Canvas makes every view still except the one selected item; documents keep embeds moving.

## Communication and authority

`preview/protocol.ts` defines version 2 of the `studio-preview` channel:

| Direction | Message | Purpose |
| --- | --- | --- |
| Host → child | configure | Explicit artifact target, public href, color mode, immutable page/embed surface, and whether an embed is still |
| Child → host | hello | Same-session bootstrap/reload handshake; host supplies its current target |
| Child → host | lifecycle | Source, preparation and displayed revisions; monotonic sequence and bounded lifecycle payload |
| Child → host | status | Loading, successful render commit, or error; bounded detail and render-attempt counter |
| Child → host | navigate | Same-origin Studio address and replace/push intent |
| Child → host | shortcut | Eligible source/grid/search/navigation shortcut, forwarded to existing host handlers |

Both sides validate sender window, exact origin, version, session, fresh child-document runtime identity, message kind, and payload fields. Host status/navigation/shortcut messages must match the currently selected artifact identity. Only hello can announce an earlier bootstrap identity after a same-session runtime reload. Configuration identity must match its target; the surface and prototype scope cannot change during a session. Stale document and render-attempt notifications are ignored. Hidden source-mode previews cannot request navigation or shortcuts.

Targets use permanent prototype/artifact IDs when available, resolved against the current manifest. Registered section artifacts without IDs use explicit owner/path selectors. Source paths locate imports; they do not grant authority. There are no file-write, arbitrary execution, or inspection commands in this protocol.

After validation, status emits a bubbling `studio:preview-state` event from the host boundary with `session`, `runtime`, `identity`, `surface`, `state`, and `render`. Boundary data attributes expose current state, identity, and session for native inspection. In the preview document, `data-preview-surface` (`page` or `embed`) and `data-preview-target` (the configured target as JSON) on the root element tell code running there where it is; DialKit reads them to show its panel only on pages. The separate lifecycle event and shared revision attributes support revision-aware inspection. The counter identifies runtime load attempts, **not** a source revision or a source-to-component map. Lifecycle reports follow the [artifact revision contract](../../context/maintainers/source.md#artifact-revision-and-preview-lifecycle). Future protocol extensions must add explicit validation and retain independent write authorization.

The host supplies its public history address, including the deployment basepath. The child memory router supplies normal TanStack hooks to prototypes. Page navigation is handed to Studio so its history, artifact selection, source mode, and outer routes remain authoritative. Relative native links resolve against the displayed artifact address, including modified clicks. Hash anchors stay within the child document. External HTTP(S) links open separately. The direct runtime can navigate React artifacts independently and returns to Studio for other surfaces; crossing prototypes starts a fresh document. Direct-preview navigation supports browser Back/Forward. Public prototype navigation APIs remain unchanged.

## Isolation limits

The iframe is same-origin and has no sandbox attribute. This is a trusted local repository execution boundary: separate document/CSS, viewport/focus APIs, module instances, and per-preview overlays. It is **not a hostile-code sandbox**. Scripts can access their parent, shared same-origin storage, and local server endpoints. CPU/process isolation and build/dependency isolation are separate concerns. Retain dependency/style checks and existing contributor/server authorization.

A stronger security boundary for untrusted code requires a separate origin, asset/CORS and network/server policy, and harness verification. Adding allow-scripts plus allow-same-origin would not establish that protection. See [MDN's iframe reference](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe).

## Development, inspection, and recovery

Preview shortcuts preserve Studio search and navigation as well as source/grid commands. Text inputs and contenteditable regions retain their keystrokes. Source/grid/navigation keep the shell’s capture behavior. Prototype handlers can consume search before forwarding.

Each child receives Vite HMR and manifest/file-loader notifications. Pending loads are cancelled logically so stale responses cannot replace the current artifact. Ordinary component updates preserve state when Fast Refresh supports the edit; missing/incomplete files and source repair use the existing loader and error handling.

Native browser tooling can inspect and interact with real elements inside a page iframe. Codex's in-app browser is verified; Cursor, ChatGPT, and other harnesses require their own browser-tool checks. DOM access does not establish component/props inspection.

The direct runtime remains available to harness tooling through `previewUrl` in `preview/protocol.ts`. An agent can open a page preview’s iframe `src` in a separate tab when nested inspection is unavailable. This starts a fresh runtime using actual source and assignment. It does not copy interaction state. Studio does not expose this capability in menus or recovery links. An unresponsive page preview shows a notice after a bounded wait. Embeds remain inert even when a harness can inspect their DOM.

React render errors stay in the preview's error UI. Loading failures show an actionable error in the child, preserving Studio's source editor. Uncaught errors and rejected promises report error state; they do not automatically replace the component or recover exhausted CPU resources.

## Boundary decision

Use an independently bootstrapped child React runtime in a same-origin iframe for trusted repository code.

| Option | Trade-off |
| --- | --- |
| Keep rendering in Studio's document | Simple coordination, but document styles and browser globals remain shared. |
| Portal parent-loaded React into an iframe | Separate DOM placement, but components still execute against Studio's window and document. |
| Bootstrap React inside the iframe | Components use the preview's own document, viewport and focus APIs. Requires explicit configuration, navigation and status messages. |

The comparison used actual Product and Marketing prototypes. At a 420px frame, the portal's JavaScript measured the 1280px host. The child runtime measured its 418px content viewport. Document-level style and focus probes likewise favored child execution. Both candidates supported real components and live source updates. Production verification is recorded in [PR #22](https://github.com/itspatmorgan/design-studio-starter/pull/22).

Keep the [isolation limits](#isolation-limits) explicit. A failed opaque-origin whole-Studio experiment does not establish that an artifact-only opaque runtime is impossible.

[OpenDesign's FileViewer](https://github.com/nexu-io/open-design/blob/802708f6c9f294347ef777b1fda49b9cbe26ef72/apps/web/src/components/FileViewer.tsx) and [preview document construction](https://github.com/nexu-io/open-design/blob/802708f6c9f294347ef777b1fda49b9cbe26ef72/apps/web/src/runtime/srcdoc.ts) informed execution separation. [Open CoDesign's source-editing contract](https://github.com/OpenCoworkAI/open-codesign/blob/main/SOURCE_EDITING.md) informed preview identity and independent write authority. Their generated HTML and security assumptions are not copied into Studio. [TanStack memory history](https://tanstack.com/router/latest/docs/guide/history-types) supplies independent navigation.

## Revision evidence

Page previews and inert embeds use the same lifecycle adapter. A renderer commit acknowledges source only when the compiled local inputs match the observed revision. Compilation failure can retain the previous preview, explicitly stale; render failure clears it. A bounded unverified update produces an actionable unknown state. Modules a view loads after its commit (an `import()` in an effect) are acknowledged when they arrive; the tracker checks again until its deadline. A page preview shows the plain out-of-date notice only once it has lasted a second, so an ordinary save that applies at once never flashes it; errors and unverified updates show immediately. Successful recovery clears the notice without forcing a document remount.

The [shared lifecycle contract](../../context/maintainers/source.md#artifact-revision-and-preview-lifecycle) defines input coverage, static-preview limits, optional activity, message ordering, and state/lifetime policy. The status counter describes load attempts. It never stands in for source freshness. The child controller is also replaced when an identified artifact's source location changes.

View loads its assigned theme through the public [application system services](../../context/system-services.md). Its child preview entry remains supplied-only.
