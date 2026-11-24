// Keeps the manifest live during `pnpm dev`, without reloading the page.
//
// Vite already watches every file. When something under src/prototypes/, a module's content folder, src/platform/, the system roots (src/platform/systems/ and src/systems/), the module roots (src/platform/modules/ and src/modules/, Markdown only), the folders a module's build.ts watches (the Manual's pages, src/platform/modules/documentation/pages/), or a module contract
// changes (from the app, an agent, or your editor), this rebuilds the manifest in-process
// and pushes it to the app over Vite's dev connection. The app swaps it in and refreshes
// only the routes that use it (see router.tsx), so the open view and scroll position stay.
// Bursts of changes, like moving a folder, are batched into one update.
import fs from 'node:fs';
import path from 'node:path';
import { knowledgeOwners, skillCatalog, syncSkillAdapters } from '../lib/agent-skills.js';
import { MODULE_ROOTS, SYSTEM_ROOTS } from '../../core/roots.ts';
import { SYSTEM_SPECS } from '../../modules/systems/node/systems.js';
import { fileURLToPath } from 'node:url';
import { buildManifest } from './build-manifest.js';
import { FILE_TYPES, INSTALLED_FILE_TYPES, fileTypeOf } from '../lib/file-types.js';
import { auditResourceIdentities } from '../lib/resource-identity-audit.js';
import { identifyAuthored, prototypeFolderOf } from '../lib/prototype-identification.js';
import { resolveContributor } from '../cli/resolve-contributor.js';
import { ENABLED_MODULES, PROTOTYPE_DIRS } from '../lib/modules.js';
import { CONTRIBUTORS_DIR } from '../lib/contributors.js';
import { contributedWatchDirs } from '../lib/module-builds.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PROTOS = path.join(ROOT, 'src', 'prototypes');
const SYSTEM_CONTENT = path.join(ROOT, 'src', 'platform');
// Folders the enabled modules' build.ts hooks ask to watch, such as the Manual's pages.
const HOOK_DIRS = contributedWatchDirs();
// Where systems live: the supplied root (inside src/platform) and the team's.
const SYSTEMS = SYSTEM_ROOTS.map(systemsRoot => path.join(ROOT, systemsRoot));
// Where modules live: the supplied root (inside src/platform) and the team's.
const MODULE_ROOT_DIRS = MODULE_ROOTS.map(modulesRoot => path.join(ROOT, modulesRoot));
// The system content's map reads it (src/platform/modules/systems/content/map.ts).
const AGENTS = path.join(ROOT, 'AGENTS.md');
const BATCH_MS = 50;

// The last manifest sent to the app. The files plugin publishes right after its own changes
// (with the tab that made them), so the watcher skips the same manifest a moment later.
let last = '';
export function publishManifest(server, manifest, origin) {
  last = JSON.stringify(manifest);
  server.ws.send({ type: 'custom', event: 'studio:manifest', data: { manifest, origin } });
}

const inside = (dir, file) => file === dir || file.startsWith(dir + path.sep);

// Adding or removing anything can change the list of views; editing a file only matters
// for meta.json, Manual frontmatter, contributor names, and a file that can be lofi (a view says so
// in its own text). Other edits to a view's code are left to Vite's hot reload.
function relevant(file, kind) {
  if (inside(CONTRIBUTORS_DIR, file) || file === AGENTS) return true;
  if (HOOK_DIRS.some(dir => inside(dir, file))) return file.endsWith('.md');
  // A system's component docs: files coming and going, and edits to the ones that describe a component
  // and to its theme (the tokens it lists). The platform system is inside src/platform, so this comes first.
  if (SYSTEMS.some(dir => inside(dir, file)))
    return (
      kind !== 'change' || /\.(md|examples\.[jt]sx)$|styles[\\/]theme\.css$|(?:system\.ts|package\.json)$/.test(file)
    );
  // Module code is a module's, not the platform's, in either root: only its Markdown (context, skills, contracts) is
  // read by the manifest. The supplied root is inside src/platform, so this comes before the platform check.
  if (MODULE_ROOT_DIRS.some(dir => inside(dir, file))) return file.endsWith('.md');
  if (inside(SYSTEM_CONTENT, file)) return kind !== 'change' || file.endsWith('.md');
  if (file.endsWith('.md') && /src[\\/]platform[\\/]core[\\/]/.test(file)) return true;
  if (![PROTOS, ...PROTOTYPE_DIRS].some(dir => inside(dir, file))) return false;
  return kind !== 'change' || path.basename(file) === 'meta.json' || hasFidelity(file) || lacksIdentity(file);
}

