// Where modules live on disk. Modules are found in two roots, the supplied one (src/platform/modules, upstream) first
// and the team's (src/modules) second, listed once in src/platform/core/roots.ts. A module's id is its folder name in
// whichever root holds it. These helpers take the repository root so they work in a fixture workspace as well as in
// this one, and have no dependencies beyond the filesystem, so the code that discovers modules and the code that
// edits them can both use them. Creating modules only ever uses the team root.
import fs from 'node:fs';
import path from 'node:path';
import { MODULE_ROOTS, TEAM_MODULES_ROOT } from '../../core/roots.ts';

// Every folder with a module.ts in the module roots, supplied root first, as { id, dir } where dir is the folder
// from the repository root ("src/modules/research/"). An id found in both roots appears twice.
export function discoverModuleFolders(root) {
  return MODULE_ROOTS.flatMap(modulesRoot => {
    const base = path.join(root, modulesRoot);
    if (!fs.existsSync(base)) return [];
    return fs
      .readdirSync(base, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && fs.existsSync(path.join(base, entry.name, 'module.ts')))
      .map(entry => ({ id: entry.name, dir: `${modulesRoot}/${entry.name}/` }))
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  });
}

// The folder of an installed module, from the repository root and without a trailing slash ("src/modules/research").
// A module that is not installed is taken to be in the team root, where new modules are made.
export function moduleDirOf(root, id) {
  const found = MODULE_ROOTS.find(modulesRoot => fs.existsSync(path.join(root, modulesRoot, id, 'module.ts')));
  return `${found ?? TEAM_MODULES_ROOT}/${id}`;
}

// The same, as an absolute path.
export const modulePath = (root, id) => path.join(root, moduleDirOf(root, id));

// Where a new module is made: only the team root.
export const newModuleDir = id => `${TEAM_MODULES_ROOT}/${id}`;

// Whether an id is already used by a folder in any module root (even one without a module.ts), so a new module
// can't take it.
export const moduleFolderTaken = (root, id) =>
  MODULE_ROOTS.some(modulesRoot => fs.existsSync(path.join(root, modulesRoot, id)));

// Ids of the modules in the roots, sorted, without duplicates.
export const moduleIdsIn = root => [...new Set(discoverModuleFolders(root).map(({ id }) => id))].sort();

// A module library's form while the module is off, lib/off.ts(x): the same exports with no Studio behavior, so code
// that imports the library keeps working. Null when the module has none.
export const offLibraryOf = (root, id) =>
  ['off.ts', 'off.tsx'].map(file => path.join(modulePath(root, id), 'lib', file)).find(file => fs.existsSync(file)) ??
  null;

// A module's detach.ts: rewrites one file's use of its library into plain code, so the module can be removed.
export const detachOf = (root, id) => {
  const file = path.join(modulePath(root, id), 'detach.ts');
  return fs.existsSync(file) ? file : null;
};
