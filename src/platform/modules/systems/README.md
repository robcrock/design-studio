# System contract

Systems are discovered from their folders. The team's systems are explicitly registered in the `systems` list of `studio.config.json`, and unregistered folders fail configuration validation. Studio's own system (role `platform`) is always available and is never listed; listing it is an error. A prototype uses an assigned system or explicit no-system styling. Use the [authoring context](context/authoring.md) to select relevant contract sections. [Systems interface](context/interface.md) owns the module’s browsing, editing, and transition behavior.

## Structure

A system lives in a folder named for its id, in one of two system roots, and contains:

| Path | Purpose |
| --- | --- |
| `system.ts` | Label, unique theme class, documentation mode, component sources, and origin. |
| `components/` | Runtime components and their documentation files. |
| `README.md` | Entry point for this system’s context, skills, and toolkit. |
| `AGENTS.md` | Routes agent work to this system’s knowledge. |
| `context/`, `skills/` | System-owned knowledge and agent instructions. |
| `assets/` | Optional system-owned fonts, logos, and images. |
| `styles/theme.css` | Scoped tokens and styles, loaded by the platform. |
| `intro.tsx` | Optional Systems overview page. |
| `components.json` | Optional system-owned shadcn source configuration; consumed through isolated preparation. |
| `package.json` | Prototype-system dependency ownership and shared React peer requirements. |
| `libraries/` | Declared external library entries available to assigned prototypes. |

A team system's `system.ts` and `intro.tsx` import their declaration types, `SystemSpec` and `SystemIntro`, from `#studio/system`. Team systems import platform code only through the [public API](../../context/modules.md#public-api); runtime components use the narrow `#studio/runtime` entry for shared class names and themed portals.

`system.ts`, introductions, examples, and Markdown are documentation adapters. Runtime components and prototypes cannot import these adapters.

