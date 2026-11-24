---
title: DialKit
description: Tune a view with live dials and save the values to its code.
order: 4.5
module: dialkit
toc: true
---

## Tune a view

Right-click a view in the prototype's navigation and choose **Add DialKit**. The DialKit panel appears in the corner of the view and walks you through the next steps. Ask your agent in chat for the dials you want, such as card spacing, corner radius, or type size. They appear in the panel as the agent adds them, in a group for each part of the design, such as Card or Buttons.

Drag the dials and the view updates as you go. The versions menu at the top of each group keeps a tuning so you can compare it with others. To start a group over, press the reset button beside it: its dials go back to the values in the code. Tuning lasts until you reload the view.

## Save it to the code

When it looks right, press **Save to code**, the save button beside the versions menu. It's greyed out until you've changed something, and turns green with a check when it's done. Each group has its own button and saves just that group. The values become the dials' new defaults in the view's code, so they stay after a reload and your agent sees them too.

If the file changed since the view loaded, Save to code stops rather than overwrite it. Wait for the view to update and press it again.

## Hide or remove it

- **Hide DialKit** in the prototype's menu, or ⌘⇧; (Ctrl+Shift+; on Windows and Linux), hides the panel to see the view on its own. Do it again to show it.
- **Remove DialKit** in the view's menu keeps the design as you tuned it and takes the dials out of the code.
- To turn DialKit off for the whole studio, switch off **DialKit** under Prototype tools in Settings. Views keep the values in their code, and the panel, menu items, and shortcut go away. Nothing in your views is rewritten, so turning it on again brings the dials back. The studio reloads itself after a few seconds.

DialKit is a building tool: published sites and views embedded in documents or canvases never show it.
