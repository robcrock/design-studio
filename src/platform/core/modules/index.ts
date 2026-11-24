// Modules: the parts of Design Studio you can add or remove. A module is a folder in a module root, supplied
// (src/platform/modules/<id>/) or the team's (<module folder>/), with a module.ts that says what it is and what it
// adds, so the build, the dev server and the app all read one list instead of each knowing about every module.
// A file type is a module that has a type.ts and an open.tsx (src/platform/context/file-types.md).
// Declarations depend only on Node-neutral roots, identities, and host policy types.
import { validHostSurface, type HostSurfaceSpec } from '../fileTypes.ts';
import { MODULE_ROOTS, TEAM_MODULES_ROOT } from '../roots.ts';

// This copy's API version. A module's `requires` declares the oldest platform it works with.
// Current declarations and #studio/* entries are authoritative; see context/modules.md.
export const PLATFORM_VERSION = '0.4.0';
export const CORE_PAGE_KEYS = ['settings'] as const;

// A bounded schema: every named primitive field is required; module checks may add domain constraints.
export type PreferenceSpec = {
  defaults: Record<string, string | number | boolean>;
  fields: Record<string, 'string' | 'number' | 'boolean'>;
};
export function preferenceProblems(value: unknown, schema: PreferenceSpec): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ['declare a preference object'];
  const object = value as Record<string, unknown>;
  return Object.entries(schema.fields).flatMap(([field, type]) =>
    typeof object[field] !== type || (type === 'number' && !Number.isFinite(object[field]))
      ? [`declare ${field} as ${type}`]
      : [],
  );
}

export type ModuleSpec = {
  id: string; // the folder's name
  label: string; // "Examples"
  version: string; // this module's own version, like "0.1.0"
  description?: string; // one sentence on what it adds, shown when you list or add modules
  // The oldest platform version the module works with, like "0.2.0". Every module declares it. A module that needs
  // a newer one than this copy has is turned off, and `pnpm check` says why, so an old copy never breaks on a new module.
  requires: string;
  // Explicitly declare whether studio.config.json may turn this module off.
  optional: boolean;
  // Explicit host policies; absent/disabled hosts leave retained references unavailable.
  hosts?: readonly HostSurfaceSpec[];
  preferences?: PreferenceSpec;
  // Startup optimization of declared package roots, without arbitrary Vite hooks.
  optimizeDependencies?: readonly string[];
  // Where Studio settings lists the module: one of its groups and a place within it, low first. Without one it is listed with the other modules.
  settings?: { group: 'prototyping' | 'systems' | 'team'; order: number };
  // The top-level area the module adds: its address in the app (/examples) and, if it keeps content, the folder
  // that content lives in, relative to the repo root. The key can't also be a contributor's folder, since both are addresses.
  // `items` says the folder holds files the app opens as items, so each file type lists them (globs.ts):
  // "prototypes" for a folder of prototype-shaped folders, one per id (src/examples/<id>/).
  // Leave it out when the module reads its own files.
  // `policy` says who may change the section's files from the app (src/platform/core/permissions.ts): "maintainers"
  // (the people listed in an item's meta.json) or "open" (anyone running the app; a pull request reviews
  // it). Without one, nobody can: the module's files are changed in the repo.
  // `standalone` is for a section of prototype-shaped folders whose items open on their own, filling the
  // window with no rail or navigation, on the deployed site (a standalone section item is an app).
  // `byPerson` is for the one section whose folders are grouped by the person who owns them
  // (src/prototypes/<person>/<id>/, opening at /prototypes/<person>/<id>), where the others have one folder per id.
  section?: {
    key: string;
    folder?: string;
    items?: 'prototypes';
    policy?: 'maintainers' | 'open';
    standalone?: boolean;
    byPerson?: boolean;
  };
  // Prototypes may import the module's lib/index.ts as `@module/<id>`, the one way a prototype can reach into a
  // module when lib is true (the import guard allows exactly that). Removing an imported module is refused.
  lib: boolean;
  // Context and skill paths relative to this module. A trailing slash supplies a whole skill folder.
  // Optional task conditions generate root AGENTS.md routes for enabled modules.
  instructions?: { path: string; when?: string }[];
  // npm packages owned by the module, as name → version. Integrate dependencies through the root manifest.
  dependencies?: Record<string, string>;
};

