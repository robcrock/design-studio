---
title: Prototypes & systems
description: Connect an exploration to its shared toolkit and knowledge.
order: 4
module: prototypes
toc: true
---

## What belongs in a prototype?

A prototype holds one exploration. Its pieces are called **artifacts**. Use the ones that help explain your idea.

| Artifact | Purpose |
| --- | --- |
| View | A working screen or state you can interact with. |
| Document | A brief, notes, decisions, or handoff, with links and previews. |
| Diagram | A flow or relationship, described in Mermaid. |
| Canvas | Sketches, annotations, and comparisons arranged together. |

Views are always available. Documents, Diagrams, and Canvases require their corresponding modules. Disabling one preserves its files but hides it from normal navigation.

## How do previews work?

Views run in their own browser document, with their assigned components, fonts, and theme. Changing color mode preserves the open view's interaction state. An already-open view stays alive while you edit its source.

While an agent changes files, the last working preview may remain visible. **Out of date** means it has not caught up with those changes. If an edit fails, give the error to your agent; source editing remains available. Repairing the files updates the preview.

Ordinary edits preserve interaction state when possible. Opening another artifact or reloading can reset it. Live previews retained offscreen on a canvas continue updating; previews released to save memory start fresh when you return.

Canvas and document previews are pictures of the working view. Open the original to interact with it.

Preview separation contains styles and overlays. It does not make untrusted prototype code safe to run.

## What belongs in a system?

A system supplies the shared foundation for multiple prototypes.

| Part | Contains |
| --- | --- |
| Theme | Colors, typography, spacing, and other visual choices. |
| Components | Reusable interface pieces with live examples. |
| Assets | Fonts, icons, logos, and images. |
| Libraries | What the system is built from: component sources, icons, fonts, and tools such as charts. |
| Context | Audience, goals, research, principles, and standards. |
| Skills | Instructions for recurring agent tasks. |

Keep reusable knowledge in the system's **Context**. Keep an exploration's brief, decisions, and open questions with its prototype. Ask the agent to update existing guidance rather than duplicate it.

System pop-ups stay inside their themed container, including when a view is embedded. Shared runtime helpers connect system overlays to their host.

Product and Marketing are starter examples. **Studio**, marked **Platform**, powers the application itself and is unavailable for prototypes.

Open **Libraries** in a system to see its sources, libraries, versions, and documentation. Ask your agent to add a library when needed. It can use more of that library's capabilities without importing every component first. Adding a library to one system does not make it available to another.

## How do I create a prototype?

Ask your agent, describing the goal and system. Or select **New prototype**, enter a title, and choose a system. The interface creates starting files; your agent builds the intended experience.

New views show **This view is empty** until a component is implemented. Locally, **Copy prompt** includes the view's source path for your agent. Published views show the explanation without local source controls.

The assigned system appears beneath the prototype title. Browsing another system does not change it. **No system — custom styling** uses local components and styles.

The prototype keeps all its artifacts together, but they do not all use the product system to render. Views use its runtime toolkit. Documents, diagrams and canvas scenes use their own readers; embedded views keep their own system dependency.

Changing the default in Studio settings affects new prototypes and preserves existing assignments. Changes to a shared system's components or styles can affect every prototype using it.

## How do I bring in my own system?

Ask your agent to assess or create one. Supply your component source or package, theme, fonts and assets, usage examples, and relevant product knowledge.

| Starting point | What to expect |
| --- | --- |
| shadcn/ui | The agent can curate a toolkit and Tailwind theme around your needs. |
| Your own React components | Assess styling, dependencies, and needed adaptations before importing. |
| Another framework or application-dependent code | Assess feasibility and migration effort first; engineering help may be useful. |
| Visual references | Guide appearance; they do not supply your production components. |

Try representative screens before relying on an imported system. Components tied to a backend or application shell may need simulated behavior or replacement dependencies.

To start in the interface, select **New system**. Overview offers **Curate from shadcn** and **Bring your own**. Creating systems requires local Admin access.

Choose a starting point, describe your inputs, then select **Copy prompt**. Paste the prompt into your agent’s chat and send it to begin. For a curated system, answer **What do you want to build?** to help the agent choose the first components. You can also name any components you already want. The agent asks for files in chat as needed. For shadcn, bring a preset from its builder, a DESIGN.md link or file path, or both. DESIGN.md provides your design direction; the agent translates it into the theme and component styling. The agent saves your decisions in system Context, integrates the selected material, and opens foundations and component examples for review. Follow setup in your agent’s chat. Overview shows the growing toolkit and its prototypes.

For existing code, give your agent an accessible React repository, folder, or package. It assesses compatibility and proposes stages before importing. You can resume from the saved assessment in system Context. Populated systems that have not started setup also offer **Curate or bring in a system**.

## How do I organize artifacts?

Use **+** in navigation to add artifacts or folders. Drag to move or reorder them. The first available artifact is where the prototype opens.

Right-click an item for file actions. Shared links use permanent prototype and artifact IDs, so renaming or moving a file within its prototype preserves that link. Navigation continues to reflect the actual filenames and folders.

Imports, relative document links, and assets still depend on file locations. Studio repairs known source references and embeds when files move within a prototype. Moves in your editor or Finder need Studio running for repair. Deleted targets, moves while Studio is closed, and dynamically built links may need the agent's help.

## How do supporting artifacts connect?

**Documents** use Markdown and can preview artifacts from the same prototype. Mermaid diagrams can also appear inside a document without the standalone Diagrams module. Documents and diagrams use Studio's reading style.

**Diagrams** open fitted to the page. Use **Zoom in**, **Zoom out**, and **Fit diagram**, or scroll and drag, to read a large diagram. A canvas preview of that diagram stays fitted, because the canvas has its own zoom.

**Canvases** use Excalidraw. Use the native toolbar tools to draw, connect, and annotate; press **T** for text. The Library offers optional reusable assets, including an example sticky note. Drag an artifact from navigation onto the canvas, or copy its link and paste over the canvas.

View and diagram previews follow their source. Documents and other canvases appear as link cards. Open the original to interact or edit. Canvas annotations do not automatically change screens.

Canvases embed artifacts from their own prototype and cannot store images. Changes save automatically locally. Other contributors' and published canvases are read-only. Importing **Mermaid to Excalidraw** creates independent shapes, not a synchronized diagram.

## Can I try a different appearance or system?

Right-click a view and choose **Make lo-fi** for grayscale and handwritten type. **Make hi-fi** restores normal appearance.

To try another system, choose **Duplicate** and select the target system. This creates a rebuild copy and preserves the original. Use **Copy rebuild instructions** in the copy's sidebar and give them to your agent. The copy keeps its current system until the agent migrates and verifies it; duplication does not convert code automatically.

## What do archive and delete do?

Use the prototype or system's **…** menu. Permissions determine available actions.

| Action | Prototype | System |
| --- | --- | --- |
| Rename | Updates its title, folder, and known references. | Updates its name, folder, and known references. |
| Archive | Keeps work locally; excludes it from publication. | Also archives associated active prototypes. |
| Restore | Makes work active again. | Can also restore prototypes archived with it. |
| Delete | Permanently removes the prototype. | Removes system files; associated prototype source remains but needs another system and a rebuild. |

Restore archived work before routine editing. Choose another default before archiving or deleting the default system. Studio keeps no recovery copy for deletion; ask the agent to check available version history before removing work you may need.

If an assigned system is deleted, you can still read documents, diagrams and canvas scenes locally. Its views show rebuild guidance, and source remains available. The whole prototype stays out of publication until its system-dependent implementation has been rebuilt. Preserve supporting thinking documents when migrating to another system.
