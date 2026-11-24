---
title: Resource identity foundation
description: Permanent source identities, filesystem parity, relationship resolution, authority, and explicit assignment.
toc: true
---

Format adapters belong to their modules: View's leading comments, Diagrams' Mermaid comments, and Canvas's JSON declaration. Generic platform identity operations use the adapter declared by each file type. The platform owns ID validation, unambiguous declaration validation, Markdown frontmatter, and generic JSON metadata.

Design Studio uses source identities independent of location, ownership, and naming.

## Identity guarantees

Prototype and system public routes use permanent IDs. Source metadata, assignments, ownership, default selection, archive/rebuild relationships, and central grants persist IDs. Browser and Node readers resolve them to current source locations without a mutable-name fallback. Reads, builds, and ordinary saves never invent identities.

Creation and duplication allocate identities explicitly. Copies remap their own permanent references; renames and moves retain identity and preserve supported filesystem dependency repair. Builds reject missing, malformed, and duplicate identities, including archived resources and disabled installed file types. Source writes and Git checks protect retained identities and ownership.

Directly authored prototype files use a scoped assignment command with a read-only preview. It preserves existing identities and refuses malformed metadata or unresolved relationships.

## Objective

Every prototype, prototype artifact, system, and contributor receives a permanent identity. Location identifies the current source files. Ownership and grants describe authority. Naming remains meaningful to people without controlling permanent identity.

Prototypes and systems remain the two principal collections. Prototype artifacts belong to their prototype. System contents remain identified by meaningful names and relative paths within their system. Components, system documents, skills, fixed surfaces, helpers, and assets do not receive generated child IDs.

## Source identity

The identity format is sixteen lowercase Crockford base32 characters. The alphabet is `0123456789abcdefghjkmnpqrstvwxyz`. Ten cryptographically random bytes provide 80 bits, encoded without truncating a UUID or deriving identity from content, name, time, or owner.

Validation detects duplicates in the retained inventory, including archived work and disabled installed file types. Identity is not authentication or access control.

`src/platform/core/resourceIdentity.ts` owns the format and metadata mechanics. File-type declarations expose their adapter through `FileTypeSpec.identity`.

| Resource | Identity metadata |
| --- | --- |
| Contributor | `studioId` in its profile JSON. |
| Prototype | `studioId` in `meta.json`. |
| System | `studioId` in `system.ts`. |
| React artifact | Leading `/** @studio-id <id> */` comment. |
| Markdown artifact | Top-level `studioId` in frontmatter. |
| Diagram artifact | Leading `%% @studio-id <id>` comment. |
| Canvas artifact | Top-level `studioId` in the scene JSON. |

Creation and explicit assignment supply identity. Reading, normal saves, and builds do not invent it. Invalid or duplicate declarations require an actionable error rather than silent replacement. Duplication deliberately creates a new identity and remaps copied internal identity references; ordinary edits preserve it.

## Filesystem parity and dependency integrity

Prototype navigation faithfully reflects actual files and folders. Labels retain existing filename formatting conventions. A Studio rename or move changes the filesystem. External changes appear in Studio. Prototype renaming retains its coordinated title and directory behavior. No independent artifact display-name field is introduced.

Permanent browser routes supplement existing reference repair. Relative imports, Markdown links, assets, and other supported file dependencies still resolve through actual locations. Rename and move operations continue repairing them and reporting unresolved references. A successful identity lookup does not demonstrate dependency integrity.

An artifact may move between folders in its prototype without changing its ID or permanent route. Moving an identified artifact into another prototype is rejected: it would change containment and its parent route. Cross-prototype transfer policy is deferred.

## Routes and generated resolution

Prototype routes are:

```text
/prototypes
/prototypes/<prototype-id>
/prototypes/<prototype-id>/artifacts/<artifact-id>
```

The prototype address redirects to its first available artifact’s nested permanent address, replacing the entry in browser history. The address bar therefore identifies the displayed artifact when copied. An empty prototype stays at its prototype address. Source editing retains `?mode=source`, and the redirect preserves that mode and any fragment. Names and hierarchy remain visible in navigation, rather than duplicated in the canonical URL.

System routes use `/systems/<system-id>` followed by existing surface names or system-relative resource identifiers, such as `/colors`, `/components/button`, `/context/principles`, and `/skills/build-flow/SKILL`. Exposed system names and paths remain deliberate dependency contracts. Structural changes identify affected imports, browser links, documentation, and skills; supported repairs and checks remain required.

The generated manifest resolves identities to current locations and relationships. It is a derived inventory, not another authoring location. Browser and Node resolution share types and rules. Published lookup preserves lazy artifact loading and excludes unavailable publication content. Unknown identities must not become filesystem paths or silently resolve to another resource.

The resolution flow keeps the authoring tree visible while public references use identity:

```mermaid
flowchart LR
  URL[Permanent prototype and artifact URL] --> Lookup[Generated identity inventory]
  Lookup --> Prototype[Prototype ID]
  Prototype --> Artifact[Artifact ID within prototype]
  Prototype --> Folder[Current contributor and prototype folder]
  Artifact --> File[Current relative file path]
  Folder --> Tree[Filesystem navigation and dependency repair]
  File --> Tree
  Prototype --> Owner[Owner contributor ID]
  Owner --> Grants[Explicit authority checks]
  Prototype --> System[Assigned system ID]
  System --> SystemFolder[Current system folder]
  SystemFolder --> Contracts[Named system surfaces and dependency paths]
```

Readable routes have no compatibility aliases. Stored references use permanent URLs. Copied permanent URLs resolve independently of browser history state. Hosting must continue serving the app fallback for direct routes and configured base paths. See [Publishing](../publishing.md).

## Ownership and authority

Prototype metadata declares `ownerContributorId` and a required `systemId` (or `null` for no system). The configured default is used only at creation, which writes the chosen ID. Rebuild requests declare `sourcePrototypeId` and `targetSystemId`; archive provenance uses `archivedBySystemId`, and deleted-system markers use `systemMissing.systemId`. Runtime lookup rejects missing assignments and obsolete field names. Existing contributor folders remain the supported source organization convention, with validation requiring owner and location to agree. Filesystem movement does not silently grant ownership.

Admin and system maintainer grants, system assignments, archive provenance, and rebuild source/target relationships refer to permanent identities. `resourceReferences.ts` supplies a strict, read-only projection from persisted IDs to current source selectors and the inverse serializer for managed mutations. Unknown, malformed, duplicate, or wrong-kind identities fail resolution. Runtime readers use that projection; CI resolves grants against the before-side Git tree. Readable source keys remain distinct from those identities. Local operations, CLI inspection, agent guidance, and CI must interpret authority consistently and evaluate proposed authority changes against existing authority.

Identity is not web authentication or filesystem isolation. Runtime dependency boundaries remain independent of human authority.

`readPersistedStudioConfig` supplies a fresh strict Node reader with separate persisted declarations and resolved source selectors. The Vite resource-directory plugin supplies only contributor and system ID/location mappings, excluding names, emails, and profile preferences. The browser projects persisted configuration through that directory; the generated directory itself does not evaluate grants.

## Explicit identity operations

Run `pnpm studio identity-audit --json` to inspect current identity declarations, missing metadata, and malformed or duplicate identities. The audit includes archived prototypes and file types retained in installed modules even when disabled. It excludes prototype helpers and does not assign identities, generate a manifest, repair references, or change authority.

The audit scope is contributor profiles, system declarations, and contributor-owned prototype trees. Custom module-owned prototype-shaped sections retain their own identity and ownership contracts.

The public foundation uses the current permanent identity and relationship declarations exclusively. There is no bulk pre-release conversion command or historical format reader. Preserve an older pilot's original files and perform any one-time conversion separately in an isolated copy using reviewed historical tooling before transferring its work into the current foundation.

Installed systems require a valid `studioId` for runtime resolution. Uninstalled package/scaffold declarations can omit it; installation allocates the instance identity. Plain-data declarations reject duplicate properties at every level, including duplicate identity and permission keys.

## Direct authoring and verification

Authoring tools assign missing identities to prototype artifact files created directly: the running dev server does it as files appear or lose their identity in a rewrite, and `pnpm canvas` does it for its own prototype. Reads, builds, and checks never assign IDs. Without an authoring tool, run `pnpm studio identify src/prototypes/<contributor>/<prototype> --json` for a preview, then `--yes`. All three share one assignment. Existing IDs and declared ownership remain unchanged. The prototype must already declare its `systemId`; assignment never infers it. Only the owner or an existing Admin can assign, so the dev server leaves other contributors' prototypes alone. Assignment covers the prototype's missing ID/owner when needed and the missing IDs of retained installed file types, including disabled types. It does not assign system children, helpers, or identities outside the chosen prototype.

An ordinary rename or move needs no new identity assignment. Preserve the leading identity comment, Markdown frontmatter field, or canvas metadata when editing. A copied file with a retained ID fails validation; use managed duplication or explicitly create a new artifact. Arbitrary cross-prototype transfer is rejected until an explicit transfer policy exists.

Verify permanent addresses independently of source dependencies. Regression coverage includes identity adapters, scoped parent lookup, copying/remapping, source moves and repair, system lifecycle, grant revocation and before-side CI authority, missing/malformed/duplicate metadata, preview tampering and stale inventories, rollback failures, lazy publication, disabled capabilities, and deployment under a base path. Review rendered navigation, embeds, source mode, and direct refreshes. A successful build alone does not establish dependency integrity.

## Installed system identity

The system installation policy is to allocate a new ID for each installed system instance. Package origin and version remain separate provenance; renaming or upgrading that installation preserves its ID. Installing the same package in another studio allocates a different ID. A repository fork retains its source IDs.
