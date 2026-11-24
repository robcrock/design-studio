# Document contract

Prototype documents are `.md` files rendered as plain Markdown, with optional frontmatter for title, description, and contents navigation. They do not execute JSX; raw HTML is displayed as text. The shared reader supplies GitHub-style Markdown, code highlighting, Mermaid fences, and same-prototype artifact embeds.

This module owns prototype Markdown. System knowledge and the Manual retain independent Markdown support when it is disabled or removed. Source access follows prototype ownership and the [shared editor contract](../../context/maintainers/source.md).

## Implementation

This optional module owns prototype Markdown. Follow the [manage-modules skill](../../skills/manage-modules/SKILL.md) for removal. See the [file-type contract](../../context/file-types.md) for extension behavior.

- `type.ts`: what the build reads: the `.md` extension, a template (a title and an empty-document line), and the checks on frontmatter.
- `open.tsx`: the icon, how a document loads, and its page.
- `src/platform/app/docs/`: the shared Markdown reader and page style. The system context uses this reader independently.
- `src/platform/node/build/rehype-mermaid.js`: preserves Mermaid fences before code highlighting. The shared reader maps them to `MermaidDiagram.tsx` for lazy SVG rendering.
- `loader.ts`: the glob of document files for the deployed site.

Agent contract: `src/platform/modules/document/skills/write-document/SKILL.md`.

Page loading follows the [shared navigation handoff](../../context/maintainers/source.md#navigation-handoff). Route loaders prepare the reader and content before replacing the current page.

File-backed Markdown readers use the [shared lifecycle contract](../../context/maintainers/source.md#artifact-revision-and-preview-lifecycle). Local compiled inputs and a DOM commit acknowledge the document revision. Nested diagrams and view embeds retain independent lifecycles. Content updates preserve document scroll; unknown revision evidence does not prevent reading.
