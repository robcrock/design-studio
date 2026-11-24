---
title: "Studio configuration"
---

`studio.config.json` holds a small set of shared choices. It is plain JSON at the top of the repository, owned by the team. Other customization happens in code, which you also own.

The starter declares personal use. Contributors & Permissions is installed but disabled until you switch to team use. Personal use gives the registered local contributor Admin access and skips team ownership checks. Build, asset, and dependency checks still apply.

## The file and its schema

The file declares its schema first: `"$schema": "./src/platform/core/studio.config.schema.json"`, then `"formatVersion": 1`, the version of the file's format ([Format versions](formats.md)). Editors that understand JSON Schema then validate the file and complete and explain each setting. The schema is a JSON Schema (draft 2020-12) whose descriptions carry the guidance for each setting.

The runtime validator, `configProblems` in `src/platform/core/config.ts`, is the source of truth for the rules, and `pnpm check` reports what it finds. A test keeps the schema's setting names, required list, enums, and limits in agreement with the validator and the `StudioConfig` type, so they cannot drift. Rules that need the filesystem, such as which modules and systems are installed, are only in the validator.

Every tool reads the file with `JSON.parse` and writes it back as a read-modify-write of the parsed object: 2-space JSON, a trailing newline, and the existing key order (`$schema` and `formatVersion` first), so a change to one setting changes only that setting's lines. A setting added for the first time goes where the schema lists it. Repeated keys, comments, and anything that is not plain JSON are refused with the file name.

## Change configuration

Open **Studio settings** from the gear icon or search while running Studio locally. Contributors can inspect settings. Admins can edit basic configuration and optional module states. Team Admins assign studio and system permissions on the local **Contributors** page. Identity and profile preferences remain in repository files.

Saving writes repository files, synchronizes module-owned agent instructions, and restarts the development server. Stale configuration or contributor snapshots are rejected: the save compares the file it read with the file on disk, so an edit made in your editor or by another tool is never overwritten. Reload settings before retrying a conflicting save. Settings and its editing API are excluded from the published viewing site.

Welcome records its first display on the resolved contributor’s profile with `preferences.onboarding.welcomeDismissed: true`. When Onboarding is enabled, every contributor must explicitly declare this boolean. Registration writes `false`. Missing declarations are validation errors. Each contributor gets the introduction independently; progress updates do not change studio settings or restart the server. See the [Onboarding contract](../modules/onboarding/README.md) for progress behavior.

You can also ask your agent to configure the studio. The configuration command previews changes before applying them. The CLI and settings API share validation, editing, assignment preservation, and module instruction synchronization.

Use `pnpm studio configure --system <id>` to preview a default-system change. Apply with `--yes` after reviewing the preview. Creation writes the chosen system ID to each prototype. Changing the default affects future prototypes; existing assignments remain unchanged.

Every prototype must declare `systemId`, including `null` for no system. Missing assignments fail validation. Migrating an existing prototype requires changing its component imports and explicit assignment together.

For manually edited module configuration, run `pnpm studio sync` to refresh agent task routes. Coordinate shared configuration changes with your Admin.

## Local roles and contributors

Studio has two local roles: Contributor and Admin. Registered people are Contributors by default. In team use, `admins` must contain at least one registered contributor ID; several Admins are supported. In personal use, the resolved local contributor is automatically an Admin. Team use requires the Contributors & Permissions module installed and enabled. Personal use can disable or remove it. Unregistered identities cannot save settings.

The settings server checks the current role before applying each save. Only existing Admins can save shared settings. The API still validates Admin assignments in its configuration payload; saving cannot remove the last team Admin. These roles guide local behavior. Admins can manage all prototypes. Contributors retain direct write access to their own folders. Per-system maintainer grants add active system editing and managed rename. Archive, restore, deletion, creation, and default selection remain Admin actions. These grants do not authenticate people or grant GitHub permissions. Existing section-specific artifact policies remain separate.

Use `pnpm studio configure --admins sam,alex --yes` to assign team Admins. Applied shared CLI changes require the current Admin. For explicitly authorized initial setup or recovery, use `configure --recovery --admins sam --yes`. This visible repository-level recovery bypass is limited to configuration and does not bypass Git review. Direct file edits remain possible.

Keep shared choices in `studio.config.json`. Contributor profiles live in `contributors/<key>.json`; `pnpm join` creates these files. Each file declares one contributor, with a permanent `studioId` and its filename as the current source key. There is no combined roster file. Profiles declare `formatVersion` (`2`), a permanent `studioId`, a nonempty `name`, plus `email` and `github` strings. An empty string explicitly means that identity is unavailable. Nonempty emails and GitHub usernames must be unique, ignoring case. When Onboarding is enabled, profiles also declare `preferences.onboarding.welcomeDismissed`. The shipped sample author's profile also declares `"sample": true`, the only way code recognizes it; the field must be `true` when present, and real contributors omit it. Other preference fields stay with the profile. Profiles do not declare authority. Use `pnpm studio configure --maintainers product=sam,alex --yes` to assign one system. Use `product=` to clear it. The command preserves other system assignments.

