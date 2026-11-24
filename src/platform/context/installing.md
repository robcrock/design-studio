---
title: Install Design Studio
description: Install a local studio, open it in your agent harness, and start working with your agent.
toc: true
---

Design Studio lives in an ordinary folder on your computer. Install it once, then open that folder in your preferred agent harness. A GitHub account is not required for local use.

These are the installation steps for both you and your agent. If you want your agent to handle them, use a session that can create files and run commands on your computer and ask:

> Install Design Studio from release v0.4.0 using https://github.com/itspatmorgan/design-studio/blob/v0.4.0/src/platform/context/installing.md. Use the repository installation guide without a plugin installer. Help me choose a folder, preserve existing files, and verify the running preview. Then help me open the Design Studio folder in my agent harness.

## 1. Prepare your computer

Your chosen agent harness may require its own account or subscription. Studio itself requires no GitHub account for local use.

Install [Git](https://git-scm.com/downloads) and [mise](https://mise.jdx.dev/getting-started.html) if you do not already have them. Git downloads Studio; mise installs the Node.js and pnpm versions the project declares.

## 2. Create your studio folder

Open a terminal in the folder where you keep your projects. Run:

```sh
git clone --filter=blob:none --branch v0.4.0 https://github.com/itspatmorgan/design-studio.git design-studio
cd design-studio
git remote rename origin upstream
git switch -c main
```

Design Studio is installed in the `design-studio` folder. You can choose a different name. If the folder already exists, choose another name or open the existing studio; do not replace its files.

These commands install release `v0.4.0` and preserve the history needed for future updates.

## 3. Install dependencies and open the preview

From inside your studio folder, run:

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

If mise asks you to trust the project's tool configuration, review `mise.toml` before accepting. Open the local address printed by the server. Keep that terminal running while you use Studio.

You can explore the examples before configuring anything. The browser shows your studio; the working files stay in `design-studio`.

## 4. Open the folder in your agent harness

Open the `design-studio` folder as your agent harness's project or workspace. Use a coding agent that can read files and run commands in that folder. Opening the browser preview alone does not select the folder for your agent.

Codex, Claude Code, and Cursor use the same owned folder and commands:

| Harness | Open the studio | Repository instructions |
| --- | --- | --- |
| Codex | Open the folder as a Codex project, or run `codex` from it. | `AGENTS.md` and generated `.agents/skills/` adapters. |
| Claude Code | Run `claude` from the folder. | `CLAUDE.md` imports `AGENTS.md`; generated `.claude/skills/` adapters link to the canonical procedures. |
| Cursor | Open the folder in Cursor, then use Agent with that workspace selected. | `AGENTS.md` and generated `.agents/skills/` adapters. |

Ask:

> Read AGENTS.md and help me configure my Design Studio. Start with the included examples and show me the running preview.

Your agent follows the repository's instructions to register you and configure Studio. Agent harnesses that do not automatically discover project instructions can still use them when you ask the agent to read `AGENTS.md`. Keep the included examples until you decide what to customize.

## Keep your own repository and choose when to update

You can keep Design Studio in your own private or company repository. You control access to your copy; the Design Studio project does not need access to it. Ask your agent:

> Help me put this Design Studio in my own private or company repository. Preserve my work and keep it ready to receive future Studio releases.

Updates are your choice. New Studio releases do not change your copy automatically. When you want to update, ask:

> Check for Design Studio updates and show me what would change before applying them.

Your agent handles the Git details and helps you review the update before you take it. See [Ownership and updates](ownership.md#updating-a-studio) for the technical procedure.

## Return to your studio

Open the same folder in your agent harness and ask:

> Open my Design Studio and show me the running preview.

To start it yourself, run `mise exec -- pnpm dev` from that folder. If installation or startup fails, share the command and its error with your agent and ask it to diagnose the existing folder. An interrupted clone that is not a valid checkout should be preserved while you choose a new destination. If cloning completed, resume inside that folder: inspect `git status`, rerun `mise install` and `mise exec -- pnpm install --frozen-lockfile`, then start the preview. Do not delete files, clone over the folder, reset configuration, or register the same person again to recover a dependency or startup failure.

See the [Manual](../modules/documentation/pages/index.md) for using Studio. When you are ready to share a viewing site, ask your agent to follow [Publishing](publishing.md). Installation does not publish your work.

## For the agent performing installation

Confirm the destination and where that filesystem lives before creating files. Preserve existing studios and confirmed choices. Follow the commands above using the person's supported tools; do not install a plugin or use plugin bootstrap tooling for this path.

After cloning, read the installed repository's `AGENTS.md` and linked guidance. Verify the release ancestry, local `main` branch, and `upstream` remote. For revision tracking, see [Ownership and updates](ownership.md#the-installed-release).

Verify the actual local preview and report the absolute studio path. Help the person open that folder in their agent harness; distinguish instructions to open it from a verified workspace handoff. Use [Configure Studio](../skills/configure-studio/SKILL.md) when they request configuration. Installation alone does not authorize creating a hosted repository, pushing, or publishing.
