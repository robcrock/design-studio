---
title: Modules & customization
description: Adapt your toolkit, settings, and studio capabilities.
order: 7
toc: true
---

## Where should I start?

Your own design system is usually the most useful customization. Bring in your components, theme, assets, and product knowledge so prototypes reflect your team. See [bringing in a system](/documentation/manual/prototypes#how-do-i-bring-in-my-own-system).

Choose the scope that matches the change:

| You want to change… | Change… | Affects… |
| --- | --- | --- |
| One exploration's appearance or behavior | Its prototype. | That exploration. |
| Reusable styles, components, or knowledge | A system. | Prototypes using it. |
| Name, defaults, or enabled capabilities | Studio settings. | The shared environment. |
| Add a distinct tool or section | A module where practical. | The studio using it. |
| Core interface or behavior | Platform code. | The shared application. |

You own the code. Ask your agent to explain the scope and make the result reviewable before adopting a shared change.

## How do I change settings?

Open **Studio settings** from the local gear icon or search. Registered contributors can view settings; Admins can edit them.

**General** controls the name, tagline, personal or team use, default system, and the largest file size a commit may add (750 KB in a new studio; see [large files](/documentation/context/platform.core/context/assets#large-files)). **Modules** controls installed optional capabilities. Changing the default through settings preserves existing prototype assignments.

Choose **Save changes** to save locally and restart Studio with the new configuration. **Discard** resets unsaved edits. If settings changed elsewhere while you were editing, reload before retrying the save.

Settings live in `studio.config.json` at the top of your project, a plain JSON file your team owns. Saving from Studio settings changes only the fields you edited, and editors that understand JSON Schema validate and complete the file. Your own design systems are listed there; Studio's own system is always available and is not listed.

Saving settings does not share or publish them. See [Personal & team use](/documentation/manual/team) for permissions and shared changes.
## What are modules?

Modules add capabilities such as Documents, Diagrams, and Canvases. Open **Studio settings → Modules** to enable or disable installed optional modules. Required capabilities remain enabled.

Disabling a module keeps its files and content, but hides its normal tools and navigation. Re-enabling makes supported content available again. Team use requires Contributors & Permissions.

Installing or removing a module is a separate agent task. Ask what will happen to its content before removal; removal can delete capability code and, when explicitly requested, associated content.

## Can my agent add a feature?

Yes. Describe what you need and ask the agent to assess whether a module fits. A module groups its code in its own folder and connects to Studio only through Studio's public API, so platform updates are less likely to break it. Each module also names the oldest Studio version it works with; Studio turns off a module that needs a newer one and says why.

For example, you might ask for a new review tool or artifact type. Ask for a proposal that explains the inputs, interface, affected parts, and how the result will be checked.

Modules run inside the application; they are not a protective sandbox. A faulty module can still affect Studio. Your agent can use the [module contracts](/documentation/context/platform.core/context/modules).

Studio checks which environment a feature runs in: the browser application, local Node tooling, or prototype runtime. Those environments have different public APIs. Checks follow helper imports too, so moving incompatible code into another file does not make it available. Ask your agent to use the [API environment policy](/documentation/context/platform.core/context/modules#environment-policy) when resolving an import error.

## How do I update my studio?

New versions of Design Studio come out as numbered releases, such as 0.2.1. Your studio doesn't change on its own: you choose when to take a release, and your work stays yours.

Ask your agent to review a chosen release on a separate Git branch. It will preserve your current work, inspect the release notes and merge, reconcile conflicts and dependencies, then verify the studio before you adopt the branch.

Upgrades use ordinary Git. Your agent must review changes to prototypes, contributors, systems, settings, and modules even when Git merges them without a conflict; there is no automatic preservation policy. Keep a saved revision so you can review or undo the upgrade. See [manual upgrade guidance](/documentation/context/platform.core/context/ownership#updating-a-studio).

## Where do I add guidance for my agent?

Add your team's conventions and product context to `AGENTS.team.md` in the studio's root. `AGENTS.md` is generated from Studio's own instructions, the modules you have turned on, and your file, so don't edit it directly; ask your agent to run `pnpm studio sync` after you change the sources. Guidance that applies to one design system belongs in that system's own context.
