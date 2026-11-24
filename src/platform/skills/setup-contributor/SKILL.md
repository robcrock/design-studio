---
name: setup-contributor
description: "Register someone joining an existing studio and verify local access. Use configure-studio for a new studio."
---

## Scope and input

Read the [contributor scope](../../context/contributor-scope.md). Inspect configuration, contributors, and Git identity before changing registration.

Preserve shared configuration, systems, samples, and system content. Install missing pinned tools and dependencies as needed.

When called by configure-studio or an installation workflow, use **registration-only mode**. Perform registration and return to the caller without configuring, creating a prototype, launching the app, or committing partway through setup.

## Register

1. Inspect repository Git name and email. Resolve uncertain identity with the person. Set confirmed values locally when authorized.
2. For GitHub sharing, determine the person's username. Let the person complete interactive authentication if needed.
3. Preview `pnpm join`. Supply explicit `--key`, `--name`, `--email`, and optional `--github` flags when detection is unsuitable.
4. Apply confirmed registration with `--yes`. Do not overwrite another entry to resolve a collision.
5. Run `node src/platform/node/cli/resolve-contributor.js` and verify the expected key. Registration writes initial onboarding progress; preserve existing progress. Correct any profile declarations reported by validation rather than assuming defaults.

Personal local use accepts a personal email and needs no GitHub account. GitHub CI needs the contributor's username before sharing there.

The command owns registration files and collision handling. Inspect its help instead of recreating that logic manually.

## Registration-only completion

Return the contributor key and unresolved identity or access issues to the caller. The caller owns launch, final verification, and commit.

## Standalone completion

Offer a first prototype. If requested, create it with `pnpm new` using the existing default system.

Start the local app and inspect the contributor's work area and any requested prototype. Follow the Working in Studio section of `AGENTS.md` for build and save requirements.

Leave the app available. Report local readiness separately from missing GitHub access.
