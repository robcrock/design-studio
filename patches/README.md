# Dependency patches

Applied by pnpm on install (`patchedDependencies` in `pnpm-workspace.yaml`).

## `@excalidraw__excalidraw@0.18.0-3c916c5.patch`

Hides the link icon on canvas items. Applied to both `dist/dev` and `dist/prod`, in two places each.

**What:**

```diff
# renderLinkIcon (paints the icon), in a chunk file: dist/dev/chunk-TYJERDXG.js, dist/prod/chunk-S5GO2OD2.js
- if (element.link && !appState.selectedElementIds[element.id]) {
+ if (element.link && !appState.selectedElementIds[element.id] && !element.customData?.hideLinkIcon) {

# getElementLinkAtPosition (hit-tests the icon's spot), in dist/dev/index.js and dist/prod/index.js
- if (element.link && index >= hitElementIndex && isPointHittingLink(
+ if (element.link && !element.customData?.hideLinkIcon && index >= hitElementIndex && isPointHittingLink(
```

The files are big only because the prod build is minified onto one line, so the diff
carries that whole line.

**Why:** views on a canvas are Excalidraw `embeddable` elements whose `link` is the URL of the
item they show, so Excalidraw paints its link icon on every one. The icon is drawn on the
canvas (CSS can't hide it) and there's no option to turn it off. Hiding the icon isn't
enough: its spot still answers hovers and clicks, so hovering it showed a tooltip with the
raw URL, the cursor turned to a pointer, and clicking opened the URL. Items on a canvas set
`customData.hideLinkIcon` (`normalizeEmbeds` in `src/platform/modules/canvas/embeds.ts`),
and their title bar is the link instead.

**Upgrading Excalidraw:** pnpm refuses to install if the patch no longer applies.

1. `pnpm patch @excalidraw/excalidraw@<new-version>`
2. In the printed folder, find `renderLinkIcon` and `getElementLinkAtPosition` (`grep -l` across `dist/dev` and
   `dist/prod`; the chunk file names are hashed and change between versions) and add the condition to each.
3. `pnpm patch-commit <folder>`, delete the old patch and update the `packageExtensions` versions in
   `pnpm-workspace.yaml`. Check a canvas shows no icon and hovering a view's top-right corner shows no URL tooltip.

**Remove when** Excalidraw offers a built-in way to hide the icon.

## `packageExtensions` for Excalidraw

The Excalidraw build imports `@excalidraw/fractional-indexing` and `@excalidraw/math` from packages that don't
declare them. They resolve only when hoisted, and this repo doesn't hoist, so `pnpm-workspace.yaml` declares them.
**Remove when** Excalidraw declares them itself.