// A module can add routes to the dev server (<module folder>/server.ts, served by
// src/platform/node/build/vite-files-plugin.js at POST /__studio/<id>/<route>). A handler gets who is asking (their
// contributor key, or null) and the request's JSON, and returns what to send back; a manifest it returns
// is sent to the open app. It throws an Error to answer with that message. Dev only: the deployed site has no server.
export type ServerRoute = (request: {
  me: string | null;
  body: unknown;
}) =>
  | { status?: number; body: object; manifest?: unknown }
  | Promise<{ status?: number; body: object; manifest?: unknown }>;
export type ModuleServer = Record<string, ServerRoute>;

// A module can add its own check to `pnpm check` (<module folder>/check.ts, default export): it gets the repo's
// root folder and returns a sentence for each problem it finds, or an empty list. It runs only while the module is on.
export type ModuleCheck = (context: { root: string }) => string[] | Promise<string[]>;

/**
 * A module can contribute to the build (<module folder>/build.ts, default export) while it is enabled. `manifest` gets
 * the repo root, the IDs of the enabled modules, and a logger. It runs on every manifest build and returns the module's
 * data, stored as `manifest.contributions[<module id>]`, with the count of problems it printed through `out`. `watch`
 * lists folders (relative to the repo root) whose Markdown changes rebuild the manifest in the dev server.
 * `sourceFiles` lists the repo-relative files of that data the Documentation surface may open for editing.
 */
export type BuildAsset = {
  watch: readonly string[];
  load(context: { root: string; enabled: string[] }): unknown | Promise<unknown>;
};
export type ModuleBuild<Data = unknown> = {
  assets?: Record<string, BuildAsset>;
  manifest?(context: {
    root: string;
    enabled: string[];
    out: { log(...args: unknown[]): void; warn(...args: unknown[]): void; error(...args: unknown[]): void };
  }): { data: Data; errors: number };
  watch?: string[];
  sourceFiles?(data: Data | undefined, context: { root: string }): string[];
};

const ID = /^[a-z][a-z0-9-]*$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const KEY = /^[a-z0-9][a-z0-9-]*$/;
const SYSTEM_CONTENT_PATH = /^(context|skills)\/[A-Za-z0-9][A-Za-z0-9._\/-]*$/;
const NPM_NAME = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const NPM_VERSION = /^[\^~]?\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

