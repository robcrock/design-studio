---
title: Personal & team use
description: Work alone or share a studio with contributors.
order: 5
toc: true
---

## What changes in team use?

New studios start in **Personal** mode. Your registered local contributor has Admin access, so you can manage the whole environment.

Switch **Studio settings → Studio use** to **Team** when you want contributor permissions. This enables Contributors & Permissions when installed. Ask your agent to install it if missing. Team studios require the module and at least one Admin.

Team mode organizes responsibility. It does not create a hosted editing service or live co-editing.

## Who can change what?

| Responsibility | Direct editing and management |
| --- | --- |
| Contributor | Their own prototypes. |
| System maintainer | Contributor access plus editing and renaming assigned active systems. |
| Admin | Shared settings, permissions, all prototypes, and system creation, defaults, archiving, restoration, and deletion. |

System maintainer is an assignment for a particular system, not a separate studio-wide role. Admins can manage systems without individual assignments.

Open **Contributors** locally to review people and assignments. Contributors can inspect the roster; Admins assign permissions. Archived systems must be restored before editing.

These permissions guide Studio and repository workflows. They do not authenticate people, grant GitHub access, or control who can view a published site.

## How does a teammate join?

Give them access to the team's repository through your Git host. Ask their agent to obtain a local copy, register their contributor identity, and open the existing studio. An Admin can then assign any additional permissions.

Each person works in their own local copy. Joining should preserve the team's systems, configuration (`studio.config.json`), and existing work. See [Working environment](/documentation/manual/environment#how-do-i-join-a-team-studio).

## How do teammates contribute safely?

Each teammate has their own contributor folder for prototypes. Your agent identifies you and keeps prototype work inside that folder. Each prototype is a separate exploration, so changing one does not change another prototype's files.

Studio checks ownership when you edit locally. Build checks prevent prototypes from depending on another prototype's code. The supplied GitHub workflow checks the build and flags changes outside a contributor's assigned scope for review.

These boundaries let teammates keep building and merging their own prototype work independently. Shared systems and platform code need broader review because other people's work depends on them. Your repository owner configures GitHub's required checks and reviews; see [Checks and fixes](/documentation/context/platform.core/context/maintainers/checks) for details.

## How do we share changes?

For a team using GitHub, we recommend protecting **main**, the shared branch, and requiring pull requests instead of direct pushes. Your repository owner configures this on GitHub, including required checks and reviews. Studio does not turn these settings on automatically.

Your agent can handle the Git work:

1. **Work on a branch.** A branch keeps your changes separate from main. The agent saves files, commits versions, and pushes the branch to GitHub.
2. **Open a pull request.** This proposes bringing your branch into main. Ask the agent to summarize the changes and check results when you are ready to share them for review. A reviewer can try the branch, editing included, without a local studio: on the pull request, choose **Code**, then **Codespaces**, and create a codespace. Studio opens in a new browser tab once it has installed.
3. **Merge when ready.** Routine prototype changes can move through quickly. Leave the request open, or mark it as a draft, when you want discussion or review. Merge it yourself when ready, or enable [GitHub auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) if your repository supports it. Auto-merge waits for required checks and reviews.
4. **Merge and update.** Merging brings the work into main. Teammates pull the changes into their local copies. If publishing is configured to run after a merge, the site updates when deployment succeeds. Otherwise, publishing is a separate step.

```mermaid
flowchart LR
  accTitle: Team changes move through a branch and pull request
  accDescr: Work stays on a branch while a pull request is reviewed and checked. Merging updates main. A configured deployment workflow can then publish the shared site.
  branch[Your branch] --> pr[Pull request]
  pr -->|Merge| main[main]
  main -->|Publish if configured| site[Viewing site]
```

Saving alone updates your local files. A commit records a local version; pushing shares it through GitHub. Neither necessarily publishes the site.

## Do prototypes need long-running branches?

No. Each prototype has its own scope, so you can merge routine changes into main frequently and keep the exploration moving. You do not need to wait until the prototype is finished. Merging records shared progress; it does not declare a design final or ready for production.

| Change | Recommended approach |
| --- | --- |
| Work inside your own prototype | Use short-lived branches. Merge and publish progress when you want, once required checks and any repository review requirements are met. |
| Shared system or platform changes | Seek review from the people responsible for the shared foundation. Check affected prototypes before merging. |

A prototype can keep evolving through many small merges. Longer review is useful when a change affects foundations others depend on.

## How do we include reviewers or engineers?

Share a published link for review. Engineers and their agents can pull the studio repository to inspect prototype source locally, with repository access.

Agree on handoff needs with your engineers. See [Publishing & Home](/documentation/manual/share#how-do-i-share-with-reviewers-and-engineers).
