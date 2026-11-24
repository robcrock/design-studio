// File types: the kinds of file a prototype holds that the app can open. A file's type comes
// from its extension, and folders are only for organizing, at any depth. The one exception:
// a file or folder whose name starts with an underscore (_components/, _data.ts) is a helper, not an artifact. Every other file (images,
// meta.json) is a plain file: the nav hides it unless you choose Show all files in the prototype's … menu.
//
// Each type belongs to a module folder, <module folder>/ (view/, document/).
// Optional types can be removed: delete the folder and its files become plain files. A type has
//   type.ts     what the build and the app both need to know (this file's FileTypeSpec)
//   open.tsx    how the app opens it: its icon, how it loads, and its page
// To add a type, see src/platform/context/file-types.md. This file stays free of browser and React dependencies, so Node scripts can
// load it directly.

import { markdownIdentity } from './resourceIdentity.ts';
import type { IdentityMetadata } from './resourceIdentity.ts';
export {
  createResourceId,
  markdownIdentity,
  resourceId,
  parsePrototypeAddress,
  prototypeAddress,
  artifactAddress,
  systemAddress,
} from './resourceIdentity.ts';
export type { IdentityMetadata, ResourceId } from './resourceIdentity.ts';

export type EmbedSurface = 'document' | 'canvas' | `${string}/${string}`;
export type HostSurfaceSpec = {
  id: EmbedSurface;
  scopes: readonly ArtifactAvailabilityContext['scope'][];
  references: 'same-prototype';
};
export const validHostSurface = (id: unknown): id is EmbedSurface =>
  typeof id === 'string' && /^(document|canvas|[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*)$/.test(id);

// Supported behavior, independent of a particular file's permissions or runtime state.
export type ArtifactCapabilities = {
  source: boolean;
  create: boolean;
  fidelity: boolean;
  embeds: readonly EmbedSurface[];
  // Module-owned menu actions implemented by open.tsx. Use namespaced IDs.
  actions: readonly string[];
};

export type CapabilityAvailability =
  | { supported: false; available: false; reason: string }
  | { supported: true; available: false; reason: string }
  | { supported: true; available: true };

export type ArtifactAvailabilityContext = {
  local: boolean;
  editable: boolean; // supplied by current authority checks, never inferred from support
  present: boolean;
  renderer: boolean;
  scope: 'prototype' | 'systemContent';
  systemMissing?: { label: string };
};

// Container assignment is context; only system-consuming formats require its runtime.
export function artifactSystemAvailability(
  spec: FileTypeSpec | undefined,
  context: { systemMissing?: { label: string } },
): CapabilityAvailability {
  return capabilityAvailability(
    Boolean(spec),
    spec?.systemUsage === 'assigned' &&
      context.systemMissing &&
      `The assigned system ${context.systemMissing.label} is unavailable. Rebuild the system-dependent implementation. Source remains available.`,
  );
}

export function capabilityAvailability(
  supported: boolean,
  ...restrictions: (string | false | undefined)[]
): CapabilityAvailability {
  if (!supported)
    return { supported: false, available: false, reason: 'This artifact type does not support this operation.' };
  const reason = restrictions.find((value): value is string => typeof value === 'string');
  return reason ? { supported: true, available: false, reason } : { supported: true, available: true };
}

// This describes UI availability. The server must still authorize every write.
export function artifactAvailability(spec: FileTypeSpec | undefined, context: ArtifactAvailabilityContext) {
  const caps = spec?.capabilities;
  const missing = !context.present && 'This artifact is unavailable.';
  const local = !context.local && 'This operation is available only in a local studio.';
  const readonly = !context.editable && 'You do not have permission to change this artifact.';
  const renderer = !context.renderer && 'The artifact renderer is unavailable.';
  const system = artifactSystemAvailability(spec, context);
  const dependency = system.supported && !system.available && system.reason;
  const scope =
    Boolean(spec && !(context.scope === 'prototype' ? spec.inPrototype : spec.inSystemContent)) &&
    'This artifact type is unavailable in this scope.';
  return {
    view: capabilityAvailability(Boolean(spec), scope, missing, renderer, dependency),
    source: capabilityAvailability(caps?.source === true, scope, missing, local),
    editSource: capabilityAvailability(caps?.source === true, scope, missing, local, readonly),
    create: capabilityAvailability(caps?.create === true, scope, local, readonly, renderer),
    fidelity: capabilityAvailability(
      caps?.fidelity === true,
      scope,
      missing,
      local,
      readonly,
      context.scope !== 'prototype' && 'Fidelity changes apply only to prototype artifacts.',
    ),
    embeds: Object.fromEntries(
      [...new Set<EmbedSurface>(['document', 'canvas', ...(caps?.embeds ?? [])])].map(surface => [
        surface,
        capabilityAvailability(caps?.embeds.includes(surface) === true, scope, missing, renderer, dependency),
      ]),
    ) as Record<EmbedSurface, CapabilityAvailability>,
  };
}

export type FileTypeSpec = {
  label: string; // "View", "Document"
  systemUsage: 'assigned' | 'independent';
  // Prototype source identity travels with the file. System content retains paths.
  // No generation during discovery: creation/explicit assignment supplies it.
  identity?: IdentityMetadata;
  extensions: readonly string[]; // ".tsx", ".md"
  // The syntax the Source view highlights (src/platform/app/source/ArtifactSource.tsx). Leave it
  // out for a type with no source to show.
  language?: 'tsx' | 'markdown' | 'json' | 'mermaid' | 'text';
  capabilities: ArtifactCapabilities;
  // True if the type opens in the system content (src/platform/), where every other file opens as plain
  // text instead of as its own type. (A script in a skill's folder is text there, not a view.)
  inSystemContent: boolean;
  // False for a type owned by a shared section, such as system content Markdown.
  // Declare true to permit files in prototypes, false to exclude them.
  inPrototype: boolean;
  // True for the one type that opens any file no other type claims, where the system content allows it.
  // It has no extensions of its own, and prototypes never use it: their other files stay plain.
  fallback: boolean;
  // Set if a file of this type can be shown in lofi: rough, grayscale, with handwritten type, over the
  // same components. A file says so itself (a view starts with /** @lofi */), so it stays with the file
  // when it is renamed or moved. `isLofi` reads that from the file's text, and `setLofi` returns the text
  // with it switched on or off. Both are plain string functions: Node loads them for the manifest.
  fidelity?: {
    isLofi(source: string): boolean;
    setLofi(source: string, on: boolean): string;
  };
  // The contents of a new file called `name` ("user-settings.tsx"). Without it, the "+" menu
  // doesn't offer to make this type.
  template?: (name: string) => string;
  // Problems in a file, each a sentence that says what to fix. `frontmatter` is the leading
  // --- block as simple key: value pairs, or null when there isn't one. `prototype` is where the file is,
  // for a rule that depends on it (a canvas can't link to another prototype), and is left out in the system content.
  check?: (file: {
    source: string;
    frontmatter: Record<string, unknown> | null;
    // `artifacts` are the prototype's own, so a rule can tell which links show a system's screen.
    prototype?: {
      contributor: string;
      id: string;
      studioId?: string;
      artifacts?: readonly { studioId?: string; systemUsage: 'assigned' | 'independent' }[];
    };
  }) => string[];
};

export const defineFileType = (spec: FileTypeSpec) => {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec))
    throw new Error('File type: provide a declaration object in type.ts.');
  if (!['assigned', 'independent'].includes(spec.systemUsage))
    throw new Error(`File type ${spec.label}: declare systemUsage as assigned or independent.`);
  for (const key of ['inSystemContent', 'inPrototype', 'fallback'] as const) {
    if (typeof spec[key] !== 'boolean') throw new Error(`File type ${spec.label}: declare ${key} as true or false.`);
  }
  if ('preview' in spec)
    throw new Error(`File type ${spec.label}: replace preview with capabilities.embeds in type.ts.`);
  const caps = spec.capabilities;
  if (!caps || typeof caps !== 'object' || Array.isArray(caps))
    throw new Error(`File type ${spec.label}: declare capabilities.`);
  for (const key of Object.keys(caps))
    if (!['source', 'create', 'fidelity', 'embeds', 'actions'].includes(key))
      throw new Error(
        `File type ${spec.label}: unknown capability ${key}. Use capabilities.actions for module-owned operations.`,
      );
  for (const key of ['source', 'create', 'fidelity'] as const) {
    if (typeof caps[key] !== 'boolean')
      throw new Error(`File type ${spec.label}: declare capabilities.${key} as true or false.`);
  }
  if (
    !Array.isArray(caps.embeds) ||
    caps.embeds.some(surface => !validHostSurface(surface)) ||
    new Set(caps.embeds).size !== caps.embeds.length
  )
    throw new Error(`File type ${spec.label}: capabilities.embeds must list unique declared host surface IDs, or [].`);
  if (
    !Array.isArray(caps.actions) ||
    caps.actions.some(id => typeof id !== 'string' || !/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(id)) ||
    new Set(caps.actions).size !== caps.actions.length
  )
    throw new Error(
      `File type ${spec.label}: capabilities.actions must list unique namespaced action IDs (module.action), or [].`,
    );
  if (caps.source && !['tsx', 'markdown', 'json', 'mermaid', 'text'].includes(spec.language ?? ''))
    throw new Error(`File type ${spec.label}: source capability requires a supported language.`);
  if (caps.create !== (typeof spec.template === 'function'))
    throw new Error(`File type ${spec.label}: create capability must match its template implementation.`);
  if (
    caps.fidelity !== (spec.fidelity !== undefined) ||
    (caps.fidelity && (typeof spec.fidelity?.isLofi !== 'function' || typeof spec.fidelity?.setLofi !== 'function'))
  )
    throw new Error(`File type ${spec.label}: fidelity capability must match its fidelity implementation.`);
  return spec;
};

