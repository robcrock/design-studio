# Design Studio

Follow [Working in Studio](#working-in-studio) throughout each session. Before changing upstream-owned paths, read the relevant [ownership tiers](context/ownership.md#tiers) and [path map](context/ownership.md#path-map).

Before editing an existing contributor-owned prototype, use `pnpm studio context src/prototypes/<key>/<id> --json` to resolve contributor scope, assignment, and pending rebuild. For creation or other content, resolve the contributor with `node src/platform/node/cli/resolve-contributor.js`. Explicit `systemId: null` means no system; missing assignments are invalid. The default is written explicitly at creation. Read the assigned system's `AGENTS.md` and relevant context. For a pending rebuild, read the target system too and preserve the original.

Use the [platform README](README.md) as an index when locating shared context, skills, or implementation. For platform product or architecture decisions, read [Principles](context/principles.md) and [Personas](context/personas.md). For Studio interface work, read [Studio instructions](systems/studio/AGENTS.md).

Use pnpm. Reuse unchanged instructions already read; read source before editing. Save verbose check output to a temporary log and report results and warnings concisely.

The human Manual lives in `src/platform/modules/documentation/pages/`; technical requirements live in owner READMEs and context documents. Update affected guidance with platform behavior changes. For routing work, consult [TanStack Router](https://tanstack.com/router/latest/docs/framework/react/overview).

## Working in Studio

Read [Contributor scope](context/contributor-scope.md) before changing prototype content or shared files. Existing task authorization covers necessary shared changes. Preserve user edits; do not reset, overwrite, or delete work to simplify a task.

Honor enabled module declarations. A visible file or skill does not enable an unavailable capability. Use the owning module's technical contract before changing formats, dependencies, or lifecycle behavior. Product guidance cannot relax platform boundaries. When changing behavioral declarations or scaffolds, follow [explicit declaration](context/principles.md#declare-what-the-system-provides): write defaults visibly and validate missing required fields.

Choose checks with the [minimum sufficient verification policy](context/maintainers/checks.md#minimum-sufficient-verification); repeat passed checks only when new changes or unresolved failures justify it. Run `pnpm build` before committing completed changes. Fix reported type, boundary, and asset errors rather than suppressing checks. Inspect rendered results for interface or prototype changes. When adding or changing static assets, follow the [asset convention and guard](context/assets.md).

A running dev server keeps up with changes on its own: it restarts after configuration, module, and system changes (including a `system.ts` edit), and gives views, documents, and canvases written as files their permanent identity as they appear. `pnpm canvas` does the same for its prototype and reads a fresh manifest. Without the dev server, run `pnpm studio identify <prototype folder> --yes` after creating files directly.

Commit finished work with a concise message. Push only when requested. When you open a pull request, answer every section of the [pull request template](../../.github/pull_request_template.md). For interface changes, include before and after screenshots and a short recording of the changed flow, and link the pull request's Codespace so a reviewer can try editing without a local studio. Sharing and [publishing](context/publishing.md) are separate actions.

## Skills

Skills are owned by the platform, enabled modules, and registered systems. Inspect their names and descriptions, then read applicable procedures and supporting files. The generated project skill adapters expose the same canonical sources to coding harnesses. A system skill applies only to that system's assigned prototypes or explicit system maintenance.

- For configuring a running studio, or updating it to a newer Design Studio release, use [configure-studio](skills/configure-studio/SKILL.md). Missing dependencies alone do not mean initialization is needed.
- For contributor registration, use [setup-contributor](skills/setup-contributor/SKILL.md).
- For module or system installation, creation, availability, or removal, use [manage-modules](skills/manage-modules/SKILL.md).
- For READMEs, shared context, skills, Manual coordination, or guidance audits, use [maintain-documentation](skills/maintain-documentation/SKILL.md).
- For an explicit design-system review, use [check-design-system](skills/check-design-system/SKILL.md).
