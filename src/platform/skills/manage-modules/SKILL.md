---
name: manage-modules
description: "Create, install, enable, disable, or remove modules; create, rename, archive, restore, or delete systems through the Studio CLI."
---

# Manage Modules

Read the relevant [module contract](../../context/modules.md) sections for capability changes. System authoring uses the [system contract](../../modules/systems/README.md).

- Use managed commands for local scaffolds, registration, availability, and instruction synchronization. Scaffolds write required declarations; validation reports missing fields. Discovery alone does not activate a capability.
- Supplied modules are in `src/platform/modules/` and the team's own in `src/modules/`. `create-module` writes only to `src/modules/`, and a new module can't reuse a supplied module's id. Enable, disable, and remove work in whichever root holds the module.
- A team module or system imports platform code only through the [public API](../../context/modules.md#public-api), `#studio/*`, and every module declares `requires`. Fix a rejected platform import by using the matching `#studio/*` entry; if none offers what the module needs, report the gap instead of importing a private file.
- Run commands for the person. Use CLI help and previews for current arguments and proposed file changes.
- Preview `remove` and `create-*` before applying them with `--yes`.
- For system lifecycle changes, read the [Systems contract](../../modules/systems/README.md#system-lifecycle). Preview `rename-system`, `archive-system`, `restore-system`, or `delete-system` before `--yes`. Rename repairs local references automatically. Archive preserves source and archives associated active prototypes. Delete permanently removes system source; retained prototypes need a rebuild. Choose another default before archive or deletion, and resolve whether restoration includes associated prototypes.
- Apply already-authorized choices without asking again. Ask for unresolved source, scope, or destructive choices.
- Treat installed modules as trusted code, not sandboxed data. Review the source and proposed dependencies before installation.
- Install external source through reviewed repository edits following the [installation contract](../../context/modules.md#installation-contract). Preserve allocated system identities and existing work. Use local scaffolds and existing pnpm commands; do not recreate a package installer.
- Do not manually edit generated `AGENTS.md`; synchronize after capability changes.
- Do not bypass required-module constraints or unresolved dependencies with `--force`.
- A running dev server restarts itself after configuration, module, or system changes, whether they come from the CLI, Studio settings, or a direct edit. Ordinary component edits update during development.
- Use the configuration command to change the default system. Preserve existing prototypes until intentional migration.
- Applied shared commands require an Admin. Assigned maintainers may use managed rename for their active systems. Use `configure --maintainers system=key,key --yes` for grants. Reserve `configure --recovery` for explicitly authorized setup or permission recovery.

Use `pnpm studio list` to inspect installed modules and `pnpm check` to validate their contracts.

The command synchronizes module-owned agent routing. Disabled module instructions must not direct work on unavailable features.
