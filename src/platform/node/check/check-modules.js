import { moduleBuilds } from '../lib/module-builds.js';
import { buildAssetStore } from '../lib/build-assets.js';
import { contributorPreferenceProblems } from '../../core/modules/preferences.ts';
import { fileTypeDeclarationProblems } from '../lib/file-type-declarations.js';
import { installedReferenceAdapters } from '../lib/reference-adapters.js';
import { scopePolicy } from '../lib/scope.js';
import { dependencyResolver, importsOf, sourceFiles } from '../lib/imports.js';
// Checks the modules in the module roots, src/platform/modules/ and src/modules/ (src/platform/core/roots.ts, src/platform/core/modules/index.ts):
//   - each module.ts is well formed, and its id is its folder's name
//   - no id is in both roots: a team module can't reuse a supplied module's id
//   - no two modules claim the same section key or folder
//   - a module's section folder exists
//   - studio.config.json is well formed, and only turns off modules that can be turned off
//   - each design system in the system roots (src/platform/systems/ and src/systems/, src/platform/core/roots.ts) has a well formed system.ts, components/, and styles/theme.css
//   - no contributor, and no folder in src/prototypes/, uses a section key, since both are addresses
//   - nothing outside an optional module imports its files other than its module.ts, and no module imports an
//     optional one, so deleting its folder leaves nothing broken (a required module is part of the platform,
//     so the platform and the other modules may import it)
//   - a team module or system imports platform code only through the public API, #studio/<entry>
//     (src/platform/core/modules/boundaries.ts)
//   - a file type (a module with a type.ts, src/platform/context/file-types.md) has an open.tsx, its type.ts imports
//     #studio/files and Node-safe local helpers (the build loads the declaration graph
//     directly in Node), and its loader.ts lists its files with the
//     ['/__studio_globs__/*'] placeholder, so a new section and archived files reach it (src/platform/node/build/vite-globs-plugin.js)
// Usage: node src/platform/node/check/check-modules.js
import fs from 'node:fs';
import { themeUsageProblems } from '../lib/theme-usage.js';
import { inventories } from '../build/vite-css-plugin.js';
import { TEAM_MODULES_ROOT, TEAM_SYSTEMS_ROOT, moduleIdOfPath } from '../../core/roots.ts';
import { tailwindThemeProblems } from '../lib/tailwind-theme.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { PLATFORM_VERSION, compatible, listProblems } from '../../core/modules/index.ts';
import { adminProblems, configProblems } from '../../core/config.ts';
import {
  CONFIG,
  MODULES,
  MODULE_DIRS,
  ENABLED_MODULES,
  LIBRARY_MODULES,
  SECTION_KEYS,
  PROTOTYPE_DIRS,
  declarationProblems,
} from '../lib/modules.js';
import {
  PLATFORM_ID,
  SYSTEM_SPECS,
  PROTOTYPE_SYSTEMS,
  DEFAULT_SYSTEM,
  SYSTEM_IDS,
  systemDeclarationProblems,
} from '../../modules/systems/node/systems.js';
import { readContributors } from '../lib/contributors.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const problems = declarationProblems();
try {
  buildAssetStore(moduleBuilds(), { root: ROOT, enabled: ENABLED_MODULES.map(module => module.id) });
} catch (error) {
  problems.push(error.message);
}
try {
  installedReferenceAdapters();
} catch (error) {
  problems.push(`Reference adapters: ${error.message}`);
}
const specs = Object.values(MODULES).filter(m => m && typeof m === 'object');
problems.push(
  ...listProblems(specs),
  ...configProblems(CONFIG, specs, SYSTEM_IDS, PLATFORM_ID),
  ...systemDeclarationProblems(),
);
if (SYSTEM_SPECS[DEFAULT_SYSTEM]?.status !== 'active') problems.push('The default system must be active.');
if (!SYSTEM_IDS.length)
  problems.push(
    `There is no design system in ${TEAM_SYSTEMS_ROOT}/. Prototypes need one to build with: add one with pnpm studio create-system.`,
  );
if (SYSTEM_IDS.length > 1 && !CONFIG.defaultSystem)
  problems.push(
    `There are ${SYSTEM_IDS.length} design systems (${SYSTEM_IDS.join(', ')}), so say which one prototypes use when their meta.json names none: set defaultSystem in studio.config.json.`,
  );
