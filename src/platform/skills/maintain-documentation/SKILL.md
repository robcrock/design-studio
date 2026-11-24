---
name: maintain-documentation
description: "Author or audit READMEs, context, and task skills for the platform, modules, and systems; coordinate human Manual updates."
---

Read the owner's README and [Documentation standards](../../context/documentation-standards.md). Check implementation and command help before documenting behavior. For human Manual chapters, use [write-manual](../../modules/documentation/skills/write-manual/SKILL.md) when Documentation is enabled.

Update the canonical source and affected links; subtract repetition of code, types, or other guidance. Preserve supplied intent, unusual constraints, and data-protection guarantees. Context explains decisions; skills hold task judgment. Do not invent product facts or add catalogs and tracking systems. An audit alone does not authorize edits.

After skill or routing changes, run `pnpm studio sync`; preserve team-authored adapters. Root `AGENTS.md` is generated from `src/platform/AGENTS.md`, module routing, and `AGENTS.team.md`. Module routes use module-relative `instructions` paths; system skills apply to assigned prototypes or explicit system maintenance.

Verify affected links and anchors with `pnpm check:links`, then metadata and rendered content. For a skill, walk through matching and out-of-scope requests; distinguish walkthroughs from live agent testing. Follow the Working in Studio section of `AGENTS.md` for checks and saving, and report unresolved limits. A focused change does not require a broader guidance audit.