`intro.tsx` supplies optional overview content. Its exports and presentation are defined in [Systems interface](context/interface.md#overview).

[System curation](context/curation.md) defines the Overview setup prompt builder, saved decisions, and manual upstream staging procedure.

The two system roots are `src/platform/systems/` (supplied by the upstream project) and `src/systems/` (the team's). They are listed once, supplied root first, in `src/platform/core/roots.ts`; discovery, the build, and the app all read that list. A system's id is its folder name, and the same id cannot appear in both roots. The supplied root holds only the platform system and the platform system lives only there, so the Studio system is `src/platform/systems/studio/` with the same structure as other systems; every team system, including the starter Product and Marketing systems, is in `src/systems/<id>/`. A system's `dir` is the folder it was found in, and every path built for it (components, theme, assets, context, skills) starts from that folder. Creating, renaming, archiving, and removing systems only touch `src/systems/`. Its `system.ts` declares `role: 'platform'`; other systems explicitly declare `role: 'prototype'`. Exactly one installed system must declare that role. Discovery resolves the application system by role, independently of its folder name. It is always registered (the configuration never lists it) and cannot be removed or assigned to prototypes. Its documentation mode is `off`. Every system explicitly declares `status` (`active` or `archived`), `role`, `styling`, `colorModes`, `screens`, `docs`, and `origin`. Platform infrastructure remains under `src/platform/`.

Follow the [static asset convention](../../context/assets.md) for system assets and font loading.

The starter Product and Marketing systems use shadcn/ui on Base UI. Shadcn-based systems own `components.json`; other systems do not need it. Its style and icon choices describe the upstream starting configuration, not every adaptation in the current theme or components. There is no root shadcn configuration. Prototype system folders are private dependency workspaces, but are not standalone shadcn projects. Use the [isolated preparation command](context/curation.md#isolated-shadcn-preparation), which translates configuration for a standalone upstream project. Do not run shadcn initialization or preset application directly against Studio source folders.

`colorModes` declares supported modes: `['light']`, `['dark']`, or `['light', 'dark']`. This field is required; omission fails validation. Declare a single mode explicitly to protect a system that supports only that mode. Empty, duplicate, and unknown modes fail validation.

Studio follows the global mode. Rendered views, their document/canvas embeds, and Systems theme previews and component examples resolve that mode against their system's capabilities. Unsupported global modes use the first supported mode. Documents, diagrams, canvas chrome, and source editors keep Studio's mode.

The shared `ThemeScope` sets `data-color-mode` and CSS `color-scheme` on the system boundary. Pop-ups stay inside it. Dark tokens use `.<theme-class>[data-color-mode="dark"]`; never use an ancestor `.dark` selector for system styles. Code that needs the mode, such as canvas art or a theme hook, reads it with `useColorMode()` from `#studio/runtime` rather than watching `.dark` on `<html>`. Tailwind `dark:` utilities respect a local light boundary. Tailwind systems explicitly declare their theme tokens on the system boundary. Theme and component pages use the selected system's mode, including their background, headings, token tables, and component examples. The shared Overview, navigation, system knowledge, and source editors remain in Studio's scope; optional additional overview content retains the selected system's theme. The Overview’s Toolkit section calls out supported modes using ColorModeSupport, which reads the declaration from system.ts.

`screens` declares the screen widths the system's designs are made for, by the names people use: `[{ name: 'Desktop', width: 1440 }, { name: 'Phone', width: 390 }]`. This field is required; omission fails validation. The first is the default: a view on a canvas or in a document is laid out at its width, so its media queries and layout hooks respond as on that screen. A canvas can show a view at another of its screens, or any width, when someone asks for it. Height is not declared: on a canvas it is the view's box, which crops it. Names are unique and widths are whole pixels from 200 to 4096. A prototype without a system uses the platform system's screens. Product, Studio, and new scaffolds declare Desktop at 1440; the Marketing sample also declares Tablet at 768 and Phone at 390. A system made for phones declares its phone width first.

The starter Product system and new system scaffolds declare both modes. New scaffolds contain an empty theme scope; curation supplies the chosen tokens. For a light-only system such as Sublime, declare `colorModes: ['light']`; for a dark-only system, declare `colorModes: ['dark']`. Its rendered content then keeps that mode regardless of Studio's toggle.

## Runtime boundaries

System runtime code may depend on its own runtime files, independent shared utilities, `#studio/runtime`, its declared package dependencies, shared React runtime, and enabled public module libraries through `@module/<id>`. Other systems, prototype files, private platform implementation, and documentation adapters are outside its runtime boundary. Indirect and type-only dependencies follow the same requirements. Dynamic imports use literal paths. [System libraries and dependencies](context/libraries.md) owns package manifests, public library declarations, installation, and access rules.

Theme selectors and imported stylesheets stay under the system's unique theme class or its descendants. Keyframe names use the theme class followed by a dash. Font-face registration is permitted and follows the [static asset convention](../../context/assets.md#scope-and-fonts).

Pop-ups render within the themed container. Starter Base UI portals import `usePortalContainer` from `#studio/runtime` and pass its result as their `container`. Hosts provide the same entry's `PortalContext`. This preserves system styling and local color-mode behavior.

## Permanent identity and routes

Each installed system declares `studioId` in `system.ts`. Creation and installation allocate it; rename, ordinary updates, archive, and restore retain it. Package source and version remain separate provenance. The browser opens `/systems/<system-id>` and named surfaces such as `/colors`, `/fonts`, `/components/button`, `/context/design`, and `/skills/build-flow/SKILL`. System children have no generated IDs. Source keys and dependency paths remain meaningful; changing them still requires import and reference repair. See [Resource identity](../../context/maintainers/resource-identity.md) for relationship resolution.

## Page loading

See [Systems interface](context/interface.md#page-loading) for this surface's behavior.

## Component pages

A component can use a folder named for it:

```text
button/
  button.tsx
  index.ts
  button.md
  button.examples.tsx
```

`index.ts` re-exports the component, and makes the folder one component: its other files, at any depth, are internal parts with no page of their own, unless one has its own `.md` or examples file. Flat component files are also discovered, and each is its own component page.

The Markdown page has a `title`, `description`, and `## When to use` section. Other sections are optional.

Optional `source` frontmatter supplies a short provenance sentence, such as the library, CLI version, and preset. The compact Source block links the libraries whose `components` include this component to their Libraries entries. Credit comes only from those lists, so a component a library does not list is never credited to it. It preserves the component-specific upstream `docs` link. Label generation versions as shadcn CLI, not as runtime library versions. Keep technical adaptation details in system context.

Each capitalized export from the examples file is one live example. The platform frames examples with the system's theme.

Component pages show guidance, then Examples, then Source with the local file path. Props comes last in a disclosure, collapsed initially and labeled with component and documented-prop counts. Props tables come from TypeScript. They summarize inputs rather than replacing upstream API documentation.

`origin: 'shadcn'` adds upstream shadcn/ui docs links to the components its shadcn library entry lists. A Markdown page can provide its own `docs` URL. Declare `origin: null` when the system's components no longer come from shadcn/ui.

Missing pages, examples, or required page fields normally produce warnings. `docs: 'strict'` makes these errors. `docs: 'off'` suppresses documentation warnings.

The [document-component skill](skills/document-component/SKILL.md) owns the scaffolding and documentation procedure.

## Theme

Theme pages come from custom properties in the theme. No separate theme-page files are required. Preview geometry belongs to the documentation renderer, so omitted system utilities cannot collapse swatches or samples. Samples use the selected system’s live token values. Spacing and container widths appear separately.

| Token family | Page |
| --- | --- |
| `--radius*` | Radius |
| `--shadow*` | Shadows |
| `--spacing*`, `--space*` | Spacing |
| `--font*`, `--text*`, `--leading*`, `--tracking*` | Typography |
| Color values | Colors |
| Remaining tokens | Other tokens |

A system's theme is its declared inventory. Declare only the theme tokens it provides, including values matching upstream defaults. Omission intentionally excludes a token or an entire family. Studio and Product follow the same contract: neither receives the rest of Tailwind's catalog. Theme pages show declarations from the theme entry point, including mode overrides; generated resets and utility mappings are not documentation tokens.

Declare `styling: 'tailwind'` or `styling: 'custom'` in `system.ts`. Tailwind declarations live directly on the unconditional system boundary in `styles/theme.css`; dark mode overrides those base values. Missing referenced tokens, inherited theme tokens, and dark-only declarations fail validation. There is no full-catalog completeness requirement. Adding a token is an intentional system change, alongside any component or example that needs it.

The CSS build resets Tailwind's built-in theme and generates utility mappings from registered system inventories. Theme-backed utilities are available only within systems declaring their dependencies. CSS `@scope` boundaries stop selectors at other systems, including nested embeds; generated boundary resets separately stop inherited custom properties. Utilities apply to the theme boundary itself and its descendants. This uses modern browser support for [`@scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@scope) (Baseline March 2026). Layout utilities such as `flex` and `overflow-hidden` remain available. Arbitrary CSS values remain authoring tools, not automatically documented system tokens. The named `rounded-full` choice also requires an explicit `--radius-full` declaration, even though Tailwind normally implements it as a built-in constant. Product declares its corner radii and a full radius for circular avatars and rounded bars.

`pnpm check` validates recognized theme-backed literal utility use in system components, examples, platform code, and assigned prototype code. A diagnostic names the file, utility, and missing token. Dynamic class construction cannot always be resolved statically; the CSS boundary still enforces availability. Custom component-local variables are not treated as missing system tokens.

Spacing is a finite inventory of `--spacing-4`, `--spacing-6`, and other chosen steps. Decimal steps use underscores, such as `--spacing-1_5` for `p-1.5`. The supplied themes omit the unrestricted `--spacing` multiplier, so declaring a few steps does not enable every numeric size. Component spacing formulas reference the selected tokens directly.

Breakpoint and container declarations also belong to the inventory. Query thresholds compile into CSS and cannot change through inherited variables. Systems sharing a query name must currently declare the same threshold; use unique names or scoped CSS queries when thresholds differ. Omitted breakpoint variants are unavailable in that system. Container width utilities read local values. This shared compiler restriction is validated rather than silently resolved from another system.

`src/platform/app/styles.css` owns imports and global application styles. The CSS build reads system declarations to configure Tailwind and filters generated utilities by system. Component-animation packages supply utility mechanics; their default theme is cleared as well. Supplied themes explicitly choose enter/exit animations and helper values, with keyframes prefixed by the owning theme class. Upstream packages remain sources for future intentional additions.

Systems declaring `styling: 'custom'` are exempt from the Tailwind vocabulary contract. Their theme entry point can contain scoped CSS and validated local imports with their own token names. A library that requires a React theme provider must wrap its system's views and documentation examples using that library; Studio does not automatically install or infer providers. JavaScript-only tokens need custom system documentation until a dedicated adapter is implemented. Top-level Tailwind `@theme` blocks remain application configuration and are rejected in prototype-system styles because they affect all systems.

## Assets browser

See [Systems interface](context/interface.md#assets-browser) for this surface's behavior.

## Source editing

See [Systems interface](context/interface.md#source-editing) for this surface's behavior.

## Navigation and organization

See [Systems interface](context/interface.md#navigation-and-organization) for this surface's behavior.

## System choice

`meta.json.systemId` selects a prototype's system; explicit `null` selects no system. The assignment is required; creation writes the selected system ID. The [prototype contract](../prototypes/README.md#metadata) owns the metadata definition.

See [Systems interface](context/interface.md#system-collection-and-creation) for collection navigation and local creation.

## System lifecycle

Assigned maintainers and Admins can rename active prototype systems. Creation, default selection, archive, restore, and deletion require an Admin. Restore archived systems before editing. Studio remains protected. See [Systems interface](context/interface.md#lifecycle-presentation) for menus and transitions.

Rename changes the label, source-folder key, registration, imports, and source-path references together. The permanent system ID, default reference, prototype assignments, pending targets, grants, and public URLs remain unchanged. The independently declared theme class stays unchanged. System declarations must be plain data objects, so discovery can refresh them without executing cached modules. A brief toast confirms reference updates; rename has no additional impact confirmation. Remaining path references are recorded in `renameReview` and shown in a persistent Overview notice with copyable cleanup instructions. Lifecycle CLI commands preview changes before `--yes`: `rename-system <id> --label <name>`, `archive-system <id>`, `restore-system <id> [--restore-prototypes]`, and `delete-system <id>`. Applied changes roll back if validation fails. Lock entries and project skill exposure stay synchronized.

Archive sets `system.ts.status` to `archived` and archives associated active prototypes. Their metadata records `archivedBySystemId` so restoration can distinguish them from prototypes already archived. Archived systems remain registered and locally browsable, but leave creation choices and deployment. The build excludes archived systems' declarations, introductions, examples, assets, knowledge, and theme CSS. Open an archived system and use its header menu to restore it, with an explicit choice to restore associated prototypes. Restore never changes the default. Choose another default before archive or deletion.

Delete permanently removes the source and registration without retaining a Studio trash copy. The confirmation lists affected prototypes and warns about rebuilds and uncommitted files. Assigned prototypes retain their original code and deleted assignment, with explicit `systemMissing: { systemId, label }` metadata. Independent documents, diagrams and canvas scenes remain readable locally; system-consuming views show rebuild guidance and remain source-repairable. View imports, typechecking, and publication exclude the affected implementation until migration is complete. Rebuild the system-dependent implementation and assignment together, preserving independent artifacts unless their content needs revision, then remove `systemMissing`. Pending rebuild requests targeting the deleted system are cancelled. Recovery requires previously committed Git history.

The configuration command preserves existing prototypes' system choices before changing the default. Migration must update imports and metadata together.

See `src/platform/node/lib/studio-setup.js` for preservation and the setup-design-system skill for migration and placeholder cleanup.

Studio is maintained with Studio and excluded from prototype choices, default-system configuration, and system removal. Its runtime UI stays unavailable to prototypes and other systems.

## System knowledge and agent routing

The [documentation standard](../../context/documentation-standards.md#ownership) distinguishes technical contracts from operating policy, intent, and procedures.

A system’s guidance applies to its product and design domain. Platform and modules own their operating knowledge and procedures.

A system owns theme, components, assets, libraries, context, and skills. Assets include fonts, icons, logos, and shared imagery. They may be local files or explicit package dependencies; their ownership follows the static asset convention. Context and skills live directly in their system folders. The navigation exposes these parts, including Assets and Libraries when empty.

Systems exposes these files at `/systems/<system-id>/context/<file>` and `/systems/<system-id>/skills/<skill>/SKILL`. Old readable system routes have no compatibility aliases. The shared source editor and file operations use explicit system and section identifiers. Content remains platform-styled even for a single-mode product system.

The repository's `AGENTS.md` supplies platform operating instructions and routes prototype work to its assigned system's `AGENTS.md`. System-local instructions link to relevant context and skills. System knowledge supplements platform constraints; it does not override runtime dependency boundaries. Different systems may use the same skill folder name because their source paths remain distinct. Discovery does not imply a harness automatically loads these files.

Module packs carry module-owned context and skills. Their declared instruction paths are relative to their module folder. System packs carry context, skills, and AGENTS.md alongside their components.

## Implementation files

The design systems pages, at `/systems`: what each system has, its tokens, and a page per component. Required. The systems themselves are
folders in `src/systems/<id>/`, which are your content, plus Studio's own system in `src/platform/systems/studio/`, which upstream maintains.

- `module.ts`, `app.tsx`: who it is, its rail button and routes.
- `spec.ts`: what a `system.ts` declares (`SystemSpec`) and the check for it.
- `sources.ts`, `docs.ts`, `scaffold.ts`, `themeTokens.ts`: where a component came from, how its docs and props are read, the starter docs a new component gets, and the theme's tokens.
- `pages/`, `data/`: the Systems pages and the loaders behind them (browser).
- `node/`: finding systems, building their docs and props, and `pnpm component-docs` (Node).

Page loading follows the [shared navigation handoff](../../context/maintainers/source.md#navigation-handoff). Route loaders prepare the reader and content before replacing the current page.

## Local owner routes

Systems owns `source`, `skill`, and `component-docs` under `/__studio/systems/`. Requests use the current permanent system identity and relative source paths. Active-system resolution precedes current contributor authorization; Studio remains Admin-only. Platform and module skill owners use their declared knowledge-owner IDs. Source editing uses the shared ordinary-file catalog and version-conflict contract. Creation receipts include the same manifest published to other tabs and use `callModuleMutation` for origin-tab synchronization. The generic file endpoint has no Systems creation cases.

Component props use the shared [build asset protocol](../../context/build-assets.md) as `systems/props`. Systems owns extraction; the platform owns lazy transport, caching, and dependency invalidation.

Application consumers use the public [system services](../../context/system-services.md), including queries, source paths, and `ThemeScope`. Context and Skills use the shared `FileTree` with Systems-owned policy; creation rules and bundle protections stay in `content/fileTreePolicy.tsx`.