for (const id of SYSTEM_IDS) {
  for (const part of ['components', 'styles/theme.css']) {
    if (!fs.existsSync(path.join(ROOT, SYSTEM_SPECS[id].dir, part)))
      problems.push(`${SYSTEM_SPECS[id].dir}${part} is missing. A design system has components/ and styles/theme.css.`);
  }
}

for (const [id, spec] of Object.entries(SYSTEM_SPECS)) {
  const file = path.join(ROOT, spec.dir, 'styles/theme.css');
  if (fs.existsSync(file)) problems.push(...tailwindThemeProblems(fs.readFileSync(file, 'utf8'), { file, ...spec }));
}

const themeSystems = inventories();
const themePrototypePolicy = scopePolicy({
  root: ROOT,
  systems: PROTOTYPE_SYSTEMS,
  defaultSystem: DEFAULT_SYSTEM,
  modules: LIBRARY_MODULES,
  prototypeDirs: PROTOTYPE_DIRS,
});
const prototypeThemeFiles = [path.join(ROOT, 'src/prototypes'), ...PROTOTYPE_DIRS.map(dir => path.join(ROOT, dir))]
  .flatMap(dir => [...sourceFiles(dir)])
  .filter(file => /\.[cm]?[jt]sx?$/.test(file));
const customPrototypeTheme = {
  role: 'prototype',
  styling: 'tailwind',
  themeClass: 'prototype-unstyled',
  inventory: { base: new Map(), modes: new Map() },
};
problems.push(
  ...(await themeUsageProblems([...themeSystems, customPrototypeTheme], system => {
    if (system === customPrototypeTheme)
      return prototypeThemeFiles.filter(file => themePrototypePolicy.scopeOf(file)?.system === null);
    const dirs =
      system.role === 'platform'
        ? ['src/platform', TEAM_MODULES_ROOT, system.dir + 'components']
        : [system.dir + 'components'];
    // The platform system's components are inside src/platform, so a file can be listed by two folders.
    const files = [...new Set(dirs.flatMap(dir => [...sourceFiles(path.join(ROOT, dir))]))].filter(
      file => /\.[cm]?[jt]sx?$/.test(file) && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file),
    );
    const prototypeFiles =
      system.role === 'platform'
        ? []
        : prototypeThemeFiles.filter(file => themePrototypePolicy.scopeOf(file)?.system === path.basename(system.dir));
    return [...files, ...prototypeFiles];
  })),
);

for (const m of specs) {
  if (m.section?.folder && !fs.existsSync(path.join(ROOT, m.section.folder))) {
    problems.push(
      `The ${m.id} module keeps its files in ${m.section.folder}, which doesn't exist. Create the folder, or remove the module.`,
    );
  }
}

