---
title: "Checks and fixes"
---

Checks help keep the shared studio consistent. Give your agent the warning or error so it can identify the cause.

## Where checks run

| Stage | Checks and effect |
| --- | --- |
| Before commit | Staged asset sizes can block the commit. |
| `pnpm build` | Manifest validation, module checks, type checking, and the production bundle. |
| `pnpm test` | Focused platform and enabled-module regression tests. |
| `pnpm test:release` | All regression tests, including disposable setup/production fixtures. |
| `pnpm build:release` | Full regression suite followed by the production build. |
| `pnpm check:links` | Every relative link, heading anchor, and Studio documentation link in Markdown guidance resolves. CI runs it. |
| `pnpm build:inspect` | Validate emitted asset references and report initial JavaScript/CSS size and request count. |
| `pnpm format` / `pnpm format:check` | Format upstream code, JSON and CSS with Biome, or check that it is formatted. Team and seed paths, generated files and `studio.config.json` are excluded. CI runs the check. |
| GitHub pull request | Scope review, asset sizes, ordinary regressions, and one production build. Platform proposals are flagged for review. |
| Push to `main` | Scope authorization, asset sizes, regressions, and production build. Platform changes require an admin or maintainer role. |

Ordinary builds use the same command in source clones and installed studios. Publishing does not rerun maintainer regressions. CI requires `scope` and `build`; the latter includes ordinary regressions and production compilation. A failed, cancelled, or unexpectedly skipped required job fails the gate. Copies choose their own CI and publishing policy.

The [checks workflow](../../../../.github/workflows/checks.yml) defines job dependencies. [Releasing](releasing.md) owns candidate acceptance; [project publishing](releasing.md#project-repository-publishing) owns this repository's deployment.

Keep a small suite for critical infrastructure, data integrity, stable behavioral contracts, and consequential regressions. Use synthetic fixtures instead of asserting the starter's sample content, generated source spelling, or visual token choices. Ordinary development uses type checks, builds, and targeted runtime verification for presentation and incidental behavior. Consolidate shared fixtures only when this removes maintenance work; preserve distinct authority, identity, rollback, and race-condition failures. Validate proposed redundancy with targeted mutations when a replacement must catch the same fault. Production integration tests end in `.integration.test.js` and run only in the release tier. Critical identity, authority, rollback, collision, and copy-cleanup contracts remain covered by ordinary tests. Optional module tests disappear with their module.

See [Personal & team use](/documentation/manual/team) for how these checks fit the workflow. Configure branch protection and required checks to enforce the team's merge policy.

## Ownership map

[Ownership and updates](../ownership.md#path-map) documents maintenance responsibilities. Git upgrades are reviewed manually; there is no machine-readable ownership map or path-coverage check. Contributor permission and identity checks remain independent.

## Platform contract

The public entry files under `src/platform/api/` and their TypeScript declarations are the source of truth. Build checks validate their environment boundaries and all current consumers. The project is pre-release: there is no semantic snapshot or backwards-compatibility gate. Stored-file versions and validators still reject unsupported data; see [Format versions](../formats.md).

## Minimum sufficient verification

Choose checks by changed behavior and dependencies. Do not rerun unrelated setup or production integration tests for ordinary authoring. Scope, permanent identity, asset sizes, harness consistency, metadata, dependency boundaries, types, production compilation, and output inspection remain required in CI. The build job runs tests and production compilation with one dependency installation.

Tests are discovered directly under the platform and registered module roots. Ordinary CI runs `pnpm test`; explicit full checks run `pnpm test:release`. Optional module removal removes its tests from discovery. An empty test inventory fails verification. No catalog or change-selection rules need maintenance.

## Diagram browser regression

After `pnpm build`, install the browser once with `pnpm exec playwright install chromium`, then run `node src/platform/node/check/browser/diagrams/run.mjs`. The focused check covers font readiness and late fonts, resizing/reveal, source races, failure recovery, host link/image policy, source limits, unmount cleanup, compact scaling, and accessible IDs. It uses synthetic content and temporary localhost servers, without contributor data or sample prototype dependencies. Failure screenshots go to an OS temporary directory. This browser check is explicit; ordinary `pnpm test` does not launch browsers.

## Respond to a check

| Message | Next step |
| --- | --- |
| Platform files changed | Confirm authorization and use the maintainer's review process. |
| Import crosses a boundary | Ask your agent to use a permitted dependency. |
| Styles escape their scope | Ask your agent to contain the selector or use a CSS Module. |
| File exceeds the size limit | Reduce the asset before committing. |
| Type check fails | Give your agent the error and ask it to correct the code. |

See [Personal & team use](/documentation/manual/team) for review paths and [Prototype files and boundaries](/documentation/context/module.prototypes#dependency-boundaries) for permitted dependencies.

## Keep files small

The [Asset Guard](../assets.md#asset-guard) blocks oversized files before commit and in CI. Its convention defines the size limit and exception handling.

Follow the guard’s linked guidance to reduce a flagged asset before committing.

## Protect the shared repository

This setup is the studio maintainer's responsibility.

[Contributor scope](../contributor-scope.md) defines authority and before-side review rules. Personal use skips team scope checks, but declaration, dependency, asset, and permanent-identity checks still apply. A proposed usage or grant change cannot authorize itself.

Identity checks inspect staged or committed source and protect [retained identities and containment](resource-identity.md#direct-authoring-and-verification). Identity errors fail CI even for reviewed proposals; CI rejects them.

These checks do not prevent an unauthorized Git push by themselves. Configure GitHub branch protection, required checks, and the team's review process.
