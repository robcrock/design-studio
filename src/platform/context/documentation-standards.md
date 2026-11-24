---
title: Documentation standards
description: Canonical locations, concise writing, and verification.
toc: true
---

## Ownership

Platform guidance lives in `src/platform/`; each module and system owns its README, context, and skills. Use the owner's README as the index. Browsers read those original files. Product guidance cannot relax platform boundaries.

## Author for the right reader

Code and types define implemented behavior. Document intent, consequential constraints, and decisions that code cannot explain. Give each subject one canonical source under its owner; link instead of repeating schemas, command options, or completion checklists.

The Manual is a human reference for capabilities, controls, consequences, and recovery. Technical requirements belong in owner READMEs or context; task procedures belong in skills. A capability's Manual chapter declares `module: <id>` so availability controls discovery.

## Write clearly

Use familiar words, active voice, and the actual interface labels. Distinguish requirements, defaults, examples, and unfinished behavior. Leave teams free to choose their design process. Keep dated verification results in maintainer records rather than standing instructions.

Context uses frontmatter `title` and H2 sections without a duplicate H1. Skills require `name` and `description` matching their task and folder. READMEs may begin with H1. Preserve stable filenames and incoming anchors when shortening content.

## Divide skills and code

Skills hold judgment, necessary task order, and outcome review. Reuse existing commands for mechanics. Each instruction should change a meaningful decision; link substantial conditional detail and read only relevant sources. Do not add a rule merely to memorialize one past failure.

Mermaid blocks include `accTitle` and `accDescr`; images follow [Assets](assets.md).

## Verify the result

Update affected callers with behavior changes; keep capability instructions conditional. Check links and anchors with `pnpm check:links`, and check metadata and rendered content. For a skill, walk through a matching request and a similar request outside its scope. Automated checks validate structure; they do not establish clear prose or correct live agent behavior. Report actual verification and unresolved limits.
