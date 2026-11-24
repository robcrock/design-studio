---
name: write-manual
description: "Create or revise human Manual chapters for Design Studio. Use only when Documentation is enabled; technical contracts stay with their owners."
---

# Write Manual

Documentation offers a curated Manual for people; the shared Context and Skills browser displays owner files. The Manual describes capabilities, defaults, and boundaries. Keep agent requirements in owning context and task procedures in skills.

Follow the [documentation standard](../../../../context/documentation-standards.md) and the [Manual chapter contract](../../README.md#manual-pages).

- Put all human chapters in `src/platform/modules/documentation/pages/`.
- Organize the Manual as a compact reference for capabilities, controls, consequences, and troubleshooting. Keep tutorials, exercises, and guided projects separate.
- Keep human workflows in the Manual. A capability chapter declares `module: <id>` so discovery hides it when the module is disabled or removed.
- Use the chapter contract's metadata; add a description, section, and contents navigation when useful.
- A Manual chapter’s filename supplies its URL slug. Update links and callers when renaming or consolidating pages.
- Describe the environment without prescribing a team's design process.
- Validate chapter links and anchors after changes. Consider optional-module availability.

The sidebar follows enabled pages automatically. There is no sequential reading navigation. The Documentation module's [README](../../README.md) explains source editing and discovery.

Inspect the rendered chapter and follow the Working in Studio section of `AGENTS.md` for shared scope, checks, and saving.