// What is wrong with a module's declaration, each as a sentence that says what to fix. `folder` is the
// name of the folder it was found in, which is also its id; `dir` is that folder's path ("src/modules/research/"),
// in the team root unless said otherwise.
export function moduleProblems(spec: unknown, folder: string, dir = `${TEAM_MODULES_ROOT}/${folder}/`): string[] {
  const where = `${dir}module.ts`;
  if (!spec || typeof spec !== 'object') return [`${where} must export a module as its default.`];
  const m = spec as Partial<ModuleSpec>;
  const problems: string[] = [];
  if (m.id !== folder) problems.push(`${where}: id is "${m.id}", but it must match the folder name, "${folder}".`);
  else if (!ID.test(folder))
    problems.push(`${where}: the id should be lowercase letters, numbers, and dashes, starting with a letter.`);
  if (typeof m.label !== 'string' || !m.label.trim()) problems.push(`${where}: add a label, the name people see.`);
  if (typeof m.version !== 'string' || !VERSION.test(m.version))
    problems.push(`${where}: version should look like 0.1.0.`);
  if (m.requires === undefined)
    problems.push(
      `${where}: add requires, the oldest platform version the module works with, like requires: '${PLATFORM_VERSION}'.`,
    );
  else if (typeof m.requires !== 'string' || !VERSION.test(m.requires))
    problems.push(
      `${where}: requires should look like ${PLATFORM_VERSION}, the oldest platform version it works with.`,
    );
  if (m.description !== undefined && (typeof m.description !== 'string' || m.description.length > 200))
    problems.push(`${where}: description should be one short sentence.`);
  if (typeof m.lib !== 'boolean') problems.push(`${where}: declare lib as true or false.`);
  if (
    m.settings !== undefined &&
    !(['prototyping', 'systems', 'team'].includes(m.settings?.group) && Number.isFinite(m.settings?.order))
  )
    problems.push(`${where}: settings must be { group: 'prototyping' | 'systems' | 'team', order: <number> }.`);
  if (typeof m.optional !== 'boolean') problems.push(`${where}: declare optional as true or false.`);
  if (m.preferences !== undefined) {
    const p = m.preferences;
    if (
      !p ||
      !p.fields ||
      typeof p.fields !== 'object' ||
      Array.isArray(p.fields) ||
      !Object.keys(p.fields).length ||
      Object.entries(p.fields).some(
        ([field, type]) => !/^[a-zA-Z][a-zA-Z0-9]*$/.test(field) || !['boolean', 'string', 'number'].includes(type),
      ) ||
      preferenceProblems(p.defaults, p).length ||
      Object.keys(p.defaults).some(field => !Object.hasOwn(p.fields, field))
    )
      problems.push(`${where}: preferences need required primitive fields, matching explicit defaults.`);
  }
  if (m.hosts !== undefined) {
    if (!Array.isArray(m.hosts)) problems.push(`${where}: hosts must be a list of host declarations.`);
    else
      for (const host of m.hosts) {
        if (
          !host ||
          !validHostSurface(host.id) ||
          !((host.id === 'canvas' && folder === 'canvas') || host.id.startsWith(folder + '/')) ||
          host.references !== 'same-prototype' ||
          !Array.isArray(host.scopes) ||
          !host.scopes.length ||
          host.scopes.some((scope: string) => !['prototype', 'systemContent'].includes(scope)) ||
          new Set(host.scopes).size !== host.scopes.length
        )
          problems.push(`${where}: hosts need an owner-prefixed ID, unique scopes, and same-prototype references.`);
      }
  }
  if (m.instructions !== undefined) {
    if (!Array.isArray(m.instructions)) problems.push(`${where}: instructions should be a list of { path, when }.`);
    else
      for (const h of m.instructions) {
        const path = (h as { path?: unknown })?.path;
        if (typeof path !== 'string' || !SYSTEM_CONTENT_PATH.test(path) || path.split('/').includes('..'))
          problems.push(
            `${where}: instructions path "${String(path)}" should be inside context/ or skills/, like "skills/use-${folder}/".`,
          );
        else if ((h as { when?: unknown }).when !== undefined && typeof (h as { when?: unknown }).when !== 'string')
          problems.push(`${where}: instructions "when" for ${path} should be text.`);
      }
  }
  if (m.dependencies !== undefined) {
    const d = m.dependencies;
    if (!d || typeof d !== 'object' || Array.isArray(d))
      problems.push(`${where}: dependencies should be { "package": "^1.0.0" }.`);
    else
      for (const [name, version] of Object.entries(d)) {
        if (!NPM_NAME.test(name)) problems.push(`${where}: dependency "${name}" isn't a valid package name.`);
        else if (typeof version !== 'string' || !NPM_VERSION.test(version))
          problems.push(`${where}: dependency ${name} should have a version like "^1.2.3" or "1.2.3".`);
      }
  }
  if (
    m.optimizeDependencies !== undefined &&
    (!Array.isArray(m.optimizeDependencies) ||
      m.optimizeDependencies.length > 32 ||
      new Set(m.optimizeDependencies).size !== m.optimizeDependencies.length ||
      m.optimizeDependencies.some(
        name => typeof name !== 'string' || !NPM_NAME.test(name) || !Object.hasOwn(m.dependencies ?? {}, name),
      ))
  )
    problems.push(`${where}: optimizeDependencies must list at most 32 unique package roots declared in dependencies.`);
  if (m.section !== undefined) {
    const { key, folder: dir } = m.section as Partial<NonNullable<ModuleSpec['section']>>;
    if (typeof key !== 'string' || !KEY.test(key))
      problems.push(`${where}: section.key should be lowercase letters, numbers, and dashes.`);
    if (dir !== undefined && (typeof dir !== 'string' || !dir || dir.startsWith('/') || dir.split('/').includes('..')))
      problems.push(`${where}: section.folder should be a folder inside the repo, like src/examples.`);
    const policy = (m.section as { policy?: unknown }).policy;
    if (policy !== undefined && policy !== 'maintainers' && policy !== 'open')
      problems.push(`${where}: section.policy should be "maintainers" or "open", or left out.`);
    const items = (m.section as { items?: unknown }).items;
    if (items !== undefined && items !== 'prototypes') problems.push(`${where}: section.items should be "prototypes".`);
    else if (items !== undefined && dir === undefined)
      problems.push(`${where}: a section with items needs a folder to keep them in, like src/examples.`);
    else if (items !== undefined && !(typeof dir === 'string' && /^src\/[a-z0-9][a-z0-9-]*$/.test(dir)))
      problems.push(`${where}: a section with items keeps them in a folder directly under src/, like src/examples.`);
    else if (items === 'prototypes' && dir !== `src/${(m.section as { key?: string }).key}`)
      problems.push(
        `${where}: a section of prototype-shaped folders keeps them in src/ under its own key, like src/examples for "examples".`,
      );
    const byPerson = (m.section as { byPerson?: unknown }).byPerson;
    if (byPerson !== undefined && (byPerson !== true || items !== 'prototypes'))
      problems.push(`${where}: section.byPerson is true, and only for a section with items: "prototypes".`);
    const standalone = (m.section as { standalone?: unknown }).standalone;
    if (standalone !== undefined && (standalone !== true || items !== 'prototypes'))
      problems.push(`${where}: section.standalone is true, and only for a section with items: "prototypes".`);
  }
  return problems;
}