// The id of the type that owns a file, by its extension, or null for a plain file.
export function matchFileType(specs: Record<string, FileTypeSpec>, file: string): string | null {
  for (const [id, { extensions, inPrototype }] of Object.entries(specs)) {
    if (inPrototype === true && extensions.some(ext => file.endsWith(ext))) return id;
  }
  return null;
}

// The id of the type that opens files no other type claims, or null if none is installed.
export function fallbackType(specs: Record<string, FileTypeSpec>): string | null {
  return Object.entries(specs).find(([, spec]) => spec.fallback)?.[0] ?? null;
}

// The id of the type that opens a file in the system content: its own type if that type opens there,
// otherwise the fallback (plain text), otherwise null.
export function systemContentType(specs: Record<string, FileTypeSpec>, file: string): string | null {
  return (
    Object.entries(specs).find(
      ([, spec]) => spec.inSystemContent && spec.extensions.some(ext => file.endsWith(ext)),
    )?.[0] ?? fallbackType(specs)
  );
}

// Two types cannot own the same extension within the same content scope.
export function assertUniqueExtensions(specs: Record<string, FileTypeSpec>) {
  for (const spec of Object.values(specs)) defineFileType(spec);
  const owners = new Map<string, string>();
  const fallbacks = Object.entries(specs)
    .filter(([, spec]) => spec.fallback)
    .map(([id]) => id);
  if (fallbacks.length > 1)
    throw new Error(
      `File types ${fallbacks.map(id => `"${id}"`).join(' and ')} are both the fallback. Only one type can open the files no other type claims.`,
    );
  for (const [id, spec] of Object.entries(specs)) {
    for (const scope of ['prototype', 'systemContent'] as const) {
      if (scope === 'prototype' ? spec.inPrototype !== true : !spec.inSystemContent) continue;
      for (const ext of spec.extensions) {
        const key = `${scope}:${ext}`;
        const other = owners.get(key);
        if (other)
          throw new Error(
            `File types "${other}" and "${id}" both use ${ext} in ${scope}. Each extension can belong to only one type in a scope.`,
          );
        owners.set(key, id);
      }
    }
  }
}

