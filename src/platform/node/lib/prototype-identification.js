// Identity assignment for directly authored prototype files: explicit through pnpm studio identify, and automatic in
// authoring tools (the dev server, the canvas CLI) through identifyAuthored. Reads, builds and checks never assign IDs,
// and an existing identity or owner is immutable.
import fs from 'node:fs';
import path from 'node:path';
import { readPersistedStudioConfig } from './persisted-studio-config.js';
import { canonicalDirectory } from './safe-paths.js';
import { resourceId, jsonIdentity, createResourceId, jsonIdentityMetadata } from '../../core/resourceIdentity.ts';
import { canPerform } from '../../core/permissions.ts';
import { prototypeAssignment } from './prototype-assignment.js';
import { readDeclaration } from '../../core/declarations.ts';
import { auditResourceIdentities } from './resource-identity-audit.js';
import { applySetupChanges } from './studio-setup.js';
import { systemDirOf } from './system-folders.js';

export function planPrototypeIdentification(
  root,
  types,
  folder,
  actor,
  { ids = {}, generate = createResourceId } = {},
) {
  const absolute = path.resolve(root, folder),
    relative = path.relative(root, absolute).split(path.sep).join('/');
  const match = /^src\/prototypes\/([a-z0-9][a-z0-9-]*)\/([a-z0-9][a-z0-9._-]*)$/i.exec(relative);
  if (!match || !canonicalDirectory(absolute, root))
    throw new Error('Identify an existing contributor-owned prototype folder without symbolic links.');
  const current = readPersistedStudioConfig(root);
  const ownerContributorId = resourceId(current.directory.contributorIds[match[1]]);
  if (
    !canPerform(
      current.config,
      actor,
      Object.keys(current.directory.contributorIds),
      { kind: 'prototype', owner: match[1] },
      'edit',
    )
  )
    throw new Error('Only the prototype owner or an Admin can assign its missing identities.');
  const metadataFile = path.join(absolute, 'meta.json');
  const before = fs.readFileSync(metadataFile, 'utf8');
  jsonIdentity(before);
  const metadata = JSON.parse(before);
  if (metadata.ownerContributorId !== undefined && metadata.ownerContributorId !== ownerContributorId)
    throw new Error('Prototype owner identity does not match its contributor folder.');
  const systems = Object.fromEntries(
    current.config.systems
      .map(key => {
        const declaration = readDeclaration(
          fs.readFileSync(path.join(root, systemDirOf(root, key), 'system.ts'), 'utf8'),
        );
        if ('error' in declaration) throw new Error(declaration.error);
        return [key, declaration.value];
      })
      .filter(([, spec]) => spec.role === 'prototype'),
  );
  const assignment = prototypeAssignment(metadata, systems);
  if (assignment.problems.length) throw new Error(assignment.problems.join('\n'));
  const selected = resource => resource.path === `${relative}/meta.json` || resource.parent === relative;
  const source = planPrototypeIdentities(root, types, { ids, generate, select: selected });
  const changes = source.changes;
  if (metadata.ownerContributorId === undefined) {
    const change = changes.find(change => change.path === `${relative}/meta.json`);
    const after = JSON.stringify({ ...JSON.parse(change?.after ?? before), ownerContributorId }, null, 2) + '\n';
    if (change) change.after = after;
    else changes.push({ path: `${relative}/meta.json`, before, after });
  }
  return {
    stage: 'prototype-identification',
    folder: relative,
    configSource: current.source,
    directory: current.directory,
    snapshot: source.snapshot,
    resources: source.resources.filter(selected),
    changes,
  };
}

