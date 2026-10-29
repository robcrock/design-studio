# Diagram contract

A standalone diagram is one plain Mermaid diagram in a `.mermaid` or `.mmd` file, without Markdown fences. The file-type declaration supplies its editor language and preview surfaces; the shared renderer validates syntax when opened. Invalid diagrams remain available for source repair.

The optional module owns standalone files. Markdown Mermaid fences remain a shared-reader capability when this module is disabled or removed. Follow the [file-type contract](../../context/file-types.md) for discovery, embeds, and disabled-file behavior.

## Implementation

- `module.ts`: optional module identity and agent routing.
- `type.ts`: `.mermaid` and `.mmd` extensions, plain text editing, new-file template, and document and canvas preview capabilities.
- `loader.ts`: raw source globs supplied by the shared file-type build layer; published archives are excluded.
- `load.ts`: local file reads and published source loading.
- `open.tsx`, `Diagram.tsx`, `DiagramEmbed.tsx`: page presentation, live local updates, and compact canvas previews.
- `src/platform/app/diagrams/`: shared Pele renderer for Mermaid source and its theme, independent of this optional module. Markdown maps its Mermaid fences to the same component.

The module adds a prototype file type rather than a separate rail destination. It does not add dependencies or a second renderer. Source syntax is validated when rendered, so malformed diagrams can still be opened and edited. Shared source editing supplies file permissions and conflict protection.

The shared `MermaidDiagram` component uses `pele/lazy` and implements the [artifact lifecycle contract](../../context/source.md#artifact-revision-and-preview-lifecycle) for page previews, canvas previews, and Markdown fences. Its input revision includes the supplied source, actual font families, intrinsic content width, color mode, and font/theme invalidation revision. It keeps the prior SVG while preparing a replacement, marks stale output, commits after DOM insertion, and clears output on failure. Superseded renders cannot commit. Font readiness precedes SVG measurement. Font loading events, ancestor font changes, and intrinsic width changes invalidate the render; zero-width hosts defer until reveal. CSS palette variables follow Studio tokens, and color-mode changes also redraw. Canvas transforms do not change the measured layout width. The full diagram page fits that SVG to the viewport, then zooms and pans the same SVG. Zoom scales the SVG already on the page. It does not change layout width or wrapping. Canvas previews and Markdown fences do not add zoom controls. Host policy disables links/images and icon/math resolvers, preserves source direction, and sets explicit source/edge/output limits; see [diagram defaults](../../context/diagrams.md#customize-the-defaults).