// An artifact's path in URLs: its file path without the extension
// ("checkout/step-1.tsx" → "checkout/step-1").
export const artifactSlug = (path: string) => path.replace(/\.[^./]+$/, '');

// Helpers, not artifacts: a file or folder named with a leading underscore, at any depth. Everything inside
// a helper folder is a helper too.
export const isHelper = (name: string) => name.startsWith('_');

// Markdown presentation is shared by prototype Documents and the system content.
// "problem-framing.md" → "Problem Framing"
const titleOf = (name: string) =>
  name
    .replace(/\.md$/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');

export const markdownFileType: FileTypeSpec = {
  label: 'Document',
  systemUsage: 'independent',
  identity: markdownIdentity,
  capabilities: { source: true, create: true, fidelity: false, embeds: [], actions: [] },
  inPrototype: true,
  inSystemContent: false,
  fallback: false,
  extensions: ['.md'],
  language: 'markdown',

  template: name =>
    `---\ntitle: ${titleOf(name) || 'Untitled'}\n---\n\nThis document is empty. Ask your agent to write it: describe what it's for and who will read it.\n`,

  check: ({ source, frontmatter }) => {
    const problems: string[] = [];
    if (/^---\r?\n/.test(source) && !frontmatter)
      problems.push(
        'its frontmatter (the block at the top between --- lines) is never closed. End it with a second --- line.',
      );
    if (frontmatter && 'toc' in frontmatter && typeof frontmatter.toc !== 'boolean')
      problems.push('"toc" in the frontmatter must be true or false.');
    return problems;
  },
};
