---
title: Format versions
description: Stored format versions, validation, and explicit migration of retained files.
toc: true
---

Some files hold the team's work and outlive any one release: the studio's settings, each prototype's metadata, and each contributor's profile. Each declares a top-level `formatVersion`, so migrations recognize their input instead of guessing from its shape.

## Versioned formats

| Format | File | Version field | Validator |
| --- | --- | --- | --- |
| Settings | `studio.config.json` | `formatVersion` | `configProblems` in `src/platform/core/config.ts` |
| Prototype metadata | `meta.json` in each prototype and section item | `formatVersion` | `readPrototype` in `src/platform/node/build/build-manifest.js` |
| Contributor profile | `contributors/<key>.json` | `formatVersion` | `readContributors` in `src/platform/node/lib/contributors.js` |

The current versions are one exported constant, `FORMAT_VERSIONS` in `src/platform/core/formats.ts`. The settings schema lists `formatVersion` as required and as the first property after `$schema`, and `CONFIG_KEYS` keeps it in that place.

The other stored formats do not take the field, each for a reason:

- A canvas is an Excalidraw scene, so its top level belongs to Excalidraw. It already carries `studioVersion`, which a newer copy of the app reads as "open it, never save over it". Canvas keeps that field.
- Documents and diagrams are Markdown and Mermaid text. A leading comment or frontmatter carries their identity, and nothing about them is a Studio-defined structure that needs upgrading.
- `module.ts` and `system.ts` are code declarations. Compatibility is declared with `requires` and `PLATFORM_VERSION`.

## Validation

A file with no `formatVersion`, or a value other than the current version, is a validation error that names the file. `pnpm check` reports settings and contributor files, and the manifest build reports a prototype. An error says whether the file was written by a newer studio.

Writers keep the field. Settings writes are read-modify-write of the parsed file, so the field stays where it is. Creation writes the current version: `pnpm new` and the New prototype button (from the template), `pnpm join`, and fixtures. Registering a system changes `studio.config.json` and keeps its version.

## Explicit migration

Builds and ordinary saves never upgrade stored formats. Unknown future versions are refused. A format change updates `FORMAT_VERSIONS` and follows the [release compatibility policy](maintainers/releasing.md#versions).

The public baseline uses version 1 for settings, prototype metadata, and contributor profiles. Contributor profiles declare module preference namespaces. Earlier development shapes are not supported formats; changing a version number alone does not make an obsolete shape valid. The [preference initialization workflow](contributor-preferences.md) adds namespaces for installed modules using current declarations.

## Related contracts

- [Studio configuration](config.md) defines `studio.config.json`.
- [Resource identity](maintainers/resource-identity.md) defines the permanent IDs the same files carry.
- [Ownership and updates](ownership.md) defines how seed and team files change during an update.
