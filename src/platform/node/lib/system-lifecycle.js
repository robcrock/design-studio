// System lifecycle plans are shared by the CLI and local UI. Source ownership stays explicit.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readDeclaration } from '../../core/declarations.ts';
import { editDeclaration, applySetupChanges } from './studio-setup.js';
import { CONFIG_FILE, systemRegistered } from '../../core/config.ts';
import { parseConfigFile, serializeConfig, withSettings } from '../../core/config-file.ts';
import { snapshotFiles, repairText } from './artifact-moves.js';
import { canonicalDirectory } from './safe-paths.js';
import { resourceId } from '../../core/resourceIdentity.ts';
import { readResourceDirectory } from './resource-directory.js';
import { TEAM_SYSTEMS_ROOT, systemIdOfPath } from '../../core/roots.ts';
import { newSystemDir, systemDirOf, systemFolderTaken } from './system-folders.js';

export const systemSlug = text =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');
const json = value => JSON.stringify(value, null, 2) + '\n';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const edit = (file, after) => ({ file, before: fs.readFileSync(file, 'utf8'), after });
export function prototypeMetadata(root) {
  // Includes disabled module content and archived prototypes, without following symlinks.
  return [...snapshotFiles(path.join(root, 'src'))]
    .filter(([file]) => file.endsWith('/meta.json') && !systemIdOfPath(file))
    .map(([file]) => {
      const absolute = path.join(root, 'src', file);
      return { file: absolute, meta: read(absolute) };
    })
    .filter(({ meta }) => typeof meta.title === 'string');
}
export function systemDependents(root, id) {
  return prototypeMetadata(root).filter(({ meta }) => meta.systemId === id || meta.rebuild?.targetSystemId === id);
}
export function unavailablePrototypeRoots(root) {
  const directory = readResourceDirectory(root);
  return prototypeMetadata(root)
    .filter(
      ({ meta }) =>
        typeof meta.systemId === 'string' &&
        meta.systemMissing?.systemId === meta.systemId &&
        typeof meta.systemMissing?.label === 'string' &&
        !Object.hasOwn(directory.systemKeys, meta.systemId),
    )
    .map(({ file }) => path.dirname(file));
}
export function planSystemLifecycle(root, config, action, id, { name, restorePrototypes = false } = {}) {
  if (!/^[a-z][a-z0-9-]*$/.test(id ?? '') || !fs.existsSync(path.join(root, systemDirOf(root, id), 'system.ts')))
    throw new Error('Choose a registered system.');
  const dir = path.join(root, systemDirOf(root, id)),
    file = path.join(dir, 'system.ts');
  if (!canonicalDirectory(dir, root) || !fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())
    throw new Error('This system must use regular source files.');
  const declaration = readDeclaration(fs.readFileSync(file, 'utf8'));
  if ('error' in declaration) throw new Error(declaration.error);
  const spec = declaration.value;
  // The platform system is always part of the studio and is never in `systems`; it is protected, not unregistered.
  if (spec.role !== 'prototype')
    throw new Error('Studio is maintained by the platform. Its identity and availability are protected.');
  if (!systemRegistered(config, id, spec.role)) throw new Error('Choose a registered system.');
  const systemIdentity = resourceId(spec.studioId);
  const configFile = path.join(root, CONFIG_FILE);
  const configSource = fs.readFileSync(configFile, 'utf8'),
    persistedDeclaration = parseConfigFile(configSource);
  if ('error' in persistedDeclaration) throw new Error(persistedDeclaration.error);
  const persisted = persistedDeclaration.value;
  const dependents = systemDependents(root, systemIdentity);
  const edits = [];
  let nextId = id;
  let move = null,
    remove = null;
  if (action === 'rename') {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 || /[\n\r<>`$\\]/.test(name))
      throw new Error('Use a plain name between 1 and 120 characters.');
    nextId = systemSlug(name);
    if (!nextId) throw new Error('Include a letter in the system name.');
    // A renamed system stays in the team root: Studio's own system is never renamed.
    const nextDir = path.join(root, newSystemDir(nextId));
    if (nextId !== id && (systemFolderTaken(root, nextId) || Object.hasOwn(config.modules ?? {}, nextId)))
      throw new Error('A system or module already uses this name.');
    // Preserve the independently declared theme scope: its CSS contract is not the folder identity.
    edits.push(edit(file, editDeclaration(fs.readFileSync(file, 'utf8'), { label: name.trim() })));
    if (nextId !== id) {
      move = { from: dir, to: nextDir };
      edits.push(
        edit(
          configFile,
          serializeConfig(
            withSettings(persisted, { systems: config.systems.map(value => (value === id ? nextId : value)) }),
          ),
        ),
      );
      // Resolve relative imports/Markdown links against actual files, and system aliases/URLs against the old identity.
      const before = snapshotFiles(root);
      const prefix = `${systemDirOf(root, id)}/`,
        target = `${newSystemDir(nextId)}/`;
      const alias = TEAM_SYSTEMS_ROOT.replace(/^src\//, '@/');
      const review = [];
      const moves = new Map(
        [...before.keys()]
          .filter(file => file.startsWith(prefix))
          .map(file => [file, target + file.slice(prefix.length)]),
      );
      for (const relative of before.keys()) {
        if (
          !/\.(?:[cm]?[jt]sx?|md|css|json|excalidraw)$/.test(relative) ||
          ['package-lock.json', 'pnpm-lock.yaml', 'studio.lock.json'].includes(relative) ||
          relative.startsWith('public/') ||
          relative.startsWith('dist/') ||
          // Upstream-owned platform files never change with a team's systems, so updates stay clean.
          relative.startsWith('src/platform/')
        )
          continue;
        const absolute = path.join(root, relative),
          existing = edits.find(change => change.file === absolute);
        const content = existing?.after ?? fs.readFileSync(absolute, 'utf8');
        let next = repairText(content, relative, moves.get(relative) ?? relative, before, moves, [
          `/systems/${systemIdentity}`,
          `/systems/${systemIdentity}`,
        ]);
        // Exact path prefixes include source examples and declared package destinations.
        for (const [from, to] of [
          [`${alias}/${id}/`, `${alias}/${nextId}/`],
          [prefix, target],
        ]) {
          next = next.replace(new RegExp(`(?<![A-Za-z0-9_:/.-])${from}`, 'g'), () => to);
        }
        if (new RegExp(String.raw`(?<![A-Za-z0-9_:/.-])(?:src/|@/|/)systems/${id}(?=[/\s"')\]#?]|$)`).test(next))
          review.push(moves.get(relative) ?? relative);
        if (next !== content) {
          if (existing) existing.after = next;
          else edits.push(edit(absolute, next));
        }
      }
      const declarationEdit = edits.find(change => change.file === file);
      declarationEdit.after = editDeclaration(declarationEdit.after, { renameReview: review });
    }
  } else if (action === 'archive') {
    if (id === config.defaultSystem) throw new Error('Choose another default system before archiving this one.');
    if (spec.status !== 'active') throw new Error('This system is already archived.');
    edits.push(edit(file, editDeclaration(fs.readFileSync(file, 'utf8'), { status: 'archived' })));
    for (const { file, meta } of dependents) {
      if (meta.status === 'archived') continue;
      meta.status = 'archived';
      meta.archivedBySystemId = systemIdentity;
      edits.push(edit(file, json(meta)));
    }
  } else if (action === 'restore') {
    if (spec.status !== 'archived') throw new Error('This system is already active.');
    edits.push(edit(file, editDeclaration(fs.readFileSync(file, 'utf8'), { status: 'active' })));
    for (const { file, meta } of prototypeMetadata(root)) {
      if (meta.archivedBySystemId !== systemIdentity) continue;
      if (restorePrototypes && !meta.systemMissing) delete meta.status;
      delete meta.archivedBySystemId;
      edits.push(edit(file, json(meta)));
    }
  } else if (action === 'delete') {
    if (id === config.defaultSystem) throw new Error('Choose another default system before deleting this one.');
    remove = dir;
    edits.push(
      edit(
        configFile,
        serializeConfig(
          withSettings(persisted, {
            systemMaintainers: Object.fromEntries(
              Object.entries(persisted.systemMaintainers).filter(([key]) => key !== systemIdentity),
            ),
            systems: config.systems.filter(value => value !== id),
          }),
        ),
      ),
    );
    for (const { file, meta } of dependents) {
      // Keep the exact old assignment and code. Missing-system prototypes cannot render or deploy until rebuilt.
      if (meta.systemId === systemIdentity) {
        meta.systemId = systemIdentity;
        meta.systemMissing = { systemId: systemIdentity, label: spec.label };
      }
      if (meta.rebuild?.targetSystemId === systemIdentity) delete meta.rebuild;
      if (meta.archivedBySystemId === systemIdentity) delete meta.archivedBySystemId;
      edits.push(edit(file, json(meta)));
    }
  } else throw new Error('Unknown system lifecycle action.');
  return { id: nextId, action, edits, move, remove, prototypes: dependents.length, references: edits.length - 1 };
}

export function applySystemLifecycle(plan, finish = () => {}) {
  let temporary;
  applySetupChanges(plan.edits);
  try {
    if (plan.move) fs.renameSync(plan.move.from, plan.move.to);
    if (plan.remove) {
      temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-system-delete-'));
      fs.renameSync(plan.remove, path.join(temporary, 'system'));
    }
    finish();
  } catch (error) {
    if (plan.move && fs.existsSync(plan.move.to)) fs.renameSync(plan.move.to, plan.move.from);
    if (temporary && fs.existsSync(path.join(temporary, 'system')))
      fs.renameSync(path.join(temporary, 'system'), plan.remove);
    applySetupChanges(plan.edits.map(change => ({ ...change, before: change.after, after: change.before })));
    throw error;
  } finally {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
  return { id: plan.id, prototypes: plan.prototypes, references: plan.references };
}
