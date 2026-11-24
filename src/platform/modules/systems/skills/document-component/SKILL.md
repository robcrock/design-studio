---
name: document-component
description: "Import or document a prototype-system component with a page and live examples."
---

## Scope and input

Read the [system authoring context](../../context/authoring.md) and [component contract](../../README.md#component-pages).

Identify the target system and component. Preserve existing source, examples, and documentation. Follow the user's library rather than assuming every system uses shadcn.

## Import when needed

For shadcn components, read the target system's `components.json` and follow [Curate from libraries](../setup-design-system/references/curated-libraries.md#import-selected-components). Generate selected components through [Manual staging](../setup-design-system/references/shadcn.md#manual-staging). A `--path` override alone does not isolate theme, helper, or dependency writes. Do not run upstream initialization or preset application in the Studio checkout.

Apply the system's theme and portal requirements. Skip import when documenting an existing component.

## Create and complete documentation

1. Run `pnpm component-docs <system> <component>`. The command creates missing files and preserves existing files.
2. Fill the page's title, description, and `## When to use` section. Add other guidance only when useful.
   For generated components, use a short `source` frontmatter sentence naming the library, CLI version, and preset, with the `docs` URL alongside it. The compact Source block credits the libraries whose `components` list includes this component, so add the component's slug to the list of each library it actually comes from, and to no other. It preserves the specific upstream component docs link. Label the generator as shadcn CLI; do not infer missing versions or presets. Keep detailed adaptations in the system's setup record.
3. Add representative examples covering meaningful variants and states. Replace unfinished required-prop placeholders.
4. Keep examples unwrapped. The platform supplies the theme frame.

The system contract defines file names, exports, and documentation validation. Do not maintain a second schema here.

## Completion

Run `pnpm build`. Inspect `/systems/<system-id>/components/<component>` using the system's permanent ID, and review examples in supported color modes.

Report completed files and any missing component behavior or source material. Do not claim completion while examples contain placeholders.
