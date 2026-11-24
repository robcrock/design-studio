// A design system prototypes build with is a folder in src/systems/<id>/ with a system.ts that says what it is,
// next to its components/ and styles/theme.css. The build, the dev server and the app all find the systems by
// their folders; studio.config.json explicitly registers each of the team's installed systems, while the platform
// system is always registered and never listed there.
// The Studio system lives in src/platform/systems/studio/ and declares role: 'platform'; prototypes
// never use it (src/platform/modules/systems/sources.ts). Systems are found in two roots, the supplied one first
// (SYSTEM_ROOTS in src/platform/core/roots.ts). Node scripts and the app share this contract.
import { resourceId } from '#studio/files';
import { SUPPLIED_SYSTEMS_ROOT, SYSTEM_ROOTS, TEAM_SYSTEMS_ROOT } from '../../core/roots.ts';

export type ColorMode = 'light' | 'dark';

// Resolve global mode against the system's explicitly declared supported modes.
export function systemColorMode(supported: readonly ColorMode[], global: ColorMode): ColorMode {
  const modes = supported;
  if (!modes.length) throw new Error('A system must declare at least one color mode.');
  return modes.includes(global) ? global : modes[0];
}

// How the build treats a component without examples or a description (systemDocs.ts): 'warn' says
// so, 'strict' fails the build, and 'off' says nothing.
export type DocsMode = 'warn' | 'strict' | 'off';

export type SystemLibrary = {
  kind: 'package' | 'source';
  id: string;
  label: string;
  package?: string; // installed dependency for kind: package
  version?: string; // authored provenance for kind: source
  description: string;
  entry?: string; // optional public runtime entry, e.g. libraries/charts.ts
  docs: string;
  assets?: readonly ('fonts' | 'icons' | 'images')[];
  components?: readonly string[];
};

// A screen the system's designs are made for: a name people use ("Phone") and its width in CSS pixels.
export type SystemScreen = { name: string; width: number };

export type SystemSpec = {
  studioId?: string; // permanent installed identity; optional in an uninstalled package or scaffold
  role: 'platform' | 'prototype';
  status: 'active' | 'archived';
  renameReview?: readonly string[]; // references that require an agent review after renaming
  label: string; // "Product"
  // The class its theme is set under, like "product-theme". Its styles/theme.css may set values only under
  // this class, so it can't leak into the app UI or another system.
  themeClass: string;
  // Select the declared utility contract, or own scoped CSS without Tailwind token requirements.
  styling: 'tailwind' | 'custom';
  colorModes: readonly ColorMode[];
  // The screen widths its designs are made for. The first is the default: a view placed on a canvas or in a
  // document is laid out at its width unless the canvas asks for another. How much height shows is the canvas's.
  screens: readonly SystemScreen[];
  docs: DocsMode;
  // Where its components come from. 'shadcn' gives each component page a link to that component's
  // shadcn/ui docs; a page can set its own link with `docs:` in its frontmatter. Use null for a
  // system that isn't shadcn/ui; declare null instead.
  origin: 'shadcn' | null;
  libraries: readonly SystemLibrary[];
};

const ID = /^[a-z][a-z0-9-]*$/;
const CLASS = /^[a-z][a-z0-9-]*$/;
export const MIN_SCREEN = 200;
export const MAX_SCREEN = 4096;

