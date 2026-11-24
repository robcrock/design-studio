// Explicit studio identity, installed module states, system registration, and the default system.
// Node scripts and the app read the same declaration: studio.config.json at the repository root. Its JSON Schema,
// src/platform/core/studio.config.schema.json, lets editors validate and complete it; configProblems below stays the
// source of truth for the rules, and config.test.ts keeps the two in agreement.

import { formatVersionProblem } from './formats.ts';

// The configuration file, relative to the repository root.
export const CONFIG_FILE = 'studio.config.json';

export type StudioConfig = {
  // The schema the file declares for editors. Only the file carries it; it has no effect at run time.
  $schema?: string;
  // The version of this file's format (FORMAT_VERSIONS.config, formats.ts). Required.
  formatVersion: number;
  // What the app calls itself: the rail's tooltip and every page's title.
  name: string;
  // Explicit onboarding mode; contributor ownership is identical in both modes.
  usage: 'personal' | 'team';
  // Persisted Admin contributor IDs. Resolved runtime projections contain source keys.
  admins?: readonly string[];
  // Persisted system-ID -> contributor-ID grants; runtime projections use source keys.
  systemMaintainers: Record<string, readonly string[]>;
  // One line on the front page of the deployed site, under the name, that tells a visitor what this is: "Our team's
  // prototypes and design systems." Left out, there's no line.
  tagline?: string;
  // Every installed module is declared true or false. Disabling retains its files.
  modules: Record<string, boolean>;
  // Source-folder keys of the team's design systems. The platform system (Studio's own interface, role 'platform')
  // is always available and is never listed. Discovery is not registration.
  systems: readonly string[];
  // Persisted default system ID; resolved runtime projection contains its source key.
  defaultSystem: string;
  // Asset Guard (src/platform/node/check/check-asset-size.js): the largest file, in KB, a commit may add or change.
  // Required, so the limit is visible where the team owns it. Big media goes through Git LFS instead.
  assetLimitKB: number;
};

// The limit a new studio declares, and the guard's limit in a repository with no studio.config.json.
export const ASSET_LIMIT_KB = 750;

// Every property the file accepts, in the order a file lists them. The schema's `properties` must name exactly these.
export const CONFIG_KEYS = [
  '$schema',
  'formatVersion',
  'name',
  'usage',
  'tagline',
  'modules',
  'systems',
  'systemMaintainers',
  'defaultSystem',
  'admins',
  'assetLimitKB',
] as const satisfies readonly (keyof StudioConfig)[];
// Compile-time guard: fails to type-check if StudioConfig gains a property CONFIG_KEYS does not list.
type Unlisted = Exclude<keyof StudioConfig, (typeof CONFIG_KEYS)[number]>;
export const configKeysCoverType: [Unlisted] extends [never] ? true : never = true;

export const USAGES = ['personal', 'team'] as const;
export const TAGLINE_MAX = 140;

// Whether a system is part of this studio: the platform system always is, and any other must be registered in `systems`.
// `role` is the system's declared role, so callers need not know the platform system's folder name.
export const systemRegistered = (config: Partial<StudioConfig>, id: string, role: 'platform' | 'prototype') =>
  role === 'platform' || Boolean(config.systems?.includes(id));

