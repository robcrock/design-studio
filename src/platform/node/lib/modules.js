// The modules installed in the module roots, src/platform/modules/ (supplied) and src/modules/ (the team's), one
// folder each with a module.ts, for the build and the dev server. Delete a folder and its module is gone from here
// too. The app finds the same folders with a glob (src/platform/app/data/modules.ts).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPersistedStudioConfig } from './persisted-studio-config.js';
import { isEnabled } from '../../core/config.ts';
import { compatible } from '../../core/modules/index.ts';
import { MODULES, MODULE_DIRS } from './module-catalog.js';
import { offLibraryOf } from './module-folders.js';
export { MODULES, MODULE_DIRS, SECTION_KEYS, declarationProblems } from './module-catalog.js';
import { setSections } from '../../core/roots.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const { config: CONFIG } = readPersistedStudioConfig(ROOT);

// The modules studio.config.json explicitly enables and that work with this platform (`requires`). A module that is off keeps its files but is skipped everywhere.
export const ENABLED_MODULES = Object.values(MODULES).filter(m => m && isEnabled(CONFIG, m.id) && compatible(m));
export { CONFIG, isEnabled };

// Modules whose public library @module/<id> resolves: enabled ones to lib/index, and ones that are off to their
// lib/off entry when they have one (`off: true`).
export const LIBRARY_MODULES = Object.values(MODULES).flatMap(m =>
  !m?.lib ? [] : ENABLED_MODULES.includes(m) ? [m] : offLibraryOf(ROOT, m.id) ? [{ ...m, off: true }] : [],
);

// App page addresses (/examples, /documentation, ...), so they can't be a contributor's folder.

// Absolute folders of the modules that hold prototype-shaped folders, one per id (src/examples/), and the
// system content's. src/prototypes/, where the folders are grouped by person, is the Prototypes module's own and isn't listed.
const oneFolderPerId = m => m.section?.items === 'prototypes' && !m.section.byPerson;
export const PROTOTYPE_DIRS = ENABLED_MODULES.filter(oneFolderPerId).map(m => path.join(ROOT, m.section.folder));

// Sections of prototype-shaped folders (custom sections), registered so rootOf can find their folders. Installed ones
// count even when off, so their files are still found.
setSections(
  Object.values(MODULES)
    .filter(m => m && oneFolderPerId(m))
    .map(m => m.section.key),
);
// Their keys and folders, for the code that scans or watches them.
export const PROTOTYPE_SECTIONS = ENABLED_MODULES.filter(oneFolderPerId).map(m => ({
  key: m.section.key,
  dir: path.join(ROOT, m.section.folder),
  policy: m.section.policy,
  standalone: m.section.standalone === true,
}));

// The server.ts files of the enabled modules (routes they add to the dev server), as [id, file]. The dev
// server loads them itself, since they use the build scripts that use this file.
export const SERVER_FILES = ENABLED_MODULES.filter(m =>
  fs.existsSync(path.join(ROOT, MODULE_DIRS[m.id], 'server.ts')),
).map(m => [m.id, path.join(ROOT, MODULE_DIRS[m.id], 'server.ts')]);