// Where a module may live. A module's id is its folder name in whichever root holds it, so an id found in both roots
// is ambiguous: a team module must not reuse the id of a supplied one. `found` lists every folder with a module.ts,
// including a duplicate that discovery would otherwise overwrite; `dir` is the folder ("src/modules/research/").
export function moduleRootProblems(found: readonly { id: string; dir: string }[]): string[] {
  const dirs = new Map<string, string[]>();
  for (const { id, dir } of found) dirs.set(id, [...(dirs.get(id) ?? []), dir]);
  return [...dirs]
    .filter(([, where]) => where.length > 1)
    .map(
      ([id, where]) =>
        `${id}: found in ${where.join(' and ')}. A module's id is its folder name, so it can exist in only one of ${MODULE_ROOTS.join(' and ')}. A team module can't reuse a supplied module's id: rename the one in ${TEAM_MODULES_ROOT}/.`,
    );
}

// Problems across the whole list: two modules claiming the same section key or folder.
export function listProblems(specs: readonly ModuleSpec[]): string[] {
  const problems: string[] = [];
  const hosts = new Set<string>();
  for (const m of specs)
    for (const host of m.hosts ?? []) {
      if (hosts.has(host.id)) problems.push(`Host surface ${host.id} is declared more than once.`);
      hosts.add(host.id);
    }
  const keys = new Map<string, string>();
  const dirs = new Map<string, string>();
  for (const m of specs) {
    if (!m.section) continue;
    if ((CORE_PAGE_KEYS as readonly string[]).includes(m.section.key))
      problems.push(
        `The ${m.id} module uses the reserved core page key "${m.section.key}". Give it another section key.`,
      );
    const byKey = keys.get(m.section.key);
    if (byKey)
      problems.push(
        `The ${byKey} and ${m.id} modules both use the section key "${m.section.key}". Give one of them another.`,
      );
    else keys.set(m.section.key, m.id);
    if (m.section.folder === undefined) continue;
    const byDir = dirs.get(m.section.folder);
    if (byDir)
      problems.push(
        `The ${byDir} and ${m.id} modules both keep their files in ${m.section.folder}. Give one of them another folder.`,
      );
    else dirs.set(m.section.folder, m.id);
  }
  return problems;
}

// The section keys of a list of modules: addresses that no contributor's folder can use.
export const sectionKeys = (specs: readonly ModuleSpec[]): string[] =>
  specs.flatMap(m => (m.section ? [m.section.key] : []));

// The folders (relative to the repo) of the modules whose sections hold items of this kind.
export const itemFolders = (specs: readonly ModuleSpec[], items: 'prototypes'): string[] =>
  specs.flatMap(m => (m.section?.items === items && m.section.folder ? [m.section.folder] : []));

const parts = (v: string) => v.split('.').map(Number);
// Whether a module works with this platform: it asks for no newer a version than the platform's.
export function compatible(spec: { requires?: string }, platform: string = PLATFORM_VERSION): boolean {
  if (!spec.requires || !VERSION.test(spec.requires)) return true;
  const [need, have] = [parts(spec.requires), parts(platform)];
  for (let i = 0; i < 3; i++) if (need[i] !== have[i]) return need[i] < have[i];
  return true;
}

// Callers supply enabled modules; incompatible declarations never contribute.
export const optimizedDependencies = (modules: readonly ModuleSpec[]): string[] =>
  [
    ...new Set(modules.filter(module => compatible(module)).flatMap(module => module.optimizeDependencies ?? [])),
  ].sort();