// What is wrong with a system's system.ts, each as a sentence that says what to fix. `folder` is the name of the
// folder it was found in, which is also its id; `dir` is that folder's path ("src/systems/product/"), in the team
// root unless said otherwise.
export function systemProblems(spec: unknown, folder: string, dir = `${TEAM_SYSTEMS_ROOT}/${folder}/`): string[] {
  const where = `${dir}system.ts`;
  if (!ID.test(folder))
    return [`${dir}: a system's folder should be lowercase letters, numbers, and dashes, starting with a letter.`];
  if (!spec || typeof spec !== 'object') return [`${where} must export a system as its default.`];
  const s = spec as Partial<SystemSpec>;
  const problems: string[] = [];
  if (s.studioId !== undefined) {
    try {
      resourceId(s.studioId);
    } catch (error) {
      problems.push(`${where}: ${(error as Error).message}`);
    }
  }
  if (!['active', 'archived'].includes(s.status ?? ''))
    problems.push(`${where}: status must explicitly be active or archived.`);
  if (s.role === 'platform' && s.status !== 'active') problems.push(`${where}: the platform system must stay active.`);
  if (!s.role || !['platform', 'prototype'].includes(s.role))
    problems.push(where + ": role must be 'platform' or 'prototype'.");
  if (typeof s.label !== 'string' || !s.label.trim()) problems.push(`${where}: add a label, the name people see.`);
  if (typeof s.themeClass !== 'string' || !CLASS.test(s.themeClass))
    problems.push(`${where}: themeClass should be a CSS class name like "${folder}-theme".`);
  if (
    !Array.isArray(s.colorModes) ||
    !s.colorModes.length ||
    s.colorModes.some(mode => !['light', 'dark'].includes(mode)) ||
    new Set(s.colorModes).size !== s.colorModes.length
  )
    problems.push(`${where}: colorModes must be a nonempty list of unique 'light' or 'dark' modes.`);
  if (
    !Array.isArray(s.screens) ||
    !s.screens.length ||
    s.screens.some(
      screen =>
        !screen ||
        typeof screen.name !== 'string' ||
        !screen.name.trim() ||
        !Number.isInteger(screen.width) ||
        screen.width < MIN_SCREEN ||
        screen.width > MAX_SCREEN,
    ) ||
    new Set(s.screens.map(screen => screen?.name)).size !== s.screens.length
  )
    problems.push(
      `${where}: screens must be a nonempty list of uniquely named screens, like { name: 'Desktop', width: 1440 }, with whole-pixel widths from ${MIN_SCREEN} to ${MAX_SCREEN}. The first is the default.`,
    );
  if (!['tailwind', 'custom'].includes(s.styling ?? ''))
    problems.push(`${where}: styling must be 'tailwind' or 'custom'.`);
  if (!s.docs || !['warn', 'strict', 'off'].includes(s.docs))
    problems.push(`${where}: docs should be 'warn', 'strict', or 'off'.`);
  if (s.origin !== null && s.origin !== 'shadcn')
    problems.push(`${where}: origin should be 'shadcn', or explicitly null.`);
  if (!Array.isArray(s.libraries)) problems.push(`${where}: libraries must be an explicit list (use [] when empty).`);
  else {
    const ids = new Set<string>();
    for (const library of s.libraries) {
      if (!library || typeof library !== 'object') {
        problems.push(`${where}: each library must be an object.`);
        continue;
      }
      if (typeof library.id !== 'string' || !ID.test(library.id) || ids.has(library.id))
        problems.push(`${where}: library IDs must be unique lowercase names.`);
      ids.add(library.id);
      if (![library.label, library.description].every(value => typeof value === 'string' && value.trim()))
        problems.push(`${where}: libraries need a label and description.`);
      if (!['package', 'source'].includes(library.kind))
        problems.push(`${where}: library kind must be package or source.`);
      if (
        library.kind === 'package' &&
        (typeof library.package !== 'string' || !/^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/.test(library.package))
      )
        problems.push(`${where}: package libraries must name an npm package, without a subpath.`);
      if (library.kind === 'source' && (library.package !== undefined || library.entry !== undefined))
        problems.push(`${where}: source libraries do not declare a package or runtime entry.`);
      if (library.kind === 'package' && library.version !== undefined)
        problems.push(`${where}: installed library versions come from package resolution.`);
      if (library.version !== undefined && (typeof library.version !== 'string' || !library.version.trim()))
        problems.push(`${where}: source version must be nonempty when provided.`);
      if (
        library.entry !== undefined &&
        (typeof library.entry !== 'string' ||
          !/^libraries\/[a-z0-9/-]+\.(?:ts|tsx|js|jsx)$/.test(library.entry) ||
          library.entry.split('/').includes('..'))
      )
        problems.push(`${where}: library entry must be a runtime file under libraries/.`);
      if (
        library.assets !== undefined &&
        (!Array.isArray(library.assets) ||
          library.assets.some(
            (asset: unknown) => typeof asset !== 'string' || !['fonts', 'icons', 'images'].includes(asset),
          ))
      )
        problems.push(`${where}: library assets must be fonts, icons, or images.`);
      if (typeof library.docs !== 'string' || !/^https:\/\/\S+$/.test(library.docs))
        problems.push(`${where}: libraries need an HTTPS documentation link.`);
      if (
        library.components !== undefined &&
        (!Array.isArray(library.components) ||
          library.components.some((slug: unknown) => typeof slug !== 'string' || !ID.test(slug)))
      )
        problems.push(`${where}: library components must be component slugs.`);
    }
  }
  return problems;
}

