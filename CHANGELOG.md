# Changelog

## Unreleased

- Download one prototype from its menu as a single HTML file someone can open in a browser, while Studio is running locally. The file includes that prototype and its design system, and leaves out Studio and every other prototype.
- Describe how to propose an improvement and what happens next in `CONTRIBUTING.md`, with a feature proposal issue form. Maintainers follow a new [community contributions](src/platform/context/community-contributions.md) guide to assess, adapt, release, and credit outside work.

## 0.1.3 (2026-11-01)

- Zoom and pan standalone Mermaid diagrams with pinch, scroll, drag, arrow keys, and canvas-style zoom controls. Canvas previews and document fences stay fitted. Thanks @robcrock.
- Add an optional `zoomable` setting to `MermaidDiagram` for fitted, full-page diagrams; existing callers are unchanged.
- Show "Rendering diagram…" only when rendering takes longer than 200 ms, so fast diagrams no longer flash it.

### Updating from 0.1.2

Follow the [manual upgrade guidance](src/platform/context/ownership.md#updating-a-studio) and preserve local content and settings. No dependency, file, or migration changes are required. Standalone diagram pages gain zoom automatically; document fences and canvas previews are unchanged.

## 0.1.2 (2026-10-21)

- Render shared Mermaid diagrams with Pele, loading diagram types on demand in documents, reference pages, and standalone diagrams.
- Measure diagrams after their fonts load, redraw for font and container changes, and defer hidden previews until they become measurable. Canvas zoom preserves diagram layout, and unrelated page fonts cannot block rendering.
- Keep diagram links and images disabled under host policy, with explicit source, edge, and SVG output limits. Add focused browser regressions for rendering, lifecycle, and accessibility.

### Updating from 0.1.1

Follow the [manual upgrade guidance](src/platform/context/ownership.md#updating-a-studio), preserve local content and settings, and install the updated dependencies. Stored diagram files remain Mermaid source; no file migration is required.

Review existing diagrams for Pele syntax support and appearance. Arbitrary HTML labels, Mermaid theme variables, external plugins, and layout overrides are not equivalent supported features. See [diagram defaults and limits](src/platform/context/diagrams.md#customize-the-defaults). Excalidraw retains its own renderer.

## 0.1.1 (2026-10-17)

A leaner foundation with the same core Studio experience. This beta release simplifies development and maintenance workflows while retaining data-integrity, identity, permissions, and recovery checks.

- Replace managed upgrades and scripted releases with reviewed Git workflows.
- Retire managed extension downloads and provenance locks; keep local module/system scaffolding and integrate external source through reviewed repository edits.
- Discover regression tests directly, simplify CI, and retain individual module-availability probes alongside two combined production configurations.
- Remove compatibility snapshots, benchmark machinery, duplicate tests, and repeated build/type checks.
- Consolidate agent maintenance guidance and use the installed upstream shadcn CLI in a disposable workspace instead of a Studio wrapper.
- Report immediate Studio/preview startup sizes and the largest deferred chunks in build inspection.
- Use Hugeicons throughout Studio chrome and remove the unused Lucide dependency.

### Updating from 0.1.0

Review the release diff and merge the release tag on an upgrade branch using [manual upgrade guidance](src/platform/context/ownership.md#updating-a-studio). Preserve local work, reconcile dependencies, run `pnpm studio sync`, and verify the affected workflows before merging.

- `pnpm studio update` and `pnpm release` are removed. Use the documented manual Git upgrade and release procedures.
- `pnpm studio add` and `create-module`/`create-system --out` are removed. Scaffold locally, then review and integrate external source and dependencies manually.
- `pnpm prepare-shadcn` is removed. Follow [manual shadcn staging](src/platform/modules/systems/skills/setup-design-system/references/shadcn.md#manual-staging); never run upstream initialization in Studio or a system source folder.
- `pnpm test:changed` and `pnpm contract` are removed. Use `pnpm test`, `pnpm test:release`, and the production build. Public declarations and current consumers are the source of truth; this beta has no backwards-compatibility gate.
- The optional `ModuleSpec.upstream` field is removed. Keep meaningful source provenance in the owner's documentation and preserve required license notices.
- `.studio/ownership.json` and `studio.lock.json` are no longer read. Git records maintenance history; contributor permissions and permanent identities remain enforced separately.

## 0.1.0 (2026-10-14)

Design Studio’s first public beta, 0.1.0. Build and explore product ideas with your coding agent in a local workspace you can make your own.

- Create interactive screens, documents, diagrams, and canvases together in a prototype.
- Use design systems to share components, themes, and project context across your work.
- Explore the Feedback Inbox and Marketing examples, including working screens, alternate states, and an annotated handoff canvas.
- Customize the full source code and publish a read-only site for others to try.
- Improved first-visit onboarding, studio and file updates, and permanent links to your work.

This is early beta. Published sites have no built-in sign-in; use your hosting provider’s access controls for private work.
