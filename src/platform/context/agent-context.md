---
title: Agent context routing
description: Canonical guidance, project skill exposure, system resolution, and validation boundaries.
toc: true
---

Design Studio maintains file-based context and skills. The host discovers skill metadata; the agent reads the selected procedure and its references. Studio does not inject a full context bundle or record conversation reads.

## Find the owner

[Documentation ownership](documentation-standards.md#ownership) defines owners and canonical locations. The [platform README](../README.md) indexes shared knowledge; implementation lives in `core/`, `app/`, and `modules/` (the supplied modules).

The Documentation surface offers Manual and Context and Skills. The latter shows one tree grouped by Platform and Modules and reads original files at `/documentation/context/<owner>`. Each system exposes its own Context and Skills beside Theme and Components at `/systems/<system-id>/`. The scopes read canonical files without copying them. The platform and module browser lists documents directly beneath each owner and offers source editing rather than asset management. Prototype and system routes use permanent IDs without readable-route aliases.

## Entry and platform baseline

Root `AGENTS.md` is generated from `src/platform/AGENTS.md`, the module routing block, and the team's `AGENTS.team.md`; edit those sources, not the output. Its Working in Studio section holds the standing requirements: preservation, contributor scope, assignment, enabled capabilities, and verification. Full [Principles](principles.md) and [Personas](personas.md) apply to platform product and architecture decisions. Studio interface work follows its system entry point and writing context.

[Documentation ownership](documentation-standards.md#ownership) defines canonical ownership. Enabled modules declare optional task routes through module-relative `instructions: [{ path, when }]`. `pnpm studio sync` regenerates root `AGENTS.md` (including the `studio:modules` block) and native project skill exposure. Adding, removing, and configuring capabilities invokes synchronization; development startup also synchronizes. A build validates sources without rewriting adapters.

## Resolve a prototype's system

| Metadata | Resolved system |
| --- | --- |
| `systemId: "<system-id>"` | The permanent ID of the registered prototype system, resolved to its current source folder. |
| `systemId: null` | No system; use local components and styling. |
| Assignment omitted | Invalid; declare a system ID or `null`. |

Read the assigned system's entry point and relevant context and skills. A duplicate with pending `rebuild` also needs its target system's guidance. Preserve the original and migrate implementation and assignment together. The current assignment remains the runtime boundary until migration completes.

Use `pnpm studio context src/prototypes/<contributor>/<prototype> --json` for an existing contributor-owned prototype. The read-only report resolves current identity and edit scope, explicit assignment, rebuild target, enabled modules, and system entry paths. It shares assignment validation with the manifest and rejects invalid assignments and symbolic-link paths. A deleted system is reported as missing; it is not replaced with the default. This command does not read an instruction bundle, infer task relevance, authorize changes, or verify the artifact. Other module-owned sections use their owning contract.

Read complete contract sections needed for the task and expand when dependencies or ambiguity require it. Reuse unchanged guidance while it remains available. The [system authoring context](../modules/systems/context/authoring.md) selects sections without loading interface-maintenance detail.

The browser's selected system does not change prototype assignment or conversation context. Exposing a system skill does not make it applicable to every prototype.

## Native project skills

Canonical sources remain under platform, module, and system `skills/` folders. Synchronization inventories platform skills, enabled module skills, and registered system skills, validates metadata, and emits uniquely named project entry points.

- Codex and Cursor discover generated entries under `.agents/skills/`.
- Claude Code discovers `.claude/skills/` links to those same entries. A newly created `CLAUDE.md` routes to root instructions; existing user files are preserved.
- Each entry links to its canonical procedure, which owns supporting resources. System entries require correct assignment or explicit system maintenance; module entries require enabled capabilities.

The generated receipt `.agents/studio-skills.json` tracks exact managed contents. Sync preserves unrelated and modified entries and reports collisions. Obsolete unmodified entries are removed when capabilities disappear. Do not edit generated entries; edit their canonical skill and synchronize. Cursor can also discover Claude-compatible directories; its actual selector behavior must be checked in the installed host.

`pnpm studio sync --check` inspects routing, adapters, and their receipt without writing. Missing or stale generated entries and preserved collisions fail the check. Custom `CLAUDE.md` files and unrelated skills remain user-owned. No `.cursor/skills` copy is needed.

Local project exposure does not require a global plugin. The Design Studio plugin supplies create, open, and use entry points; operation uses the target repository's current procedures. Plugin installation and host permissions remain separate from project skill discovery.

## Plugin distribution and installed studios

The setup plugin lives in its own repository, [design-studio-plugin](https://github.com/itspatmorgan/design-studio-plugin), with its host manifests, catalogs, and setup instructions. The starter carries no plugin files. `pnpm studio sync` is the only generator for project routing and skill adapters, used during capability changes and development startup.

The default setup follows the starter-owned [installation guide](installing.md), without plugin tooling. An agent needs filesystem and command execution in the chosen environment; native skill discovery and workspace opening depend on its harness. If discovery is unavailable, read `AGENTS.md` and the linked procedures explicitly. Plugins provide convenient setup and publishing entry points, not a requirement for using the studio. Existing studios use their own current guidance and are never repackaged.

Host conventions: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Claude Code skills](https://code.claude.com/docs/en/skills), [Cursor skills](https://cursor.com/docs/skills).

## Inspect and validate

The generated manifest's `systemContent` includes Context and Skills for platform, enabled modules, and registered systems, with explicit owner metadata. `skillCatalog` lists canonical sources, descriptions, and exposed names. `systemContentMaps` inventories context routes and skills for each owner. These are diagnostics, not evidence of actual agent reads or native registration success.

Build checks validate metadata, reachable local links, source structures, registration, and runtime boundaries. Missing targets fail strict builds. Test real requests and resulting artifacts to verify activation, system selection, disabled capabilities, and outcomes. Saved links to moved Studio guidance and renamed module contracts redirect to their canonical readers. A routing walkthrough or automated adapter test does not establish live behavior in every harness.
