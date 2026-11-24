---
name: use-dialkit
description: Add, tune, save, or remove DialKit dials on a Design Studio prototype view. Use only when DialKit is enabled.
---

# Use DialKit

Read the [module README](../../README.md) and the prototype build skill. Resolve the view's contributor scope and system before editing it.

When the person asks for dials on a view:

- Import `useDialKit` from `@module/dialkit`. If the view already has an empty group from **Add DialKit**, fill that one.
- Put the dials for one part of the design in one group, named for it: `const card = useDialKit('Card', { padding: [16, 8, 32, 1], radius: [8, 0, 24, 1] })`. Give every group a unique literal name.
- Keep the config an object literal in the call, or a `const` in the view's file, with literal defaults, so **Save to code** can write values back. Use DialKit's own control types ([README](https://github.com/joshpuckett/dialkit#readme)).
- Bind the returned values where the design reads them. Keep dials local to the view: don't move them into shared components or system tokens unless asked.
- Choose ranges and steps that make sense for the property, with the current design as the default.

The person tunes in the panel and presses **Save to code**; the values land in the file as new defaults. Don't save values for them unless asked. To take DialKit out, prefer **Remove DialKit** in the view's menu; by hand, replace each call with its values and remove the import.

## Verify

Open the view, check the panel lists the dials and each one changes the design, then save a change to code and confirm the file holds it. Report what you checked in the browser and what you only checked in source.