const hasFidelity = file => {
  const id = fileTypeOf(file);
  return Boolean(id && FILE_TYPES[id].capabilities.fidelity);
};

// A file saved over without its identity (an agent rewriting a new view whole) needs one again.
const lacksIdentity = file => {
  const identity = FILE_TYPES[fileTypeOf(file)]?.identity;
  try {
    return Boolean(identity) && identity.read(fs.readFileSync(file, 'utf8')) === null;
  } catch {
    return false;
  }
};

const relativePath = file => path.relative(ROOT, file).split(path.sep).join('/');

// Gives files written outside the app their permanent identity before the manifest is built (see identifyAuthored).
// A folder this contributor can't edit, or one that isn't ready (a new prototype without its systemId), is reported once
// and left to the manifest's own error.
function identify(folders, logger, reported) {
  for (const result of identifyAuthored(ROOT, INSTALLED_FILE_TYPES, folders, resolveContributor)) {
    if (!result.error)
      logger.info(
        `[identity] Assigned ${result.changed} missing identit${result.changed === 1 ? 'y' : 'ies'} in ${result.folder}.`,
      );
    else if (!reported.has(`${result.folder}:${result.error.message}`)) {
      reported.add(`${result.folder}:${result.error.message}`);
      logger.warn(`[identity] ${result.folder} keeps its missing identities: ${result.error.message}`);
    }
  }
}

export default function manifestWatch() {
  return {
    name: 'prototype-manifest-watch',
    apply: 'serve',
    configureServer(server) {
      const reported = new Set();
      if (!fs.existsSync(path.join(ROOT, '.studio-system-operation'))) {
        // Files written while the server was stopped.
        identify(
          auditResourceIdentities(ROOT, INSTALLED_FILE_TYPES).missing.map(prototypeFolderOf),
          server.config.logger,
          reported,
        );
        buildManifest();
      }
      server.watcher.add([
        PROTOS,
        ...PROTOTYPE_DIRS,
        SYSTEM_CONTENT,
        ...HOOK_DIRS,
        ...SYSTEMS,
        CONTRIBUTORS_DIR,
        AGENTS,
      ]);
      let timer = null;
      // Every file that changed since the last build, even ones that don't ask for a rebuild: the next one tells the
      // build which prototypes to look at again, so an edit that waited for it is never missed.
      const touched = new Set();
      const flush = () => {
        timer = null;
        if (fs.existsSync(path.join(ROOT, '.studio-system-operation'))) {
          timer = setTimeout(flush, BATCH_MS);
          return;
        }
        identify(
          [...touched].map(file => prototypeFolderOf(relativePath(file))),
          server.config.logger,
          reported,
        );
        const { manifest } = buildManifest({ touched: [...touched] });
        if ([...touched].some(file => /[\\/]skills(?:[\\/]|$)/.test(file))) {
          try {
            const result = syncSkillAdapters(ROOT, skillCatalog(ROOT, knowledgeOwners(ENABLED_MODULES, SYSTEM_SPECS)));
            for (const warning of result.warnings) server.config.logger.warn(warning);
          } catch (error) {
            server.config.logger.error(`Skill exposure was not updated: ${error.message}`);
          }
        }
        touched.clear();
        if (JSON.stringify(manifest) !== last) publishManifest(server, manifest);
      };
      const onEvent = kind => file => {
        touched.add(file);
        if (!relevant(file, kind)) return;
        clearTimeout(timer);
        timer = setTimeout(flush, BATCH_MS);
      };
      for (const kind of ['add', 'unlink', 'addDir', 'unlinkDir', 'change']) server.watcher.on(kind, onEvent(kind));
    },
  };
}