const { contributors: contributorMap, problems: contributorProblems } = readContributors();
problems.push(...contributorPreferenceProblems(contributorMap, ENABLED_MODULES));
const contributors = Object.keys(contributorMap);
problems.push(...adminProblems(CONFIG, contributors).filter(problem => !problems.includes(problem)));
problems.push(...contributorProblems);
const protoDir = path.join(ROOT, 'src', 'prototypes');
const folders = fs.existsSync(protoDir)
  ? fs
      .readdirSync(protoDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  : [];
for (const key of SECTION_KEYS) {
  if (contributors.includes(key))
    problems.push(`"${key}" is a contributor and also the address of a module. Give the contributor another key.`);
  if (folders.includes(key))
    problems.push(`src/prototypes/${key}/ uses "${key}", which is the address of a module. Rename the folder.`);
}

// Imports, as written: from '...', import('...'), import '...'.
const resolveDependency = dependencyResolver(ROOT);
const runtimePolicy = scopePolicy({
  root: ROOT,
  systems: PROTOTYPE_SYSTEMS,
  defaultSystem: DEFAULT_SYSTEM,
  modules: LIBRARY_MODULES,
  prototypeDirs: PROTOTYPE_DIRS,
});
problems.push(...runtimePolicy.apiEntryProblems());
const ids = Object.keys(MODULES);
const moduleDir = id => path.resolve(ROOT, MODULE_DIRS[id]);
// The module a file belongs to when it is inside a module root and that module is installed there.
const moduleOf = file => {
  const id = moduleIdOfPath(path.relative(ROOT, file).split(path.sep).join('/'));
  return id !== undefined && ids.includes(id) && file.startsWith(moduleDir(id) + path.sep) ? id : null;
};

for (const file of [...sourceFiles(path.join(ROOT, 'src')), path.join(ROOT, 'vite.config.ts')]) {
  const inside = moduleOf(file);
  const rel = path.relative(ROOT, file);
  if (runtimePolicy.scopeOf(file)?.missing) continue;
  if (!/\.(?:test|integration\.test)\.[cm]?[jt]sx?$/.test(file)) problems.push(...runtimePolicy.apiProblems(file));
  const dependencies = importsOf(fs.readFileSync(file, 'utf8'), file);
  if (dependencies.some(i => !i.typeOnly && i.source === null)) {
    const problem = runtimePolicy.computedImportProblem(file);
    if (problem) problems.push(problem);
  }
  for (const { source: specifier, typeOnly } of dependencies) {
    const dependencyProblem = runtimePolicy.packageProblem(specifier, file);
    if (dependencyProblem) {
      problems.push(dependencyProblem);
      continue;
    }
    const resolved = resolveDependency(specifier, file);
    if (!resolved) continue;
    const problem = runtimePolicy.problem(specifier, file, resolved, { typeOnly });
    if (problem) problems.push(problem);
    const targetId = moduleOf(resolved);
    if (targetId === null || targetId === inside) continue;
    const publicEntry =
      LIBRARY_MODULES.some(m => m.id === targetId) &&
      specifier === `@module/${targetId}` &&
      /^index\.[jt]sx?$/.test(path.relative(path.join(moduleDir(targetId), 'lib'), resolved));
    const isDeclaration = /^module(\.ts)?$/.test(path.relative(moduleDir(targetId), resolved));
    if (inside) {
      if (MODULES[targetId].optional)
        problems.push(
          `${rel} imports the ${targetId} module. A module can depend only on a required module, not on one that can be turned off: ${targetId}/ has to be removable.`,
        );
    } else if (!isDeclaration && !publicEntry && MODULES[targetId].optional)
      problems.push(
        `${rel} imports into the ${targetId} module ("${specifier}"). Code outside a module can read only its module.ts, or the app wouldn't run without it.`,
      );
  }
}

// File types: modules with a type.ts.
const typeIds = ids.filter(id => fs.existsSync(path.join(moduleDir(id), 'type.ts')));
for (const id of typeIds) {
  const dir = moduleDir(id);
  const where = path.relative(ROOT, dir);
  if (!fs.existsSync(path.join(dir, 'open.tsx')))
    problems.push(`${where}/ has a type.ts, so it is a file type, but no open.tsx saying how the app opens it.`);
  problems.push(...fileTypeDeclarationProblems(ROOT, dir, runtimePolicy.scopeOf));
  const loader = path.join(dir, 'loader.ts');
  if (fs.existsSync(loader) && !fs.readFileSync(loader, 'utf8').includes("'/__studio_globs__/*'")) {
    problems.push(
      `${where}/loader.ts should list its files with import.meta.glob(['/__studio_globs__/*']), not a glob written out by hand: a new section and archived files would never reach it.`,
    );
  }
}

// Each module's own check (check.ts), for the modules that are on.
for (const m of specs) {
  const file = path.join(moduleDir(m.id), 'check.ts');
  if (!fs.existsSync(file) || !compatible(m) || CONFIG.modules?.[m.id] === false) continue;
  try {
    const run = (await import(pathToFileURL(file).href)).default;
    for (const problem of await run({ root: ROOT })) problems.push(`${m.id}: ${problem}`);
  } catch (e) {
    problems.push(`${m.id}: its check.ts failed to run (${e.message}).`);
  }
}

// A module that needs a newer platform is turned off, not broken: say so, and carry on.
for (const m of specs) {
  if (!compatible(m))
    console.log(
      `[modules] The ${m.id} module needs platform ${m.requires} or newer, and this is ${PLATFORM_VERSION}, so it is off. Update the platform to use it.`,
    );
}

if (problems.length) {
  console.error(problems.map(p => `[modules] ${p}`).join('\n'));
  process.exit(1);
}
console.log(
  `[modules] ${specs.length} module(s) (${Object.keys(MODULES).join(', ')}), ${typeIds.length} of them file types, and ${SYSTEM_IDS.length} design system(s) (${SYSTEM_IDS.join(', ')}), all well formed`,
);