CLI and settings controls use current readable source keys for selection. Managed saves serialize relationships as permanent IDs. The `systems` registration list describes source locations; it is intentionally separate from `defaultSystem`, Admin IDs, and maintainer grants. Unknown IDs are errors. See [Resource identity](maintainers/resource-identity.md).

Profiles may declare `avatar`, a relative image path inside `public/`, such as `images/person.svg`. Supported extensions are SVG, PNG, JPEG, and WebP. Path segments use letters, numbers, underscores, and dashes; absolute paths, remote URLs, and traversal are rejected. The referenced file must exist. Gallery cards prefer this image over a GitHub photo.

The starter's fictional Parker Moss profile owns the shipped examples and declares `sample: true`. New users register their own identity with `pnpm join`; the sample profile is not their registration. The starter has no Admin or system maintainer grants. In personal mode, the registered local contributor has Admin access without adding a grant to shared configuration.

Upstream maintainers may keep a real profile and prototype folder excluded through `.git/info/exclude`. These ordinary local files are read by Studio but are absent from commits and clones. Exclusions are specific to the maintainer's checkout; installed team studios can commit their real contributor roster normally. Release and public-demo source checks enforce the [starter distribution policy](maintainers/releasing.md#maintainer-workspace-and-distributed-source).

## Configuration fields

| Setting | Declaration |
| --- | --- |
| `$schema` | Optional path of the JSON Schema for editors, `./src/platform/core/studio.config.schema.json`. It has no effect at run time. |
| `formatVersion` | Required version of this file's format, `1`. A missing or unknown version is a validation error. |
| `name` | Required studio name, used by the app. |
| `usage` | Required `personal` or `team`. Personal derives local Admin authority and skips team Git scope checks. Team requires Contributors & Permissions enabled and explicit Admin assignments. |
| `admins` | Unique permanent registered contributor IDs. Required and nonempty in team use; personal use derives Admin access from local identity. |
| `systemMaintainers` | Required object with every registered prototype-system permanent ID explicitly mapped to unique permanent contributor IDs. Use `[]` for unassigned systems. Studio cannot have an entry. Rename retains the entry, deletion removes it, and archiving preserves it for restoration. |
| `tagline` | Optional line on the published front page, up to 140 characters. |
| `modules` | Installed module IDs set to `true` or `false`. Every installed module needs an explicit entry; omission is invalid and never enables it. Required modules cannot be disabled. |
| `systems` | Required list of the source-folder keys of the team's own design systems, such as `["product"]`. Every installed prototype system must be listed; discovery does not register a system. Studio's own system, the platform system, is always available and is never listed: listing it is a validation error. |
| `defaultSystem` | System selected when creating a prototype without a different requested choice. Required permanent registered prototype-system ID; no alphabetical fallback. |
| `assetLimitKB` | Required. The largest file, in KB, a commit may add or change (750 in a new studio). Files tracked by Git LFS pass at any size. See [Asset Guard](assets.md#asset-guard). |

Other settings are errors, so a misspelled name is reported instead of ignored.

## The platform system

Studio's own interface is a design system with `role: 'platform'` in `src/platform/systems/studio/`. It belongs to the upstream project, so the configuration does not register it: discovery, permissions, theme generation, and the Systems pages include it whatever `systems` lists. It is identified by its role, not its folder name. It is not a prototype system, so it cannot be the default, have maintainers, or be renamed, archived, or removed. Admins can edit its files.

## Inspect setup

The agent can run `pnpm studio status --json` to inspect configuration and setup state. This report does not replace a build and review of a working prototype.

For capabilities and removal behavior, see [Module contract](/documentation/context/platform.core/context/modules).

## Team management ownership

Contributors & Permissions owns the management interface and assignment workflows. When installed, its contract is `src/platform/modules/contributors/README.md`. The platform owns profiles, central grants, settings transactions, and permission decisions. Optional management surfaces cannot disable enforcement. The public `useStudioSettings` client supports field-scoped saves with conflict detection and unsaved-change protection.

In Studio settings, switching to team use enables the installed Contributors & Permissions module. Existing Admin assignments remain. If there are none, the current registered contributor becomes the first Admin. CLI setup declares Admins and module availability explicitly.

Module preferences use the [contributor preference protocol](contributor-preferences.md), including explicit initialization before enabling modules.
