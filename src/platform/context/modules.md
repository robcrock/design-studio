---
title: "Modules and extensions"
---

A module is a folder with a `module.ts` declaration. The platform discovers declarations without a separate registry.

## Conventions

A module can be added, turned off, and removed without breaking the studio. Each rule names what holds it.

1. **Everything a module adds lives in its folder**, apart from its `studio.config.json` line and declared packages. *Import and boundary checks.*
2. **Off never breaks the studio.** With any optional module off or removed, the studio builds, runs, and publishes. *The release suite builds with every optional module disabled, then removed.*
3. **Content survives.** Turning a module off keeps everything made with it; turning it on restores it. Only `remove --content` deletes content. *Release suite lifecycle tests.*
4. **A library works while its module is off.** Code that imports `@module/<id>` gets `lib/off.ts(x)` while the module is off: the same exports, with no Studio behavior. Without an off entry, turning the module off is refused while code imports it. *Settings and the CLI refuse; checks and the build accept only `index` or `off`.*
5. **A library can always be taken out.** `detach.ts` rewrites a file's use of the library into plain code; removal runs it on every file that uses the library, all or nothing. Without one, removal is refused while code imports it. *`pnpm studio remove`.*
6. **Starter examples may use optional modules**, because rules 4 and 5 keep turning them off and removing them safe. *The release suite.*
7. **Published sites get only what viewers need.** Editing tools stay local (`localOnly`, local-preview-only panels); libraries still return plain values. *Module contracts.*
8. **Everything is declared.** Modules declare `optional`, `lib`, `requires`, and dependencies; a studio declares every installed module `true` or `false`. A missing declaration is an error. *Configuration and declaration validation.*

Modules are found in two roots, listed once (supplied first) in `src/platform/core/roots.ts`: `src/platform/modules/<id>/` holds the modules the starter ships, and `<module folder>/` holds the team's own. A module's ID is its folder name in either root, so an ID can exist in only one: a team module must not reuse a supplied module's ID, and `pnpm check` and the build reject it. Creating a module (`pnpm studio create-module`) and adding one from a source write only to `src/modules/`. Enable, disable, removal, and the rules between modules work the same in either root. Supplied modules ship in the same release as the platform, so they may import platform internals; team modules use the [public API](#public-api).

Modules are copied into the repository. They are not downloaded or loaded as plugins at runtime.

## Ownership and dependencies

Keep a feature's implementation inside its module. Optional modules must support disabling and removal in their supported configurations. Contributors & Permissions is optional for personal use and required for team use. Configuration validation rejects team use without it.

Instruction-link validation uses the installed module directories. Links into a removed module owner are unavailable and excluded from the graph. Missing files within an installed owner remain errors, including when that module is disabled. Platform and system links remain checked.

Prototypes, Views, Text files, and Systems are required. Platform code and modules may depend on required modules.

A module cannot import another optional module's implementation. Outside code can read an optional module's declaration or its enabled public library entry.

Prototypes access public libraries through `@module/<id>`. They cannot import private platform paths. Runtime library code has its own dependency checks.

