---
name: setup-design-system
description: "Curate a studio design system for a prototype, or assess and import an existing React system with its theme and assets. Use document-component for one component."
---

## Scope and input

Read the [system authoring context](../../context/authoring.md) and the contract sections it selects. Use [manage-modules](../../../../skills/manage-modules/SKILL.md) when creation, registration, default changes, or retirement are needed.

Inspect the target system, configuration, component destinations, and packages. For replacement or retirement, inspect all consumers, including disabled module content.

Read [System curation](../../context/curation.md) when establishing or resuming setup. Overview provides the initial prompt builder and the system's metrics. Keep agreed direction, sources, and next action in the saved curation record, and guide reviews in chat using system navigation and prototype links. Inspect existing records before asking the person to repeat decisions.

Overview prompts carry the person's source choice, preset, context, and requested next step. This skill owns the setup procedure and technical constraints. Resolve the target by its supplied system key. Preserve other systems, existing prototypes, and the default unless the person requests changes. A continuation of an assessment remains assessment-only until import is authorized.

Establish whether the person wants to curate a toolkit or bring an existing React system. For curation, start with what they want to prototype. A designer may name components and visual choices. For a product manager, decompose the intended flow into screens, states, and the smallest supporting kit. For an existing system, start with its source, inventory, and dependencies. Do not require a prototype idea to audit it and propose an import plan. Ask only for decisions needed for the next step.

Collect missing system ID, component source or package, tokens, assets, and usage guidance. If only design files exist, inspect available material and report gaps.

Use supplied decisions. Do not present the placeholder's styles as the person's product system.

## Choose the path

- Keep the starter while exploring, adapt it, or create a separate system according to the person's choice. Sample removal is a separate decision.
- For a curated library kit, follow [Curate from libraries](references/curated-libraries.md). Use shadcn as the curated starting point. Other React libraries can be assessed through the existing-system path.
- For existing React code, follow [Assess an existing system](references/existing-react-system.md) before importing. An assessment request alone does not authorize migration.

Describe the proposed components, theme, assets, dependencies, and known gaps in plain language. Apply already-authorized choices. Ask about unresolved scope or fidelity compromises before dependent work.

Context and skills are separate curation decisions. Save supplied product knowledge; do not invent personas or product context to fill folders. Add a skill only for a demonstrated recurring task. Do not install a skills catalog during setup.

For an assessment-only request, report evidence, an import plan, adaptations, and unresolved questions. Cover the reusable system in stages when useful. No new system or prototype is required.

When the person selects an existing target system, save the assessment summary there with stage `assessment` and link its detailed record. Open Overview for review. Missing production material can block one import stage without blocking a portable theme or asset stage. Do not create a system just to hold an assessment unless requested.

## Establish the kit

1. Adapt the chosen installed system in place if requested. Otherwise, preview `pnpm studio create-system` and apply authorized creation.
2. Import components or connect the package. Avoid unnecessary copies of package code.
3. Adapt aliases, dependencies, themes, and portals to the system contract. Place fonts, logos, and imagery using the [static asset convention](../../../../context/assets.md).
   Install packages in the target system's workspace, following [System libraries and dependencies](../../context/libraries.md). Expose library APIs deliberately when prototypes need capabilities beyond the documented components. Record the selected component sources, foundations, icon sets, fonts, and other meaningful libraries in the library inventory. Omit implementation helpers and transitive dependencies. Listing a source does not expose its package API.
4. Follow [document-component](../document-component/SKILL.md) for component pages and examples.
5. Create or reuse one representative prototype in the person's folder. Verify the kit there and on its Systems pages.

Add shadcn components only for demonstrated gaps. Use the target system's configuration through isolated preparation; consult [shadcn configuration and DESIGN.md guidance](references/shadcn.md). Save reviewed resolved configuration separately from runtime integration. Never treat a CLI destination override as isolation of all writes.

## Change the default and retire placeholders

Run `pnpm build` before switching the default. Preview `pnpm studio configure --system <id>`, then apply confirmed choices with `--yes`.

The command preserves existing system choices. Migrate retained prototypes by updating imports and metadata together.

If cleanup is authorized, inspect all dependencies of each system being retired, including Product or Marketing. Include sample content and disabled modules.

Preserve recoverable copies when replacing content. Use the [system lifecycle](../../README.md#system-lifecycle) to archive or permanently delete a retired system. Shadcn configuration belongs to each system; preserve the retained system's choices when retiring another. Preview changes and resolve dependencies instead of using `--force`.

Do not remove another person's work merely because a contributor joined. Explain proposed starter cleanup and obtain unresolved choices.

## Completion

Local creation registers the system and maintainer entry; external source is integrated into that scaffold. Set the intended [system declarations](../../README.md#structure), including the screen widths the product is designed for, its main one first, and [theme inventory](../../README.md#theme); validators check their structure. Adjust components and examples to those choices.

Review representative components and pop-ups in every supported color mode. Verify that a single-mode system keeps its mode when Studio toggles. Follow the Working in Studio section of `AGENTS.md` for build and save requirements after migration.

After completing the person's requested customization of an example system, set `overview.starter: false` in its `intro.tsx` and revise the summary to describe the customized system. This clears the example banner for everyone. Do not clear it just because the person opened or copied a setup prompt, or while assessment or customization is incomplete. Preserve any curation summary and saved decisions.

Report source provenance, adaptations, the default system, verified prototype URL, and missing input. Return that prototype to initialization for reuse.

For imported product code, distinguish verified API, theme, and behavior fidelity from unresolved differences. A passing build alone does not establish equivalence with production.
