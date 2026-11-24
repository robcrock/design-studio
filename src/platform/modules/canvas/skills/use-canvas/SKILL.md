---
name: use-canvas
description: "Create or edit a Design Studio canvas containing views, diagrams, documents, notes, and arrows. Use only when Canvas is enabled."
---

# Use Canvas

This skill applies when Canvases is enabled. The [module README](../../README.md) describes rendering and storage.

- Keep embedded artifacts within the canvas's own prototype. Copy another prototype's artifact before embedding it.
- Do not store images in a canvas. Embed the working view instead.
- Prefer native Excalidraw tools for canvas composition: text for annotations, with shapes, lines, arrows, and frames as needed. Sticky notes (the `note` kind, Excalidraw's `stickynote`) are optional, not the default for screen annotations.
- To draw a flowchart, sequence, class, state or ER diagram as shapes the person can rearrange, use the `mermaid` tool. For a diagram that stays Mermaid, make a diagram artifact and embed it instead.
- A view is shown at one of its system's screens (`artifacts` lists them; the first is the default). Show a view at another screen, or the same view at several screens side by side, only when the person asks: `screen` on `create` or `update`. Keep the default size, a third of the screen, so views compare at one scale.
- Inspect the current scene before changing it. Inspect the result afterward.
- Preserve the person's arrangements. Move existing content only when the request requires it.
- Keep changes small enough to review and undo. Live tool operations support undo. External file edits may not be separate undo steps.

## Discover and use tools

Read current tool help instead of assuming argument names or defaults:

```sh
pnpm canvas help
pnpm canvas help create
```

For file operations, run `pnpm canvas <file.excalidraw> <tool> '<json>'`.

For an open local canvas, compatible browser tools can use `window.__studioCanvas`. Read its `help()` before use.

Use `describe` before and after changes. For live tools, use `context` when the request refers to the current selection or viewport.

Prefer tools over manual JSON edits. They maintain element bindings and versions. Use `point` to identify an artifact when live access supports it.

Canvas tools edit existing scenes. Create a canvas through the file menu, or use the empty-scene `template` from this module's [file-type declaration](../../type.ts) for direct authoring.

For new directly authored artifacts, preview and apply [identity assignment](../../../../context/maintainers/resource-identity.md#direct-authoring-and-verification). Preserve existing identity metadata when editing.

## Verify

Inspect the updated scene with describe, then inspect the rendered canvas and embedded artifacts. Preserve bindings and existing arrangements. Follow the platform working context for required checks and report the canvas link.
