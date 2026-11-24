# DialKit contract

An optional module for tuning a prototype view with [DialKit](https://github.com/joshpuckett/dialkit)'s live dials, then writing the tuned values into the view's code. It works with system and no-system prototypes. Its registered ID is `dialkit`; it appears as **DialKit** under Prototype tools in Studio settings.

## In a view

A view imports `useDialKit` from `@module/dialkit`. It is DialKit's own hook, re-exported, so the config, controls, and returned values are DialKit's ([README](https://github.com/joshpuckett/dialkit#readme)). A view taken out of Studio keeps working by importing it from `dialkit` and rendering DialKit's `<DialRoot />`.

Save to code and Remove rewrite the config in source, so they need:

- each group named by a unique string literal: `useDialKit('Card', { … })`;
- the config written as an object literal in the call, or in a `const` in the same file;
- each dial's default written as a literal: a number, `[default, min, max, step]`, a boolean, a string, or a typed control object.

Anything else fails with a message naming the dial, and nothing is written.

## Surfaces

- **Panel.** The library loads DialKit's panel only in a local Studio's view preview (`data-preview-surface="page"` on the preview document; [View contract](../view/README.md)). Published sites, document and canvas embeds, and production builds get the hook's values with no panel. Studio builds the panel from DialKit's own parts (`Folder`, `ControlRenderer`, `PresetManager`) in DialKit's several-group layout, so it is always titled DialKit and every group, even a lone one, is a section under that title. Each group's first row holds DialKit's versions menu, a reset button (DialKit's `resetValues`, back to the code's values, enabled only when the group differs from them; it reads DialKit's private defaults for that and stays enabled if they move), and **Save to code** (the save icon, also greyed out until the group differs from the code) where DialKit has Copy parameters; until any group has dials (as right after **Add DialKit**), the panel shows how to start in place of the groups, and later a group without dials says so. The panel drags by its header, or as the collapsed button, as DialKit's own does. Where a drag ends, it anchors to the nearest corner of the window, opens away from it and collapses back into it, so the button returns to where it was left; fitting the open panel inside the window never moves that spot; DialKit's keyboard shortcuts for individual dials aren't available in this panel. DialKit's versions are unchanged; tuning and versions stay in memory until reload.
- **Save to code** writes its group's current values in the open view as their new defaults; each group has its own, and only the one pressed shows a check when it has written. One write runs at a time. It reads the file, prepares the new source through this module's `transform` route, and saves it with Studio's version-checked source write, so a file changed in the meantime is refused, not overwritten. Uploaded images can't be saved to code; pick one of the image control's options instead.
- **Add DialKit** and **Remove DialKit** are in a view's file-tree menu (`ModuleApp.artifactActions`). Add imports the hook and starts an empty group at the top of the view's component for the agent to fill. Remove replaces each group with a plain object of its values, using the open preview's live values when the view is open, and removes the import and any config constant only the hook used. Which one shows comes from `build.ts`, which lists the views that import the library.
- **Hide DialKit / Show DialKit** is in the open prototype's menu while any of its views uses DialKit, and on ⌘⇧; (Ctrl+Shift+; elsewhere) in the app or the preview. The choice is remembered in this browser.

## Implementation

- `lib/index.tsx`: the public hook; loads `lib/panel.tsx` in a local view preview.
- `lib/panel.tsx`: DialKit's panel, Save to code, the shortcut, and live values for Remove.
- `lib/shared.ts`: the hidden setting, the shortcut, and the same-origin channel between the app and a preview.
- `node/source.ts`: the pure Add, Save to code (`apply`), and Remove source transforms, tested in `source.test.ts`; `server.ts` serves them. Neither reads or writes files.
- `app.tsx`: menu actions and the toast for a failed Save to code. `build.ts`: the views that use DialKit.

## Checking the panel

There is no automated browser check for the panel. After changing it, or upgrading `dialkit` or `motion`, build a throwaway prototype with one view per state below, check it in light and dark, then delete it. In the Design Studio repository, the sample Echo app overview and Echo website home show DialKit in ordinary use, but not these edge states; studios that removed the samples rely on the throwaway prototype alone.

| View | Check |
| --- | --- |
| No DialKit | **Add DialKit** inserts an empty group and shows the "DialKit added" toast. The panel shows the getting-started steps, not a group, with the same spacing as a group. |
| One group with a few dials | Titled DialKit, with the group as a section. Reset and Save to code start greyed out; changing a dial enables both. Save to code turns green with a check, writes the file, and greys out again. Reset returns to the code's values. |
| Two groups | Same layout and spacing as one group. Each group's reset and Save to code affect only that group. |
| One group with dials, one empty | The empty group says it has no dials yet. Both open and close. |
| Many dials, with nested folders | The panel scrolls. Group headings sit above nested folder headings. Folders open and close with an animation. |

In every state, also check that dragging stops at each window edge, after hiding and showing the panel (⌘⇧;) too; that the collapsed button returns where it was left in each corner; and that no stale-preview notice flashes after Save to code. These rely on DialKit details that a release could change: its private `defaultValues`, its several-group layout, and the class names the panel's stylesheet overrides.

`dialkit` and its `motion` peer are root dependencies. The panel loads DialKit's stylesheet, which the import guard allows for a module library because the package scopes it; repository CSS in module libraries and prototypes stays modular.

Disable or remove the module with the standard [module commands](../../context/modules.md#configuration-and-commands), even while views use it:

- **Off:** `@module/dialkit` resolves to `lib/off.ts`, DialKit's own hook with no panel, so views render the values in their code, as on a published site. The panel, menu actions, and shortcut are gone; nothing is rewritten, so turning DialKit on again restores the dials.
- **Removed:** `detach.ts` runs Remove (`removeDials`) on every view that uses DialKit before the module is deleted, so each keeps its dials' default values as plain constants. A view Remove can't handle stops the removal with nothing changed.
