---
title: Community contributions
description: How maintainers triage, adapt, release, and acknowledge a community contribution to upstream Design Studio.
toc: true
---

People report bugs and propose changes through an issue, as [Contributing](../../../../CONTRIBUTING.md) describes. This guide is for upstream maintainers and the agents working for them. The maintainer decides whether to accept a contribution, approves changes to the contributor's design, and approves anything sent to the contributor or posted publicly. An agent may prepare each of these; it does not send or post them on its own.

## Triage an issue

Triage every new issue, bug or proposal, before anyone builds on it. Judge the idea before the code: read [Principles](../principles.md) and [Personas](../personas.md), and find the owner (platform, module, or system).

See the problem first, in the running app rather than in the source:

- **Bug**: on current `main`, install, start `pnpm dev`, and follow the reporter's steps in a browser. A bug counts once it reproduces there; if it doesn't, try the reporter's version before calling it fixed.
- **Proposal**: show the gap on `main`. If the reporter linked a branch, run it too and try their own checks.
- Capture what you saw: a screenshot of the failure, or a short recording for an interaction, and attach it to the brief.

Decide one of three outcomes:

- **Now**: a reproducible bug, or a change that unblocks current work. It goes into the current queue.
- **Later**: the problem is worth solving, but not before current work, or the right approach is still open. Keep the issue open and track it with the maintainers' other work.
- **Close**: already fixed, a duplicate, or outside Design Studio's direction. Say why, point to the fix or an alternative such as a team module, and close it as completed, duplicate, or not planned.

Separate the problem from the proposed implementation. A good problem with the wrong mechanism is **Later** or **Now** with the idea accepted and the branch not, never a reason to close.

An agent may draft a brief for the maintainer. Keep each answer to a line or two, and say what you ran and what you only read:

1. **Problem**: who hits it, and what you saw when you reproduced it, with the capture.
2. **Proposal**: what the reporter suggests or built, and its size.
3. **Fit**: which principles it supports or strains, and the owner it belongs to.
4. **Options**: the alternatives considered, including doing nothing.
5. **Recommendation**: Now, Later, or Close, with the reason, and whether to take the idea, the branch, or both.
6. **Decision needed**: what the maintainer must confirm, and a draft reply to the reporter.

After the decision, reply once on the issue with the outcome and the next step. Bring accepted work in as described below, either as proposed or with the maintainer bringing the implementation to standard. Choose the second when the remaining work is about platform fit, which a first-time contributor cannot be expected to know, rather than starting a long review round.

## Bring the work in

A contributor may be unable to open a pull request. Fetch their branch, apply their commits to a maintainer branch with authorship intact, and open the pull request from there. Add maintainer changes as separate commits on top.

Name the issue as "Fixes #N" so merging closes it, and describe the contributor's branch in plain text without mentioning them. They hear from you once, at release, rather than through every intermediate review step.

## Bring it to standard

Review the contribution as code the project will own:

- Use it the way people will: each input it touches (mouse, trackpad, touch, keyboard) and each supported browser, including Safari.
- Match the patterns and visual language of comparable features, so it reads as part of the platform.
- Keep ownership boundaries explicit, with an opt-in where only one owner needs the behavior, and update tests, owner READMEs, context, skills, and the Manual it affects.
- Verify against the contributor's own examples and checks. Keep added sample content only when it serves the starter.

Record each change to the contributor's design and its reason; the closing reply needs them.

## Merge and release

Merge with a merge commit so the contributor's commits keep their authorship; a squash merge would reassign them. Add a changelog line ending "Thanks @handle." so the credit reaches the release notes. Release through [Releasing](releasing.md); a self-contained contribution can ship as its own patch release.

## Close the loop

When the release is published, reply on the contributor's issue, which the merge already closed. Keep the reply short: thanks, links to the release and pull request, and a plain list of what changed from their proposal and why.

A reply an agent posts for the maintainer begins with a label line, such as "_Posted by Claude on behalf of Patrick._", so the contributor knows who wrote it.

Public acknowledgement, such as a social post with a demo, belongs to the maintainer. An agent may record a demo and draft copy but does not post or tag anyone.
