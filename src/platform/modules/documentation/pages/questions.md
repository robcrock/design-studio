---
title: Help
description: Find the next step when something is unclear or not working.
order: 8
toc: true
---

## The studio will not open. What should I do?

Open your existing studio folder in the agent app and ask it to start Studio and show the preview. If a localhost page stops loading, the local server may have stopped. Give the agent any error message.

For installation or returning to work, see [Working environment](/documentation/manual/environment).

## Where is my work?

Your studio is a folder on your computer. A preview URL does not select that folder in your agent app. Ask the agent to show the folder it is editing.

Use **⌘K / Ctrl+K** to search Studio. **⌘; / Ctrl+;** shows or hides navigation. Right-click a file-backed item to copy its link or path, reveal it in Finder, or open it in an editor where available.

## Why is a tool or artifact missing?

Its module may be disabled or uninstalled. Check **Studio settings → Modules**, or ask your agent. Disabling keeps saved content. An archived prototype remains local but is excluded from publication.

The published site omits local creation and settings controls. See [Modules & customization](/documentation/manual/customize#what-are-modules).

## Why are my changes not appearing?

Check that the file is saved and your agent is editing the folder serving this preview. Confirm the artifact and state you are viewing.

A published site needs another publication. Changing the default system does not rebuild existing prototypes. A copy marked **Rebuild needed** still requires an agent migration.

## Why does my prototype look different than expected?

Check its assigned system beneath the title. Browsing another system does not change the assignment. A view in lo-fi mode uses grayscale and handwritten type.

Give the agent the affected screen, expected appearance, and any references. Ask it to check system styles and component compatibility. See [Prototypes & systems](/documentation/manual/prototypes).

## How do I edit source?

Locally, right-click a supported document or artifact and choose **Edit source**. **⌘' / Ctrl+'** toggles source and rendering. **⌘S / Ctrl+S** saves; **Done** returns to the result. Unsaved changes require confirmation before leaving. Canvases save automatically.

**Open in editor** uses an installed code editor; otherwise Studio offers Finder as a fallback. You can also ask the agent to make the change.

## Why can I not edit something?

Published sites are for viewing. Locally, contributor identity, permissions, archive status, and artifact-specific controls determine access. Other contributors' canvases are read-only.

Ask your agent to check your identity and access rather than changing ownership. See [Personal & team use](/documentation/manual/team#who-can-change-what).

## A diagram, artifact, or link is broken. What should I provide?

Give the agent:

- The page or artifact link and the error message.
- What you were doing when it failed.
- What you expected and whether it happens again.
- A screenshot or visual annotation when useful.

Diagram errors may involve Mermaid syntax or loading. Links may need repair after deletion or moves while Studio was closed. Ask the agent to investigate while preserving your work.

## Published work is missing or outdated. What should I check?

Confirm the latest changes were published to the intended destination. Check whether the prototype, system, or artifact capability is archived or disabled. Use the published address rather than localhost.

If a direct link fails but Home opens, ask the agent to check the host's page-routing configuration. See [Publishing & Home](/documentation/manual/share).

## Can I recover an earlier version?

Ask the agent to inspect available Git history before attempting recovery. A local save is not itself a recovery snapshot, and deleted work may not have a recorded version.

For deeper investigation, the agent can consult **Context & Skills**, including [Checks and fixes](/documentation/context/platform.core/context/maintainers/checks).
