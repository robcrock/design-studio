---
name: create-diagram
description: "Create or edit standalone Mermaid diagrams in a Design Studio prototype. Use only when Diagrams is enabled."
---

# Create Diagram

This skill applies to standalone prototype diagrams when Diagrams is enabled. Read the [module README](../../README.md) for file and rendering behavior.

- Use a `.mermaid` file by default. Existing `.mmd` files work too.
- Write plain Mermaid source without Markdown fences. One file holds one diagram.
- Choose the diagram type for the relationship and the intended audience. Use standard Mermaid syntax; the platform does not restrict authors to a subset of diagram types.
- Include `accTitle` and `accDescr` where the diagram type supports them.
- Keep prototype diagrams inside that prototype, outside underscore helpers. No registration is needed.
- Use Mermaid fences inside documents when a diagram belongs with an explanation. Use a standalone file when it needs its own navigation entry or canvas preview.
- Link to standalone diagrams using relative paths with their file extensions. In a prototype document, use `![Description](./flow.mermaid)` on its own line for a live embed with an Open diagram link. Keep the referenced file in the same prototype.
- Reuse platform theme defaults. Apply explicit diagram colors only when they carry meaning, and check both light and dark modes.
- To transfer a diagram to Excalidraw, use its existing Mermaid import. The imported canvas is a separate artifact; later source edits do not synchronize it.
- Apply the [contributor scope](../../../../context/contributor-scope.md) before editing prototype files.

Write the source directly. The local app discovers new files and reflects edits. Invalid syntax is shown as a render error. Inspect and repair it through the file menu’s Edit source action.

For new directly authored artifacts, preview and apply [identity assignment](../../../../context/resource-identity.md#direct-authoring-and-verification). Preserve existing identity metadata when editing.

## Verify

Inspect the rendered artifact, its links, and any embeds. Open the diagram page for a large diagram: it starts fitted to the page, and zoom and pan read it without changing the source. Repair reported rendering errors and follow platform working context for required checks. Report the artifact link and unresolved content.
