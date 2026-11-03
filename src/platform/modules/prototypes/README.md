# Prototype contract

Application mutations use the public `#studio/data` clients. They own successful manifest application and refresh; UI callers own navigation and notices. Create, copy, and rename receipts contain permanent IDs and current source locations. File-operation receipts include an artifact ID when the resulting path is an artifact. Systems owns system-source and creation routes.

This reference owns prototype files, metadata, links, dependency boundaries, and deployment status. Agent operating behavior belongs in the [build-prototype skill](skills/build-prototype/SKILL.md).

## Artifacts and files

An artifact is a navigable piece of prototype work backed by a file: a view, document, diagram, or canvas. Its owning file-type module determines how it opens and previews. This names the existing openable-file model; it adds no registration or separate storage.


A prototype lives at `src/prototypes/<contributor>/<id>/` and requires `meta.json`.

Views are `.tsx` or `.jsx` files with a default-exported React component. New views use `.tsx`. Plain `.jsx` is not type-checked.

Folders organize files at any depth. A file or folder starting with `_` is a helper. Helper contents do not become navigation artifacts.

Enabled file types determine other artifacts. Documents and canvases require their respective modules. Assets remain ordinary files. Follow the [static asset convention](../../context/assets.md) for their ownership, locations, and imports.

Artifact IDs are unique across retained resources. Source navigation paths must also be unambiguous: `main.tsx` and `main.md` cannot share the same extensionless path in one folder.

Create artifacts through Studio’s file operations or preserve the declared ID while editing an existing file. For directly authored new files, preview `pnpm studio identify <prototype-folder> --json`, then apply with `--yes`. It assigns only missing IDs within that owner’s prototype; it does not replace existing IDs. Builds reject unidentified artifacts, including retained disabled types.

## Metadata

For agent inspection, run `pnpm studio context src/prototypes/<contributor>/<prototype> --json`. It reports assignment, pending rebuild, contributor scope, enabled modules, and system entry paths without writing files. Assignment validation is shared with the manifest; inspect artifact content and relevant guidance separately.

| Field | Contract |
| --- | --- |
| `formatVersion` | Required version of the `meta.json` format, `1` ([Format versions](../../context/formats.md)). Creation writes it; a missing or unknown value skips the prototype with an error naming the file. |
| `studioId` | Permanent prototype identity, allocated on creation and retained through rename, move, archive, and restore. |
| `ownerContributorId` | Permanent contributor identity matching the contributor folder. Moving files cannot silently change ownership. |
| `title` | Required display title. |
| `created` | Optional `YYYY-MM-DD` date. Creation fills it in. |
| `systemId` | Required installed prototype-system identity, or `null` for no system (custom styling). Creation writes the selected value. Missing assignments fail validation; changing the default affects future prototypes. |
| `rebuild` | Optional pending migration: `targetSystemId` is an installed ID or `null`; `sourcePrototypeId` is the original prototype’s permanent ID. Current `systemId` remains the runtime boundary until migration. |
| `order` | Relative file and folder paths placed first within their folder, in sequence. |
| `archivedBySystemId` | System ID that archived this prototype; used to offer restoration only for work archived together. |
| `systemMissing` | `{ systemId, label }` for a deleted assigned system. Preserve source and assignment. System-consuming views and publication wait for a rebuild; independent artifacts remain readable locally. Remove this field after migrating code and assignment together. |
| `status` | `active` or `archived`. Omission means active. |

Remaining artifacts sort alphabetically, files before folders. Use `order` to reorder, rather than renaming files.

Moving, renaming, or deleting an artifact must update its `order` entries. The app performs these updates for its own operations.

Invalid metadata skips the prototype with a local warning and fails the production build.

