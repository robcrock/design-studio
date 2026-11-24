---
name: check-design-system
description: "Audit a Design Studio surface against its applicable design system and report findings for human review before any fixes. Use for an explicit design-system review of Studio UI, prototypes, or system previews."
---

# Check Design System

Review the requested surface against its actual system, combining source checks with rendered evidence. This skill always audits and reports first. Do not change implementation, system guidance, or configuration during the audit, even when the initial request includes fixes. Present the report and wait for the human's response before implementing corrections.

## Resolve the surface

Start with the supplied URL, screenshot, file, module, or prototype. Trace it to its implementation. If the target cannot be identified from the request and current context, ask for the surface to review.

Use the [authoring context](../../modules/systems/context/authoring.md) to select relevant system-contract sections for the reviewed surface. Read additional sections only when its behavior or dependencies require them. Resolve registration and declarations from `studio.config.json` and each relevant `system.ts`; do not assume the platform system's folder is named `studio`. Systems are in `src/platform/systems/` (Studio's own) and `src/systems/` (the team's); use the folder where each was found.

| Surface | Applicable system |
| --- | --- |
| Application shell, module interface, navigation, source editors, and shared knowledge readers | The registered system declaring `role: 'platform'`. |
| Prototype views, including views embedded in documents or canvases | The prototype's resolved assignment. Explicit `systemId: null` means no system; missing assignments are invalid. |
| System runtime components, live examples, and Theme or Component previews | The owning or previewed system. Surrounding application navigation and shared readers retain the platform system. |
| Documents, diagrams, and canvas controls | Studio's application presentation, as defined by the owning module; embedded views keep their own assignment. |

Map separately themed regions on a mixed surface. A selected system in the browser does not reassign a prototype. Pending `rebuild` identifies a migration target, not the current runtime assignment; report migration gaps separately.

For an explicit no-system prototype, review local styling and platform boundaries without imposing a registered system. For missing or invalid assignments, report the resolution failure rather than guessing. For an unavailable module, review its source only if requested and label it unavailable in the running app.

## Read the applicable guidance

Read the resolved system's `README.md`, `AGENTS.md`, theme, relevant component APIs, and context covering the reviewed work. Read the owning module's README for presentation or embedding behavior. For platform conventions such as icons, consult [Technology stack](../../context/stack.md).

Use the resolved system's guidance rather than applying starter conventions to every system. Distinguish explicit requirements, supplied defaults, and recommendations. If guidance and implementation disagree, report the conflict and identify the authoritative source.

## Inspect source and run checks

- Check component imports, supported props and variants, composition, and local replacements that duplicate an available component without a task-specific reason.
- Check colors, typography, spacing, radii, shadows, icons, and assets against the system's declared choices. Inspect inline styles, SVGs, local CSS, and dynamically constructed classes as well as literal utilities.
- Check theme boundaries, mode resolution, and portal containers. Look for global selectors or inherited styles that can leak between systems.
- Review relevant copy and interaction conventions. Keep general UX suggestions separate from demonstrated system violations.

Run `pnpm check` from the target checkout and save output to a temporary log. It checks registered systems, recognized literal theme utilities, CSS constraints, and runtime dependency boundaries. Attribute diagnostics to the requested surface; distinguish unrelated repository failures.

Do not claim this command proves that the rendered design follows its system. Dynamic classes, arbitrary values, inline SVG styles, component choice, icons, and writing still need review. An arbitrary value or custom illustration is not automatically a violation: assess its purpose and the system's guidance. Systems declaring custom styling need their own conventions, not Tailwind token requirements.

Reuse existing validators rather than creating a second token inventory or a blanket ban on custom components. Do not add tokens, switch assignments, replace a toolkit, or weaken checks merely to make an audit pass.

## Inspect the rendered result

When a runnable surface and browser tools are available, capture its initial state before comparing the rendered design with its system. Compare the result with the actual system components and theme, not memory of an upstream library.

Exercise relevant controls, focus states, and pop-ups. Review every declared color mode and relevant responsive layouts when available and within authorized testing scope. Pay particular attention to nested system boundaries and pop-ups that can lose their theme.

If a state, mode, or viewport cannot be tested, name it as unverified. Source inspection is useful evidence, but does not establish rendered contrast, layout, keyboard behavior, or native host behavior. Do not silently alter the person's saved preferences to complete testing.

## Report and finish

Explain the result in plain language. Include:

- Reviewed surface and resolved system for each region, with the assignment or declaration used.
- Concrete findings ordered by impact, each with a file or rendered-state location, the relevant convention, and a recommended correction.
- Automated results and log location, visual states inspected, and unverified coverage.

Separate demonstrated deviations from consistency suggestions and missing system guidance. Convention departures may be intentional; include any known rationale and avoid assuming every deviation needs correction. Keep enforced platform boundary failures distinct from design conventions.

Give each finding a stable identifier so the human can approve a proposed correction, reject it and retain the current design, or clarify intent. A clean result means no deviations found within the stated coverage, not certification of the entire studio.

End with the report and request review. Wait for the human's response. Implement only corrections approved after the report; preserve rejected findings and clarified exceptions. Do not rewrite shared conventions to record an exception unless that change is separately approved. Follow the Working in Studio section of `AGENTS.md` when performing approved work.