// Where a system may live. A system's id is its folder name in whichever root holds it, so an id found in both
// roots is ambiguous. The supplied root (upstream) holds only the platform system, and the platform system lives
// only there, so the team's systems and the upstream one never share a folder. `found` lists every folder with a
// system.ts, including a duplicate that discovery would otherwise overwrite: `dir` is the folder ("src/systems/product/")
// and `role` is what its system.ts declares, when it could be read.
export function systemRootProblems(found: readonly { id: string; dir: string; role?: string }[]): string[] {
  const problems: string[] = [];
  const dirs = new Map<string, string[]>();
  for (const { id, dir } of found) dirs.set(id, [...(dirs.get(id) ?? []), dir]);
  for (const [id, where] of dirs)
    if (where.length > 1)
      problems.push(
        `${id}: found in ${where.join(' and ')}. A system's id is its folder name, so it can exist in only one of ${SYSTEM_ROOTS.join(' and ')}.`,
      );
  for (const { dir, role } of found) {
    const supplied = dir.startsWith(`${SUPPLIED_SYSTEMS_ROOT}/`);
    if (supplied && role !== 'platform')
      problems.push(
        `${dir}system.ts: ${SUPPLIED_SYSTEMS_ROOT}/ holds only the platform system. Put other systems in ${TEAM_SYSTEMS_ROOT}/.`,
      );
    if (role === 'platform' && !supplied)
      problems.push(
        `${dir}system.ts: the platform system (role: 'platform') lives in ${SUPPLIED_SYSTEMS_ROOT}/, not ${TEAM_SYSTEMS_ROOT}/.`,
      );
  }
  return problems;
}

// A theme scope is shared by every mounted instance of one system, never by different systems.
export function themeClassProblems(systems: Record<string, Partial<SystemSpec>>): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const [id, spec] of Object.entries(systems)) {
    if (!spec.themeClass) continue;
    if (['dark', 'light'].includes(spec.themeClass) || (spec.themeClass === 'studio-theme' && spec.role !== 'platform'))
      problems.push(`${id}: themeClass ${spec.themeClass} is reserved by the platform.`);
    if (seen.has(spec.themeClass))
      problems.push(
        `${id} and ${seen.get(spec.themeClass)} use the same themeClass ${spec.themeClass}. Give each system its own scope.`,
      );
    seen.set(spec.themeClass, id);
  }
  return problems;
}

// The application system is identified by role, independently of its folder name.
export function platformSystemId(systems: Record<string, Partial<SystemSpec>>): string {
  const ids = Object.keys(systems).filter(id => systems[id].role === 'platform');
  if (ids.length !== 1) throw new Error(`Exactly one system must declare role: 'platform'; found ${ids.length}.`);
  return ids[0];
}
