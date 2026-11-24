import type { ReactNode } from 'react';
import type { SystemContentMap } from '@/platform/modules/systems/content/map';
import type { SystemComponentDoc } from '@/platform/modules/systems/docs';
import type { ThemeToken } from '@/platform/modules/systems/themeTokens';
import type { DocsMode } from '@/platform/modules/systems/sources';
import type { SystemLibrary, SystemScreen } from '@/platform/modules/systems/spec';

// public/prototypes/manifest.json, written by src/platform/node/build/build-manifest.js, with each prototype's artifacts
// in public/prototypes/artifacts/<contributor>/<prototype>.json.
// A navigable artifact backed by a file. Shared readers use the same record shape (see src/platform/context/file-types.md).
export type Artifact = {
  studioId?: string; // permanent prototype artifact identity; absent for system content
  path: string; // file path in the prototype, e.g. "prototype.tsx" or "checkout/step-1.tsx"
  fileType: string; // the id of the file type that owns it, from its extension ("view", "document")
  title?: string; // declared instruction-document title, shared by navigation and the reader
  lofi?: true; // set when the file says it's lofi (a view starting with /** @lofi */)
};

export type PrototypeInfo = {
  studioId?: string; // permanent prototype identity; location remains id/contributorKey
  ownerContributorId?: string; // permanent contributor owner, validated against contributorKey
  id: string; // folder name, e.g. "hello-world"
  contributorKey: string; // contributor key, e.g. "pat"
  title: string;
  description?: string; // shared section descriptions; prototypes use artifacts for context
  contributor: string; // display name, from contributor profiles
  contributorSample?: true; // the contributor profile is marked "sample": true (the shipped sample author)
  contributorGithub?: string; // registered GitHub account, for optional profile photos
  contributorAvatar?: string; // relative image path in public/, preferred over a GitHub photo
  created: string | null;
  system: string | null; // resolved source key; null means custom styling
  systemId?: string | null; // permanent assignment identity; system is its resolved source selector
  screens: SystemScreen[]; // its system's screens (the app's own without one); the first is the default
  owner?: { id: string; kind: 'platform' | 'module' | 'system'; label: string; root: string };
  systemMissing?: { systemId: string; label: string }; // deleted dependency; source retained for rebuild
  rebuild?: {
    targetSystemKey: string | null;
    targetSystemId: string | null;
    sourcePrototypeId: string;
    sourcePath: string;
  }; // IDs persist; paths/selectors are generated
  status?: 'archived'; // meta.json "status", when archived; absent means active
  maintainers?: string[]; // meta.json "maintainers" (contributor keys), where a section's policy is maintainers; prototypes don't have them
};

// A prototype with its artifacts loaded, which everything that shows a prototype's files needs.
export type Prototype = PrototypeInfo & {
  artifacts: Artifact[]; // in file-tree order
};

// A prototype in the manifest. The deployed site's manifest leaves out artifacts, so the file list that
// every visitor downloads stays small; they're fetched when a prototype opens (loadPrototype in
// manifest.ts). The dev server sends them all.
export type PrototypeRef = PrototypeInfo & {
  artifacts?: Artifact[];
  artifactCount?: number;
  artifactsHash?: string; // changes when the items do, so a changed list is fetched again
};

// `sections` holds the artifacts of the modules' sections of prototype-shaped folders, by section key: the
// module section artifacts (src/examples/, as `sections.examples`), shaped like prototypes.
// `systemContent` holds the system content's sections (a system's folder in either system root, see src/platform/core/roots.ts), shaped like
// prototypes.
// `systemContentMaps` inventories declared instruction routes; it does not record agent reads.
// `systems` holds each system's components and their docs (systemDocs.ts), the tokens its theme
// defines (themeTokens.ts), and where its components come from (systemSources.ts). The app's own
// system is one of them.
export type PlatformReferenceGroup = {
  id: string;
  label: string;
  enabled: boolean;
  references: { source: string; title: string; related?: { title: string; href: string }[] }[];
  related: { title: string; href: string }[];
};

export type Manifest = {
  prototypes: PrototypeRef[];
  sections: Record<string, PrototypeRef[]>;
  // What each enabled module's build.ts adds, by module ID (src/platform/core/modules/index.ts, ModuleBuild). Read it with `contribution`.
  contributions: Record<string, unknown>;
  systemContent: Prototype[];
  systemContentMaps: Record<string, SystemContentMap>;
  platformReferences: PlatformReferenceGroup[];
  skillCatalog: {
    owner: NonNullable<PrototypeInfo['owner']>;
    folder: string;
    name: string;
    description: string;
    source: string;
  }[];
  systems: Record<
    string,
    {
      docs: DocsMode;
      origin: 'shadcn' | null;
      components: SystemComponentDoc[];
      tokens: ThemeToken[];
      libraries?: (Omit<SystemLibrary, 'version'> & { requirement: string | null; version: string | null })[];
    }
  >;
};

// Authored overview copy, optional additional content, and icon examples live in <system folder>/intro.tsx (src/systems/<id>/, or src/platform/systems/studio/ for Studio's own).
// Inventory metrics and theme/component pages come from the system's files.
export type SystemIntro = {
  summary?: string;
  overview?: SystemOverviewSummary;
  intro?: ReactNode;
  icons?: DesignSystem['icons'];
};

export type SystemCuration = {
  stage: 'direction' | 'foundations' | 'components' | 'prototype' | 'ready' | 'assessment';
  summary: string;
  nextStep: string;
  sources: { label: string; url: string }[];
  record?: string; // system context file, relative to context/
  prototypeId?: string; // permanent ID of the representative prototype
};

export type SystemOverviewSummary = { guidance?: string; code?: string; starter?: boolean; curation?: SystemCuration };

export type DesignSystem = {
  overview?: SystemOverviewSummary; // authored descriptions; inventory counts stay automatic
  summary?: string; // system-owned purpose shown above the generated overview
  label: string;
  dir: string; // where its components live, e.g. "src/platform/systems/studio/components/"
  scopeClass: string; // the class its theme is set under, or "" when it's set on the page (studio)
  intro?: ReactNode; // optional system-owned content shown directly below the overview
  icons?: { library: string; href: string; snippet: string; grid: ReactNode };
};