Views offers the renderer-free `emptyView` sentinel through `@module/view`; its [empty-view contract](../modules/view/README.md#empty-views) owns creation and rendering behavior.

Every module declares `requires`, the oldest platform version it works with. Read each module's declaration for its requirement. A module without one fails validation. An incompatible module is disabled and reported by checks.

## Public API

Team modules (`src/modules/<id>/`) and team systems (`src/systems/<id>/`) import platform code only through the public API in `src/platform/api/`, one file per entry. The root `package.json` maps `#studio/*` to those files through its `imports` field, so one specifier works in browser code, Node-loaded files such as `type.ts`, `server.ts`, and `check.ts`, and a system's `system.ts`.

| Entry | Use it for | Executable environment |
| --- | --- | --- |
| `#studio/module` | Module declarations, server/check/build contracts, `PLATFORM_VERSION`, resolved `StudioConfig`, and the shared `adminProblems` validator. | Application and Node. |
| `#studio/systems` | Registered system queries, source paths, permanent system navigation, and shared theme scope. | Application. |
| `#studio/system` | `SystemSpec`, `SystemLibrary`, `SystemIntro`, and the types inside them. | Types anywhere. |
| `#studio/files` | File-type declarations, capabilities, generic identity, Markdown declarations, and permanent resource IDs and prototype/artifact/system addresses. | Application and Node. |
| `#studio/data` | Reading content in the app: the manifest, `contribution<Data>`, the studio identity (`APP_NAME`, `TAGLINE`, read-only `CONFIG`), a prototype's files, the current contributor and edit permissions, `callModule`, structured `ClientError` failures, lazy build assets, and what a file type's `loader.ts` and `open.tsx` implement. | Application. |
| `#studio/ui` | Browser app contributions, section navigation, home blocks, collections, documents, source editing, shared Mermaid rendering, artifact hosting, file navigation with owner policies, copyable file errors, and the authorized `useStudioSettings` client. | Application. |
| `#studio/components` | Studio's interface components, such as `Button`, `Dialog`, `Input`, `Tooltip`, menus, and `toast`. | Application. |
| `#studio/preferences` | Authorized, versioned reads and writes of declared contributor module namespaces. | Node only. |
| `#studio/references` | Node source adapters, resolution context types and shared code, Markdown and CSS source grammars. | Node only. |
| `#studio/lifecycle` | Renderer-neutral source, preparation and displayed revision state, input digests and DOM evidence. | Application and Node. |
| `#studio/runtime` | `cn`, `PortalContext`, `usePortalContainer`, and `useColorMode` for shared class names, themed overlays, and the current color mode. | Application and runtime. |

Permanent address helpers validate ID-based public addresses; they do not resolve filesystem locations or legacy module-content addresses. `compiledLifecycle` is browser-specific and belongs to `#studio/data`; renderer-neutral revision primitives remain in Node-safe `#studio/lifecycle`.

`#studio/data` also provides typed prototype and generic file mutations, file-tree observation, local editor/reveal commands, and fidelity writes. Mutation clients serialize this tab's writes, apply checked successful manifests, and schedule application refresh. Receipts include identities and source locations for caller-owned navigation. Do not apply returned manifests manually; `setManifest` stays private. Failed replies do not change the inventory. `SourceChanged` remains a distinct client error with code `source_changed` and status 409.

### Environment policy

`API_POLICY` in `src/platform/core/modules/boundaries.ts` is the single inventory of entries and executable environments:

- **Application:** Studio's browser contributions and system overviews.
- **Node:** module declarations, `type.ts`, `server.ts`, `check.ts`, `build.ts`, `references.ts`, `cli.ts`, module `node/` helpers, and system declarations.
- **Runtime:** prototype code, system components and libraries, shared utilities, and public module libraries. Existing runtime scopes still apply. `#studio/runtime` is the narrow executable entry for these consumers; application services and Node tooling remain unavailable.

Explicit type-only imports and re-exports from public entries are available in every environment. They do not load the implementation. Private imports remain invalid even when they import only types.

`pnpm check` and the development/production import guard use the same environment service in `src/platform/node/lib/api-environments.js`. It follows executable literal imports, re-exports, and `require` through repository helpers in the caller's environment. Moving a browser import into a helper does not make it Node-safe. Helpers outside a team folder cannot bypass the public boundary. Node and runtime graphs reject computed imports; supplied application loaders retain their compiled-glob behavior. The platform’s bounded installed-module loader may load discovered `module.ts` files, whose executable graphs are checked independently as Node entries. Installed declarations are synchronous Node specifications; source or helper changes require a process restart.

Every public entry's executable graph is checked in each declared environment. Node graphs reject browser globals, renderer imports, JSX, browser application code, and Vite browser features. Application and runtime graphs reject Node built-ins and platform Node tooling. Runtime graphs cannot reach the Studio shell. Erased type dependencies are excluded from this executable graph; existing dependency and module-removal checks still apply to them.

The graph follows repository source, not npm package implementations. Packages remain governed by declared dependencies and runtime scope checks. These checks enforce source contracts, not a security sandbox. A Node import regression also loads every Node-capable public entry in a fresh process.

Artifact hosts and Systems examples provide `PortalContext` with their themed container. System overlays read it through `usePortalContainer()` and pass that element to their portal implementation. Both import `#studio/runtime`, so the provider and consumers use one context instance per document. `useColorMode()` reads `data-color-mode` from the theme boundary around that container, so it follows the system's mode rather than Studio's. `cn` remains a shared runtime dependency; prototypes do not gain permission to import its package directly. The runtime entry must remain independent of shell, settings, manifest, routing, and discovery code.

`src/platform/api/*.ts` defines the public exports. The project is pre-release; review changes against current consumers rather than maintaining a compatibility snapshot.

Importing anything under `src/platform/` from team code by another path, including `src/platform/node/` and Studio's system files, is an error in `pnpm check` and in the development and build import guard. Imports between modules use `@module/<id>` as before. Supplied modules may import platform internals, since they ship with the platform; their imports are not examples of the public API.

Use literal import paths in module code and public libraries so checks can resolve dependencies, including type-only imports. Node discovery tooling may load declared files by their discovered paths. Public module libraries remain subject to the stricter prototype runtime boundary. Like prototypes, they style with CSS Modules, except that a library may import a package's own stylesheet (such as `dialkit/styles.css`), which the package scopes.

If a capability needs a platform service the API does not offer, propose an addition to the public API rather than importing a private file.

`ModuleApp.rail: 'none'` lets a module contribute to Home without adding a navigation destination. It can omit routes and a section when it owns no browsable content.

`ModuleApp.palette` draws a module's groups in the ⌘K palette; `ModuleApp.paletteOrder` sets their place among the other modules' groups (default `order`). The shell hardcodes no module's palette entries.

`ModuleApp.landing(manifest)` (stable) returns where the shared `/documentation` address opens, or `undefined` for the default Context & Skills browser. The Documentation module uses it to open the Manual.

`ModuleSpec.settings` (`{ group, order }`) names the group Studio settings lists the module under (`prototyping`, `systems`, or `team`) and its place in it. A module without one is listed under Other modules.

A module reads its own `build.ts` data with `contribution<Data>(manifest, id)` from `#studio/data`; the manifest has no module-specific fields.

`ModuleApp.navLabel` supplies a shorter navigation label while the declaration retains the full capability name.

`ModuleApp.localOnly: true` restricts a module’s app contributions (rail, routes, home, and search) to local development. Published viewing sites omit them; the module’s source and configuration remain available.

These source contracts are 0.x. Review release guidance when updating them.

## Capability files

| Path | Purpose |
| --- | --- |
| `module.ts` | Identity, compatibility, optional status, section, dependencies, library, and agent instruction declarations. |
| `app.tsx` | Navigation, routes, overview blocks, palette entries, and prototype actions. |
| `type.ts`, `open.tsx`, `loader.ts` | File-type declaration, rendering, and production loading. |
| `references.ts` | Optional retained source-maintenance adapters. See [File types](file-types.md#source-reference-adapters). |
| `server.ts` | Local routes at `POST /__studio/<module>/<route>`. |
| `check.ts` | Module validation while enabled. |
| `build.ts` | Optional manifest contribution while enabled: `manifest({ root, enabled, out })` returns `{ data, errors }`, stored as `manifest.contributions[<id>]` (its printed problems count as manifest errors); `watch` lists folders whose Markdown changes rebuild the manifest in development; `sourceFiles(data, { root })` lists repo-relative files the Documentation surface may edit. Experimental. |
| `lib/index.ts(x)` | Public entry exposed when `lib: true`. |
| `lib/off.ts(x)` | The public entry while the module is off: the same exports with no Studio behavior. |
| `detach.ts` | Node: default export `(source: string) => string` that rewrites one file's use of the library into plain code, run by removal. |
| `context/`, `skills/` | Module-owned knowledge and procedures. |
| `instructions/` in a pack | Optional packaging prefix for declared context and skills, installed into this module. |

Every module declares `optional` and `lib` as booleans. Omission cannot silently determine removability or expose a public library.

A section can declare a content folder, prototype-shaped items, contributor grouping, editing policy, and standalone published views.

The core page key `settings` is reserved. Modules and contributors cannot use it as a section or contributor key.

Use the TypeScript declaration for exact fields. See the [file-type contract](file-types.md) for artifact capability declarations, browser implementations, availability, and module-owned file actions.

Design systems are content in `src/systems/` (and Studio's own interface system in `src/platform/systems/`), not platform modules. Their [contract](../modules/systems/README.md) defines system structure.

## Configuration and commands

`studio.config.json` holds identity, personal or team use, enabled modules, and the default system. Each installed module has an explicit true/false entry, and each of the team's installed systems appears in `systems`; Studio's own system is always available and is never listed. Omitted declarations fail validation. Other customization happens in code.

```sh
pnpm studio list
pnpm studio disable <id>
pnpm studio enable <id>
pnpm studio remove <module-or-system>
pnpm studio create-module <id>
pnpm studio create-system <id>
pnpm studio sync
pnpm check
```

Remove and create commands preview changes. Applying them requires `--yes`. Use CLI help for current arguments.

Studio commands register and unregister capabilities, manage config module flags and module-owned routing in the generated `AGENTS.md`. The [manage-modules skill](../skills/manage-modules/SKILL.md) governs agent execution.

Disabling retains files. A module whose library is imported must ship `lib/off.ts(x)` to be turned off, and `detach.ts` to be removed (see [Conventions](#conventions)); otherwise both are refused while code imports it. Removal deletes the module, including its context and skills, and refreshes project exposure. External content remains unless removal includes `--content`.

Packages remain installed after removal. Remove them only when no retained code uses them.

## Installation contract

Extension installation is ordinary repository work, not a package-manager feature. Review the source, license, dependencies, and affected files before integrating it. Code runs with the privileges of the local repository.

Use `create-module` or `create-system` for a local scaffold, then adapt selected source under the team root. Preserve the newly allocated system `studioId`, package identity, and explicit registration; do not copy another installation's identity or overwrite existing work. Team modules use `#studio/*`; system dependencies live in their own manifest with shared React peers.

Review dependency changes, run `pnpm install --ignore-scripts`, synchronize instructions, and verify `pnpm check`, `pnpm test`, `pnpm build`, and the affected browser workflows. There is no download, archive, license-override, or provenance-lock subsystem. Git records the integrated source and its history.

## Discovery and verification

Node tooling discovers modules in both roots through `src/platform/node/lib/modules.js` (folder helpers in `src/platform/node/lib/module-folders.js`). Browser discovery uses `src/platform/app/data/modules.ts`, whose glob patterns spell both roots. Each registers where a module's folder is (`moduleFolder` in `src/platform/core/roots.ts`), so context, skills, routing links, and build globs find a module in the root that holds it.

The manifest scans declared content sections. Vite supplies file globs and themes. The shell combines module navigation and routes.

`pnpm check` validates declarations, configuration, section collisions, dependency boundaries, file-type contracts, and enabled module checks.

The release suite builds with all optional modules disabled, then physically removed. The ordinary production build covers enabled modules. Lifecycle tests retain Team-mode restrictions, external content, and re-enabling checks.

A module owns one canonical technical contract in its README.md. Human workflows live in `src/platform/modules/documentation/pages/`, where a chapter declares `module: <id>` to follow that capability’s availability. Context includes standing requirements. Skills describe tasks. Link to contracts instead of copying them.

## Customization and updates

Supplied and locally authored modules use the same contract, in different roots. Git records integrated module/system source and the supplied platform revision.

You own all repository code. Editing supplied modules or platform internals can create conflicts when merging upstream releases; [Ownership and updates](ownership.md) maps which paths are upstream, generated, seed, or team-owned. Review updates on a branch, reconcile local changes, and run `pnpm build`. The [customization Manual](/documentation/manual/customize) explains the progression from prototype work to platform changes.

Modules can declare primitive preference schemas and defaults; see [Contributor preferences](contributor-preferences.md) for registration, validation, transactions, and reviewed initialization. `#studio/preferences` is Node-only.

`optimizeDependencies` lists at most 32 unique package roots from the module’s `dependencies`. Vite combines enabled, compatible declarations with shared editor dependencies before first use. Disabled or removed modules contribute nothing. Subpaths and arbitrary Vite configuration are unsupported.

`ModuleBuild.assets` contributes named lazy JSON assets through the [shared asset protocol](build-assets.md). Browser consumers use `loadModuleAsset` and `subscribeModuleAsset` from `#studio/data`.

`#studio/systems` exposes [application system services](system-services.md). Use these queries and `ThemeScope` for application rendering; the singular `#studio/system` remains declaration types.