export function applyPrototypeIdentification(root, types, plan, actor) {
  if (plan?.stage !== 'prototype-identification' || !Array.isArray(plan.resources))
    throw new Error('Review a prototype identity preview first.');
  const ids = Object.fromEntries(plan.resources.map(resource => [resource.path, resource.studioId]));
  const current = planPrototypeIdentification(root, types, plan.folder, actor, { ids });
  if (JSON.stringify(current) !== JSON.stringify(plan))
    throw new Error('Prototype identity preview or inventory changed. Review it again.');
  const edits = current.changes.map(change => ({
    file: path.join(root, change.path),
    before: change.before,
    after: change.after,
  }));
  applySetupChanges(edits);
  try {
    const audit = auditResourceIdentities(root, types);
    if (
      audit.problems.length ||
      current.resources.some(
        resource => !audit.resources.some(next => next.path === resource.path && next.studioId === resource.studioId),
      )
    )
      throw new Error('Prototype identity verification failed after assignment.');
    for (const edit of edits)
      if (fs.readFileSync(edit.file, 'utf8') !== edit.after)
        throw new Error('Source changed during prototype identity assignment.');
    const next = readPersistedStudioConfig(root);
    if (next.source !== current.configSource || JSON.stringify(next.directory) !== JSON.stringify(current.directory))
      throw new Error('Authority changed during prototype identity assignment.');
  } catch (error) {
    try {
      applySetupChanges(edits.map(edit => ({ ...edit, before: edit.after, after: edit.before })).reverse());
    } catch (rollback) {
      throw new AggregateError([error, rollback], 'Identity assignment failed and rollback needs review.');
    }
    throw error;
  }
  return {
    prototypeId: current.resources.find(resource => resource.kind === 'prototype').studioId,
    changed: current.changes.length,
  };
}

// The prototype folder (src/prototypes/<contributor>/<prototype>) a repository path is in, or null.
export const prototypeFolderOf = file => /^src\/prototypes\/[^/]+\/[^/]+(?=\/)/.exec(file)?.[0] ?? null;

// Files written outside the app (by an agent or an editor) arrive without a permanent identity. Authoring tools give
// them one here, as the app does for the files it creates, so links and tools see them with no separate step. Only the
// given folders that have missing identities are touched, with the same owner/Admin check as pnpm studio identify.
// Returns one entry per folder it tried: { folder, changed } or { folder, error }.
export function identifyAuthored(root, types, folders, resolveActor) {
  const candidates = new Set(folders.filter(Boolean));
  if (!candidates.size) return [];
  const pending = new Set(auditResourceIdentities(root, types).missing.map(prototypeFolderOf));
  const targets = [...candidates].filter(folder => pending.has(folder));
  if (!targets.length) return [];
  const actor = resolveActor();
  if (!actor) return targets.map(folder => ({ folder, error: new Error('No contributor is set up on this machine.') }));
  return targets.map(folder => {
    try {
      const plan = planPrototypeIdentification(root, types, folder, actor);
      return { folder, changed: applyPrototypeIdentification(root, types, plan, actor).changed };
    } catch (error) {
      return { folder, error };
    }
  });
}

// ids is an optional path->ID allocation retained from an earlier preview.
// Existing identities are never reassigned. A collision is retried before any write.
function planPrototypeIdentities(root, types, { ids, generate, select }) {
  const audit = auditResourceIdentities(root, types);
  if (audit.problems.length) throw new Error(audit.problems.join('\n'));
  const used = new Set(audit.resources.flatMap(resource => (resource.studioId ? [resource.studioId] : [])));
  const locations = new Set(audit.resources.map(resource => resource.path));
  for (const file of Object.keys(ids))
    if (!locations.has(file)) throw new Error(`${file}: identity allocation is outside the current inventory.`);
  const snapshot = [],
    resources = [],
    changes = [];
  for (const resource of audit.resources) {
    const before = fs.readFileSync(path.join(root, resource.path), 'utf8');
    snapshot.push({ ...resource, before });
    let id = resource.studioId;
    if (id && ids[resource.path] !== undefined && ids[resource.path] !== id)
      throw new Error(`${resource.path}: an existing identity cannot be reassigned during assignment.`);
    if (!id && select(resource)) {
      if (ids[resource.path] !== undefined) {
        id = resourceId(ids[resource.path]);
        if (used.has(id)) throw new Error(`${resource.path}: preview allocation conflicts with resource ID ${id}.`);
      } else {
        for (let attempt = 0; attempt < 32; attempt++) {
          const candidate = resourceId(generate());
          if (!used.has(candidate)) {
            id = candidate;
            break;
          }
        }
        if (!id) throw new Error(`${resource.path}: could not allocate a unique resource identity.`);
      }
      used.add(id);
      changes.push({
        path: resource.path,
        before,
        after:
          resource.kind === 'artifact'
            ? types[resource.fileType].identity.write(before, id)
            : jsonIdentityMetadata.write(before, id),
      });
    }
    resources.push({ ...resource, studioId: id });
  }
  return { snapshot, resources, changes };
}
