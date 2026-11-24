---
title: System libraries and dependencies
description: Own external packages within a system and expose selected APIs to its prototypes.
---

## Package ownership

Each prototype system is a private pnpm workspace with its own `package.json`. Declare direct runtime packages in `dependencies`, including component primitives and package fonts. Use an empty object when none are needed. Transitive packages are managed by pnpm; a system must declare a package before importing it directly.

The root owns platform and module dependencies. An installed root package does not grant access to a prototype system. Workspace resolution and Studio's import checks enforce this distinction. These are authoring boundaries, not a security sandbox for untrusted code.

System packages declare `private: true`, `type: 'module'`, and a unique `@studio-system/<identity>` name. Managed installation and creation allocate that name from the permanent system identity. Renaming preserves it.

React and React DOM are supplied by Studio. Declare both in `peerDependencies` using the root's version requirements; never install private copies. pnpm disables automatic peer installation. Studio checks React compatibility through each system's installed runtime dependency graph. Vite deduplicates these two packages. Other libraries can use different versions in different systems.

From the checkout, add a selected dependency to its owner:

```sh
pnpm --filter @studio-system/<identity> add <package>@<version> --ignore-scripts
```

Use the package name from that system's manifest. Commit its manifest and the shared `pnpm-lock.yaml` together. Run `pnpm install --frozen-lockfile --ignore-scripts` to verify restoration. Restart the development server after dependency changes.

System creation, installation, rename, and deletion synchronize workspace lock entries. Archive keeps packages locally while excluding system content from deployment. Removing one system does not remove another system's dependency declaration.

## Library inventory and public APIs

Declare the system’s meaningful building blocks in `system.ts`: curated sources, component foundations, icon sets, fonts, and capabilities such as charts. Use `libraries: []` when none have been selected. Omit implementation helpers and transitive dependencies.

Each library declares `kind`, `id`, `label`, `description`, and an HTTPS `docs` link. A `package` library names a direct system dependency; its installed version comes from package resolution. A `source` library records curated code such as shadcn/ui without pretending that its CLI is a runtime dependency. A source may record an evidenced version.

Optional `assets` lists fonts, icons, or images supplied by the library and connects its card to those pages. Optional `components` lists associated documented component slugs. It is the only source of component credit: a ported or hand-written component is credited to a library only when that library lists it. Package libraries link to those examples from Libraries. Source and shared styling references retain the association for component Source blocks, without listing each use on Libraries. A package can additionally declare `entry`, a public runtime file under `libraries/`, when assigned prototypes need direct API access. Listing a library alone does not grant import access.

```ts
libraries: [{
  kind: 'package',
  id: 'charts',
  label: 'Recharts',
  package: 'recharts',
  description: 'Charts and data visualization.',
  entry: 'libraries/charts.ts',
  docs: 'https://recharts.github.io/en-US/',
  components: ['chart'],
}],
```

An entry can re-export the upstream API without copying its implementation:

```ts
// libraries/charts.ts
export * from 'recharts';
```

Assigned prototypes import through this declared entry. Additional files under `libraries/` remain internal. Prefer themed system components when available; direct library APIs still need the system's tokens, providers, and popup conventions.

Prototype bare-package imports are limited to the shared runtime: React and React DOM. Icons and every other package belong to an assigned system and are exposed through its libraries; navigation comes from `@module/prototypes`. A prototype imports a library entry by its path, such as `import { Plus } from '@/systems/product/libraries/icons'`. A prototype with `systemId: null` has no system library access. Shared utilities cannot borrow system dependencies.

Package access checks cover static imports, re-exports, type imports, literal dynamic imports, and require calls before resolution. Importing a `node_modules` filesystem path cannot bypass ownership. Theme package imports follow the same ownership policy and existing scoped CSS validation.

Shared styling tools such as Tailwind can be listed as sources, with their Studio-supplied role made explicit. Include animation extensions only where the system actually uses them. This records meaningful choices without creating new per-system package ownership or implying that every installed tool is in use.

## Review and discovery

Libraries follows Overview in navigation and presents what the system is built from on one page. Compact bordered entries show a name, contribution, resolved version when applicable, documentation, and links to typography, assets, or component examples. Asset pages distinguish library catalogs from local files. Fonts and icons do not need to be copied into assets/ to be available. Runtime entries remain in the declaration for agents; the human page omits import paths.

Verify component examples and a representative assigned prototype after adding a library. Confirm another system cannot import it. A working package API does not establish theme fidelity or provider compatibility.