The prototype is the ownership and organization container. Its assigned system supplies product context and a runtime toolkit. Each file type explicitly declares whether it consumes that toolkit; see [artifact system dependencies](../../context/file-types.md#prototype-and-system-dependencies). Documents, diagrams and canvas scenes remain independently readable, while embedded views resolve their own availability. Source repair never requires a runnable system.

With `systemId: null`, views start from browser colors and a system font, without registered system tokens or components. Use local components, CSS Modules, shared utilities, and React. System imports remain outside this prototype's runtime boundary. Layout utilities without system tokens remain available; style colors, typography, and spacing in local CSS. This is distinct from an invalid system ID, which fails validation.

`pnpm new "Prototype Name"` assigns the studio default. Use `--system <source-key>` to choose another installed prototype system, or `--no-system` for custom styling.

The first available artifact in navigation order opens by default, including artifacts inside folders. Helpers and disabled file types are excluded. An empty prototype shows an empty state.

Contributor details come from `contributors/<key>.json`.

Gallery cards prefer the contributor's optional `avatar`, a relative image path inside `public/`, and otherwise use their registered `github` username to load a profile photo. Public avatar paths respect the site's base path and work offline. Initials appear while an image loads or if no image is available. GitHub photo loading is optional and requires no authentication. [Studio configuration](../../context/config.md#local-roles-and-contributors) owns profile validation.

Deleting a prototype moves its folder to the Trash and shows a confirmation toast. From the Prototypes index, deletion preserves the current page and filters. From an open prototype, it returns to the Prototypes index.

## Links and renaming

`/prototypes/<prototype-id>` redirects to the first available artifact’s permanent address in navigation order, replacing the entry in browser history. An empty prototype remains at its prototype address. `/prototypes/<prototype-id>/artifacts/<artifact-id>` opens a specific artifact within that prototype. Source mode uses `?mode=source`. IDs come from source metadata described in [Resource identity](../../context/resource-identity.md). There are no readable-route compatibility aliases.

Navigation names and hierarchy remain a reflection of the files and folders. They are independent of the public URL.

Changing the title in the app also renames the prototype folder to its slug. Direct title changes should do the same unless requested otherwise.

Renaming preserves permanent shared URLs and all resource IDs. Relative document links survive a prototype-folder rename. File moves still affect source dependencies; permanent routes do not replace reference repair.

The app repairs internal references when files or folders are renamed or moved: local literal imports and exports, literal view navigation paths, Markdown link destinations, and canvas element links. Moving a source file also rebases its relative references. Prototype renaming retains permanent browser links. Duplication remaps copied permanent links to fresh prototype and artifact IDs. Both preserve applicable filesystem reference repair.

These transformations are supplied by installed [source reference adapters](../../context/file-types.md#source-reference-adapters). Supporting CSS URLs and imports participate too. New formats supply an adapter rather than requiring central file-operation branches.

File moves publish the completed inventory and follow the open artifact once. Exact move and relinking writes suppress stale Vite module entries that would reload the document. Retained refresh boundaries update in place. Other rewritten artifacts refresh through their loader, and subsequent code edits retain normal HMR. The loader keeps cached modules for unchanged files when its inventory changes. Reordering keeps the currently displayed index artifact and its navigation selection, while changing the opening artifact for the next visit. A brief toast confirms when references were updated.

While the dev server is running, the same repair follows unambiguous filesystem renames in prototypes owned by the current contributor or maintained section items. It recognizes unique filesystem identities; copies, deleted targets, cross-prototype moves, and ambiguous replacements are not guessed. The currently open artifact follows a detected move. Repairs never change another prototype or an external URL.

Moves made while the server is stopped, dynamically assembled paths, and incoming links from other prototypes still need an agent to update and verify them. Keep the server running while organizing files when automatic repair is wanted.

Navigate with the public `@module/prototypes` library, never by importing TanStack Router. `Link` (`<Link to="app/main">`) and `useNavigate` (`const navigate = useNavigate(); navigate('app/main')`) take a prototype-relative path such as `app/main` and go to its permanent URL; a target that starts with `/` is used as given. `usePrototypeArtifactHref` returns the URL for a path when you need the string, and `useIsPrototypeArtifact` tells whether a path is the file being shown. These are available in rendered views and their embeds. Source paths remain subject to the existing literal-path repair; do not construct them dynamically if automatic repair is needed.

## Duplication and system rebuilds

The local **Duplicate** action is available for your own personal prototypes and for Admins managing another contributor’s prototypes. The copy stays in the original contributor’s folder. It gives the prototype and each navigable artifact a fresh ID, remaps copied permanent references inside that copy, copies files into a new folder, resets the creation date, makes an archived source's copy active, and rewrites self-address links in Markdown and canvas files. Relative imports and links stay local to the copy. Symbolic links are rejected; Git metadata, node_modules, and trash folders are excluded.

A different selected system records the target system ID in `rebuild.targetSystemId` and the original prototype ID in `rebuild.sourcePrototypeId`. Agent inspection resolves the current source path. It retains the source's explicit `systemId` so its copied implementation can still run. The confirmation explains that reconstruction is required. The sidebar supplies a copyable agent prompt; there is no automatic agent dispatch.

To finish, migrate code and the `systemId` value together, verify the build and rendered artifacts, then remove `rebuild`. Pending targets prevent removing that system through the studio CLI. Assignment has no in-place switching action in the app; direct code owners can still change metadata while migrating their implementation.

## Lo-fi mode

An opening `/** @lofi */` comment draws that view in grayscale with handwritten type. Its components and behavior remain unchanged.

Remove the comment for normal appearance. A folder named `lofi` has no special behavior. Local wireframes can also use custom components without this mode.

## Dependency boundaries

Prototype runtime code may depend on its own files, its assigned system's runtime components, assets, and declared library entries, `#studio/runtime`, independent shared utilities, React and React DOM (the only packages Studio supplies to every prototype), and enabled public module libraries. Icons and other libraries come from the assigned system's declared library entries, and navigation from `@module/prototypes`. A direct import of `lucide-react`, `@tanstack/react-router`, or any other package is an error in `pnpm check` and the development and build import guard. System documentation adapters are outside runtime code.

Public module libraries are accessed through `@module/<id>` only. Private platform implementation, another prototype, and another system are outside this boundary. An enabled module must declare a public library before it can be reused this way.

These requirements apply to indirect and type-only dependencies. Dynamic imports use literal paths so checks can resolve them. Shared utilities cannot depend on prototypes, systems, or private platform code. Shared runtime helpers use `#studio/runtime`; `@/lib/utils` and `@/lib/portal` are obsolete. External package access follows [System libraries and dependencies](../systems/context/libraries.md); installed root packages are not automatically available.

Prototype styles use Tailwind classes or CSS Modules with local selectors. Plain CSS imports, `:global`, and CSS `@import` are not supported in prototype code. Assigned system tokens follow the [system styling contract](../systems/README.md#theme).

## Download

While Studio is running locally, **Download** in a prototype's menu builds that prototype into one HTML file. The file includes its navigation, artifacts, and design system, leaves out Studio's editing controls and every other prototype, and opens in a browser. It is not the published site.

## Archiving and deployment

Archiving applies to a whole prototype. `meta.json.status: "archived"` keeps it available locally and excludes it and its files from production discovery and bundling. Omission or `active` restores publication eligibility. Unknown values fail validation.

Archived prototype menus offer only Restore and Delete to their owner or section maintainers. This applies to index cards, list rows, navigation menus, and header context menus. Other contributors see no actions menu. Restore before renaming, duplicating, or using module actions; double-click renaming is unavailable while archived.

Individual artifacts and folders have no separate archival status. Organizing them into a folder does not exclude them from publication. The build warns when active content links to an excluded prototype; a published viewer cannot open that target.

`src/platform/core/archive.ts` defines exclusion, and the manifest and production globs apply it. The [archiving rule](skills/organize-prototype/SKILL.md) owns the agent's choice and verification workflow.

## Validation

Module checks enforce runtime dependency boundaries through `src/platform/node/lib/scope.js` and validate prototype styles. Manifest checks validate metadata and artifact structure. These checks do not enforce every agent operating instruction.

The [build-prototype skill](skills/build-prototype/SKILL.md) requires verification before committing. The [Asset Guard](../../context/assets.md#asset-guard) owns the staged-file size limit.

## Gallery system filter

`/prototypes?system=<id>` filters the gallery by the resolved system assignment. An icon-only **Filters** button alongside search and the view toggle opens a popover with the System selector. A dot indicates an active filter, and the accessible label includes the filter count. Choose **All systems** in the popover to clear it while preserving search. Title and contributor search (`q`) combines with the system filter and preserves it when typing or clearing search. Archived prototypes remain in their separate gallery section; the system overview counts and previews only active prototypes.

## Implementation files

The Prototypes module: the gallery at `/prototypes`, and the viewer every prototype, module artifact and system context section opens in. Required. The prototypes themselves are in `src/prototypes/<person>/<id>/`, which are your content.

- `module.ts`, `app.tsx`: who it is, its rail button, the `/prototypes` route, its front-page block, and its palette entries. A prototype opens through the platform's artifact routes (`src/platform/app/router.tsx`).
- `gallery/`: the gallery, a prototype's card, and the New prototype dialog (browser).
- `viewer/`: a prototype's layout, navigation and file tree, its menus and dialogs (browser). Source editing uses the [shared platform editor](../../context/source.md).
- `src/platform/app/source/ArtifactSource.tsx`: adapts prototype and system context access to the shared editor.
- `node/create.js`: `pnpm new`, and what the New prototype button runs (Node).

Agent contract: `src/platform/modules/prototypes/skills/build-prototype/SKILL.md`.

Navigation uses the platform `FileTree` with Prototypes-owned creation and permission policy. System selection and paths use the public [application system services](../../context/system-services.md).
