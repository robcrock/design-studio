import fs from 'node:fs';
import path from 'node:path';
import { canonicalDirectory } from './safe-paths.js';
import { prototypeAssignment } from './prototype-assignment.js';
import { canPerform, studioRole } from '../../core/permissions.ts';
import { parseStatus } from '../../core/archive.ts';
import { jsonIdentity, resourceId } from '../../core/resourceIdentity.ts';
import { prototypeSourceForIdentity } from './resource-directory.js';
import { systemDirOf } from './system-folders.js';

// Report facts and entry paths without reading a transitive instruction bundle,
// writing a manifest, or deciding which task the person wants performed.
export function prototypeContext({ root, folder, config, systems, modules, contributor, contributors }) {
  const absolute = path.resolve(root, folder);
  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const match = relative.match(/^src\/prototypes\/([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)$/i);
  if (!match || !canonicalDirectory(absolute, root))
    throw new Error('Provide an existing src/prototypes/<contributor>/<prototype> folder without symbolic links.');
  const metaFile = path.join(absolute, 'meta.json');
  if (fs.lstatSync(metaFile).isSymbolicLink() || !fs.lstatSync(metaFile).isFile())
    throw new Error('meta.json must be an ordinary file.');
  const metadataSource = fs.readFileSync(metaFile, 'utf8');
  const meta = JSON.parse(metadataSource);
  resourceId(jsonIdentity(metadataSource));
  resourceId(meta.ownerContributorId);
  if (typeof meta?.title !== 'string' || !meta.title.trim()) throw new Error(`${relative}/meta.json needs a title.`);
  const registered = Object.fromEntries(
    Object.entries(systems).filter(([id, spec]) => config.systems.includes(id) && spec.role === 'prototype'),
  );
  const assignment = prototypeAssignment(meta, registered);
  if (assignment.problems.length) throw new Error(`${relative}/meta.json ${assignment.problems.join('; ')}`);
  const status = meta.status === undefined ? 'active' : parseStatus(meta.status);
  if (!status) throw new Error(`${relative}/meta.json has an invalid status.`);
  const entry = id => {
    if (id === null) return null;
    const file = `${systemDirOf(root, id)}/AGENTS.md`;
    return { status: registered[id]?.status ?? 'missing', entry: fs.existsSync(path.join(root, file)) ? file : null };
  };
  const ownerFile = path.join(root, 'contributors', match[1] + '.json');
  const ownerContributorId = fs.existsSync(ownerFile)
    ? JSON.parse(fs.readFileSync(ownerFile, 'utf8')).studioId
    : undefined;
  if (meta.ownerContributorId !== undefined && meta.ownerContributorId !== ownerContributorId)
    throw new Error(`${relative}/meta.json ownerContributorId does not match its contributor folder.`);
  return {
    prototype: {
      path: relative,
      studioId: meta.studioId,
      title: meta.title,
      owner: match[1],
      ownerContributorId: meta.ownerContributorId,
      status,
    },
    contributor: {
      key: contributor,
      role: studioRole(config, contributor, contributors),
      canEdit:
        status === 'active' &&
        canPerform(config, contributor, contributors, { kind: 'prototype', owner: match[1] }, 'edit'),
    },
    assignment: {
      source: 'explicit',
      system: assignment.system,
      systemId: assignment.systemId,
      ...entry(assignment.system),
      ...(meta.systemMissing && { systemMissing: meta.systemMissing }),
    },
    rebuild:
      assignment.rebuild === undefined
        ? null
        : {
            sourcePrototypeId: assignment.rebuild.sourcePrototypeId,
            sourcePath: prototypeSourceForIdentity(root, assignment.rebuild.sourcePrototypeId),
            targetSystemKey: assignment.rebuild.targetSystemKey,
            targetSystemId: assignment.rebuild.targetSystemId,
            target: entry(assignment.rebuild.targetSystemKey),
          },
    modules: { enabled: modules.map(module => module.id) },
    guidance: {
      prototype: 'src/platform/modules/prototypes/README.md',
    },
  };
}
