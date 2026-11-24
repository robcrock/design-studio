// How a module appears in the app: the button on the rail, the routes it adds, and what it adds to the
// ⌘K palette. A module with these has an app.tsx in its folder (<module folder>/app.tsx) that
// exports a ModuleApp as its default. The shell finds them with a glob, so the app runs with any of
// them removed, and reads them in `order`: the rail, the palette and the routes all follow the list.
import type { ComponentType } from 'react';
import type { IconSvgElement } from '@hugeicons/react';
import type { AnyRoute, NavigateOptions } from '@tanstack/react-router';
import { compatible, type ModuleSpec } from '@/platform/core/modules';
import type { Artifact, Manifest, Prototype, PrototypeInfo } from '@/platform/app/data/types';
import type { ArtifactAction, ArtifactActionContext } from '@/platform/app/data/fileTypeModule';
import { MODULES } from '@/platform/app/data/modules';
import { isEnabled } from '@/platform/app/data/config';

// What the palette gives a module to draw its entries: the manifest, the open prototype and item (so an
// entry for the page you're on can be disabled), and a function that goes somewhere and closes the palette.
export type PaletteContext = {
  manifest: Manifest;
  current: Prototype | undefined;
  isOpen: (item: Artifact) => boolean;
  go: (to: NavigateOptions) => void;
};

// One entry a module adds to a prototype's "…" menu (on its card and in its navigation).
// `display` marks one that changes how the open prototype shows rather than the prototype itself: it appears only in
// the prototype's own navigation menu, beside "Hide other files", with its keyboard `shortcut` if it has one.
export type PrototypeAction = {
  label: string;
  icon: IconSvgElement;
  onSelect: () => void;
  destructive?: boolean;
  display?: boolean;
  shortcut?: string;
};

export type ModuleApp = {
  // Local creation workflows do not appear on published viewing sites.
  localOnly?: boolean;
  // A short navigation label when the module's full name describes a broader capability.
  navLabel?: string;
  icon: IconSvgElement;
  // Use none for contributions without a navigation destination. Otherwise, where its rail button sits, and its place among the others: low first, in the rail, the palette and the routes.
  rail: 'top' | 'bottom' | 'none';
  order: number;
  // Routes it adds under the root route. Their addresses start with the module's section key, so
  // /examples opens an optional module. Links to them are written loosely, since the router's types
  // are made from the app's own routes.
  routes?: (root: AnyRoute) => AnyRoute[];
  // Entries it adds to a prototype's "…" menu, among the ones that change it (Edit, Archive). `editable` is
  // whether you may change this prototype. It's a hook: the shell calls every module's, in the same order each
  // time, since the modules that are on don't change while the app runs.
  useActions?: (proto: PrototypeInfo, can: { editable: boolean }) => PrototypeAction[];
  // Entries it adds to an item's menu in the file tree, for file types it doesn't own (a type adds its own in
  // open.tsx). It returns the ones that fit this item, with IDs that start with the module's ID; the menu
  // checks each one's availability again before running it (src/platform/context/file-types.md).
  artifactActions?: (context: ArtifactActionContext & { manifest: Manifest }) => readonly ArtifactAction[];
  // What the module shows on the app's front page: a block of its own, usually a few of its items with a link to
  // all of them (draw it with HomeSection, src/platform/app/items/HomeSection.tsx). It decides what is useful to show and
  // may draw nothing. Leave it out for a module whose page the rail already reaches and has nothing to add.
  overview?: ComponentType<{ manifest: Manifest }>;
  // Where its overview sits on the front page, low first, when that differs from `order`: while you run the app locally
  // (where your own work comes first) and on the deployed site (where what colleagues come for does).
  homeOrder?: { local?: number; deployed?: number };
  // CommandItems it adds to the palette's Places group, and groups of its own.
  places?: ComponentType<PaletteContext>;
  palette?: ComponentType<PaletteContext>;
  // Where its palette groups sit among the other modules' groups, low first, when that differs from `order`.
  paletteOrder?: number;
  /** @stable Where the shared Documentation address (/documentation) opens, instead of the Context & Skills browser. Receives the manifest; return undefined to leave the default. */
  landing?: (manifest: Manifest) => string | undefined;
};

const apps = import.meta.glob<ModuleApp>('/__studio_modules__/app.tsx', { eager: true, import: 'default' });
const idOf = (path: string) => path.split('/').at(-2)!;

export type InstalledModule = { spec: ModuleSpec; app: ModuleApp };

// The modules that are installed, on, work with this platform, and have an app, in order.
export const moduleApps: InstalledModule[] = Object.entries(apps)
  .flatMap(([path, app]) => {
    const spec = MODULES.find(m => m.id === idOf(path));
    return spec && isEnabled(spec.id) && compatible(spec) && (!app.localOnly || import.meta.env.DEV)
      ? [{ spec, app }]
      : [];
  })
  .sort((a, b) => a.app.order - b.app.order);

// The modules that have something for the front page, in the order they show there.
export const homeApps = (local: boolean): InstalledModule[] =>
  moduleApps
    .filter(({ app }) => app.overview)
    .sort(
      (a, b) =>
        (a.app.homeOrder?.[local ? 'local' : 'deployed'] ?? a.app.order) -
        (b.app.homeOrder?.[local ? 'local' : 'deployed'] ?? b.app.order),
    );

// The address a module's section opens at, like "/examples".
export const sectionPath = (spec: ModuleSpec) => `/${spec.section!.key}`;
// Whether a pathname is inside the module's section: /examples and /examples/sample.
export const inSection = (spec: ModuleSpec, pathname: string) =>
  Boolean(spec.section) && (pathname === sectionPath(spec) || pathname.startsWith(`${sectionPath(spec)}/`));

// What the enabled modules add to an item's menu (ModuleApp.artifactActions), keeping each to its own IDs.
export const contributedArtifactActions = (context: ArtifactActionContext, manifest: Manifest) =>
  moduleApps.flatMap(({ spec, app }) =>
    (app.artifactActions?.({ ...context, manifest }) ?? []).filter(action => action.id.startsWith(`${spec.id}.`)),
  );
