---
name: configure-studio
description: "Configure a running studio for the first time, update requested studio settings, or update the studio to a newer Design Studio release. Use setup-contributor for someone joining; installation has its own workflow."
---

## Scope and input

Use this skill when someone is ready to configure a running studio. The first-run install and launch steps are in the [installation guide](../../context/installing.md); do not make configuration a prerequisite for launching the starter. Preserve existing work and confirmed choices.

Read the relevant [configuration contract](../../context/config.md) sections. Use [manage-modules](../manage-modules/SKILL.md) only when changing module availability or system registration or lifecycle. Run `pnpm studio status --json` and inspect current configuration. Settings live in `studio.config.json`, which `pnpm studio configure` and Studio settings edit as JSON; when you edit it by hand, keep it plain JSON (no comments), keep its `$schema` line first, and do not list Studio's own system in `systems`.

Distinguish initial configuration from a settings update. Missing dependencies or a stock name do not establish initialization intent. Collect only unresolved choices needed for the requested work. Initial configuration can include identity, personal or team use, toolkit materials, and supplied product context.

## Prepare and configure

1. Inspect the affected contributors, systems, and prototypes. Resume from actual state rather than restarting completed setup.
2. If registration is needed, follow [setup-contributor](../setup-contributor/SKILL.md) in **registration-only mode**. Return here after identity verification.
3. Preview requested choices with `pnpm studio configure`, passing only the settings to change; omitted settings are kept (`pnpm studio --help` lists every option). Enable Contributors & Permissions before switching to team use, and provide registered Admin keys with `--admins key,key`. Preserve existing grants when resuming. Use `--recovery` only for authorized initial setup without an Admin or permission recovery. Apply confirmed choices with `--yes`; the command validates configuration and preserves existing prototype assignments. Restart the server as required.
4. If the person wants to curate or import a kit now, follow [setup-design-system](../../modules/systems/skills/setup-design-system/SKILL.md). Reuse its representative prototype for final verification. If they choose to explore with an installed starter, preserve that choice and continue without requiring a replacement system.
5. If supplied product context needs saving, use [maintain-documentation](../maintain-documentation/SKILL.md) in the selected product system. Preserve platform personas, principles, and skills. Keep unresolved materials explicit.

The setup-design-system skill owns system migration and starter cleanup. Do not perform a second cleanup here.

Do not create a remote, push, or configure hosting without a request. Personal local use needs no GitHub account.

## Verify completion

For initial configuration, reuse the setup prototype or create one with `pnpm new` and inspect a view with the chosen system. Exercise Documents or Canvases when they are part of the requested setup, using their skills; skip disabled capabilities.

For a settings update, verify the changed settings and affected navigation or system behavior. Do not create artifacts merely to verify a name, tagline, or permission change.

Run `pnpm studio status --json` to confirm configuration and identity. Follow the Working in Studio section of `AGENTS.md` for build and save requirements. Inspect the affected local pages.

Use the UI for review when helpful. Save any context collected there in repository files.

Report completed choices, verified local links, and unresolved input. Leave the local app available. Missing materials block only the import or task that needs them. A usable studio with a chosen starter can complete initial configuration. Product context is curated when supplied; empty context and skills folders do not make setup incomplete.

## Update to a newer release

Follow [manual upgrade guidance](../../context/ownership.md#updating-a-studio). Preserve current work, use a separate branch, review the complete merge including cleanly merged content and settings, install and sync, then verify the affected workflows and production build. The release notes and Git history are the source of truth. Do not push or publish without a request.