// What is wrong with a config, each as a sentence that says what to fix. `modules` is the installed
// modules and whether each can be turned off, and `systems` the installed design systems' ids.
export function configProblems(
  config: unknown,
  modules: readonly { id: string; optional?: boolean }[],
  systems?: readonly string[],
  platformId: string = 'studio',
  contributors?: readonly string[],
): string[] {
  const where = CONFIG_FILE;
  if (!config || typeof config !== 'object' || Array.isArray(config)) return [`${where} must be a JSON object.`];
  const c = config as Partial<StudioConfig>;
  const problems: string[] = [];
  for (const key of Object.keys(c))
    if (!(CONFIG_KEYS as readonly string[]).includes(key))
      problems.push(`${where}: "${key}" is not a setting. Settings are ${CONFIG_KEYS.slice(1).join(', ')}.`);
  if (c.$schema !== undefined && typeof c.$schema !== 'string')
    problems.push(`${where}: $schema should be the path of the schema, as text.`);
  const version = formatVersionProblem(c.formatVersion, 'config', where);
  if (version) problems.push(version);
  if (typeof c.name !== 'string' || !c.name.trim()) problems.push(`${where}: add a name, what the app calls itself.`);
  if (!c.usage || !(USAGES as readonly string[]).includes(c.usage))
    problems.push(`${where}: usage should be personal or team.`);
  problems.push(...adminProblems(c, contributors));
  if (
    c.usage === 'team' &&
    (c.modules?.contributors !== true || !modules.some(module => module.id === 'contributors'))
  ) {
    problems.push(
      `${where}: team use requires the Contributors & Permissions module installed and enabled. Switch to personal use before disabling or removing it.`,
    );
  }
  if (c.tagline !== undefined && (typeof c.tagline !== 'string' || c.tagline.length > TAGLINE_MAX))
    problems.push(`${where}: tagline should be one short line of text, under ${TAGLINE_MAX} characters.`);
  if (typeof c.defaultSystem !== 'string' || !c.defaultSystem)
    problems.push(`${where}: declare defaultSystem explicitly.`);
  else if (systems && !systems.includes(c.defaultSystem)) {
    problems.push(
      `${where}: defaultSystem is "${c.defaultSystem}", but no system has that id. Installed: ${systems.join(', ') || 'none'}.`,
    );
  }
  if (c.modules === undefined) problems.push(`${where}: declare every installed module as true or false in modules.`);
  else {
    if (!c.modules || typeof c.modules !== 'object' || Array.isArray(c.modules)) {
      problems.push(`${where}: modules should list module ids with true or false, like { documentation: false }.`);
    } else {
      for (const [id, on] of Object.entries(c.modules)) {
        const installed = modules.find(m => m.id === id);
        if (!installed)
          problems.push(
            `${where}: modules lists "${id}", but no module has that id. Installed: ${modules.map(m => m.id).join(', ') || 'none'}.`,
          );
        else if (typeof on !== 'boolean') problems.push(`${where}: modules.${id} should be true or false.`);
        else if (!on && !installed.optional)
          problems.push(`${where}: the ${id} module can't be turned off yet; other parts of the app still use it.`);
      }
      for (const module of modules)
        if (!Object.hasOwn(c.modules, module.id))
          problems.push(`${where}: declare modules.${module.id} as true or false.`);
    }
  }
  if (
    !Array.isArray(c.systems) ||
    c.systems.some(id => typeof id !== 'string') ||
    new Set(c.systems).size !== c.systems.length
  )
    problems.push(
      `${where}: systems must list the unique folder names of your own design systems, like ["product"]. Studio's own system is always available and is not listed.`,
    );
  else {
    if (c.systems.includes(platformId))
      problems.push(
        `${where}: systems lists "${platformId}", the platform system. It is always available; remove it and list only your own design systems.`,
      );
    if (systems) {
      for (const id of systems)
        if (!c.systems.includes(id)) problems.push(`${where}: register installed system "${id}" in systems.`);
      for (const id of c.systems)
        if (id !== platformId && !systems.includes(id))
          problems.push(`${where}: systems lists "${id}", but it is not installed.`);
    }
    if (c.defaultSystem && !c.systems.includes(c.defaultSystem))
      problems.push(`${where}: defaultSystem must be registered in systems.`);
  }
  problems.push(...systemMaintainerProblems(c, platformId, contributors));
  problems.push(...assetLimitProblems(c.assetLimitKB));
  return problems;
}

// What is wrong with assetLimitKB: it must be declared, as a number of KB above 0.
export function assetLimitProblems(limit: unknown): string[] {
  return typeof limit === 'number' && Number.isFinite(limit) && limit > 0
    ? []
    : [
        `${CONFIG_FILE}: declare assetLimitKB, the largest file in KB a commit may add or change, like ${ASSET_LIMIT_KB}.`,
      ];
}

// Activation requires an explicit true; omission cannot grant a capability.
export const isEnabled = (config: Partial<StudioConfig>, id: string) => config.modules?.[id] === true;

export function adminProblems(config: Partial<StudioConfig>, contributors?: readonly string[]): string[] {
  const { admins } = config;
  if (admins === undefined && config.usage !== 'team') return [];
  if (
    !Array.isArray(admins) ||
    (config.usage === 'team' && !admins.length) ||
    admins.some(key => typeof key !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(key)) ||
    new Set(admins).size !== admins.length
  ) {
    return [`${CONFIG_FILE}: admins must list unique contributor keys; team use requires at least one Admin.`];
  }
  return contributors
    ? admins
        .filter(key => !contributors.includes(key))
        .map(key => `${CONFIG_FILE}: Admin "${key}" is not a registered contributor.`)
    : [];
}

// Local workflow roles only. This does not grant repository access or override artifact ownership.
export function studioRole(
  config: Partial<StudioConfig>,
  key: string | null,
  contributors: readonly string[],
): 'admin' | 'contributor' | null {
  if (!key || !contributors.includes(key)) return null;
  return config.usage === 'personal' || config.admins?.includes(key) ? 'admin' : 'contributor';
}

export function systemMaintainerProblems(
  config: Partial<StudioConfig>,
  platformId = 'studio',
  contributors?: readonly string[],
): string[] {
  const grants = config.systemMaintainers;
  if (!grants || typeof grants !== 'object' || Array.isArray(grants))
    return [`${CONFIG_FILE}: declare systemMaintainers explicitly for every prototype system.`];
  const problems: string[] = [];
  const systems = Array.isArray(config.systems) ? config.systems.filter(id => id !== platformId) : [];
  for (const id of systems)
    if (!Object.hasOwn(grants, id))
      problems.push(`${CONFIG_FILE}: declare systemMaintainers.${id}, using [] when unassigned.`);
  for (const [id, keys] of Object.entries(grants)) {
    if (!systems.includes(id))
      problems.push(`${CONFIG_FILE}: systemMaintainers.${id} must name a registered prototype system.`);
    if (
      !Array.isArray(keys) ||
      keys.some(key => typeof key !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(key)) ||
      new Set(keys).size !== keys.length
    )
      problems.push(`${CONFIG_FILE}: systemMaintainers.${id} must list unique contributor keys.`);
    else if (contributors)
      for (const key of keys)
        if (!contributors.includes(key))
          problems.push(`${CONFIG_FILE}: system maintainer "${key}" is not a registered contributor.`);
  }
  return problems;
}
