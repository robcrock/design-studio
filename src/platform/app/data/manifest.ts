import { systemPath } from '#studio/systems';

import { contentParts } from '@/platform/core/roots';
import { linkOptions } from '@tanstack/react-router';
import { artifactSlug } from '@/platform/core/fileTypes';
import { resourceId } from '@/platform/core/resourceIdentity';
import { SYSTEM_CONTENT_KEY, isSectionKey, contentSection, addressOf } from '@/platform/core/roots';
import type { Artifact, Manifest, Prototype, PrototypeInfo, PrototypeRef } from '@/platform/app/data/types';
import { embeddedManifest } from '@/platform/app/data/downloaded';

// Fetched once, then shared by every route loader. In dev, replaced whenever it changes.
let manifest: Promise<Manifest> | undefined;
export const setManifest = (m: Manifest) => {
  manifest = Promise.resolve(m);
};
export function loadManifest(): Promise<Manifest> {
  // A downloaded prototype carries its manifest, with its artifacts.
  if (embeddedManifest) manifest ??= Promise.resolve(JSON.parse(embeddedManifest.textContent ?? '') as Manifest);
  manifest ??= fetch(`${import.meta.env.BASE_URL}prototypes/manifest.json`, { cache: 'no-cache' })
    .then(r => {
      if (!r.ok) throw new Error(`Couldn't load the studio (${r.status}). Check the connection and try again.`);
      return r.json() as Promise<Manifest>;
    })
    .catch((error: unknown) => {
      manifest = undefined;
      throw error;
    });
  return manifest;
}

// What a module's build.ts contributed to the manifest (manifest.contributions[<id>]), or undefined when the module is off
// or adds nothing. The caller names the shape its own build.ts produces.
export const contribution = <T>(m: Manifest, id: string): T | undefined => m.contributions?.[id] as T | undefined;

// Everything that opens like a prototype: prototypes, the artifacts of the modules' sections, the system content's sections.
export const allPrototypes = (m: Manifest): PrototypeRef[] => [
  ...m.prototypes,
  ...Object.values(m.sections).flat(),
  ...m.systemContent,
];

export const findPrototype = (m: Manifest, contributor: string, prototype: string): PrototypeRef | undefined =>
  allPrototypes(m).find(p => p.contributorKey === contributor && p.id === prototype);

// A prototype's artifacts, fetched the first time they're needed (the deployed manifest leaves them out:
// src/platform/node/build/build-manifest.js) and then kept on the manifest's entry for it. One fetch per prototype,
// however many callers ask. The dev server sends artifacts with the manifest, so this returns at once there.
const fetching = new Map<string, Promise<Prototype>>();
export function withItems(ref: PrototypeRef): Promise<Prototype> {
  if (ref.artifacts) return Promise.resolve(ref as Prototype);
  const key = `${ref.contributorKey}/${ref.id}/${ref.artifactsHash ?? ''}`;
  let pending = fetching.get(key);
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}prototypes/artifacts/${encodeURIComponent(ref.contributorKey)}/${encodeURIComponent(ref.id)}.json${ref.artifactsHash ? `?v=${ref.artifactsHash}` : ''}`;
    pending = fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`Couldn't load ${ref.title}'s files (${r.status}).`);
        return r.json() as Promise<Artifact[]>;
      })
      .then(items => {
        ref.artifacts = items;
        return ref as Prototype;
      })
      .finally(() => fetching.delete(key));
    fetching.set(key, pending);
  }
  return pending;
}

// The prototype at an address, with its artifacts loaded, or undefined.
export async function loadPrototype(contributor: string, prototype: string): Promise<Prototype | undefined> {
  const ref = findPrototype(await loadManifest(), contributor, prototype);
  return ref && withItems(ref);
}

export async function loadPrototypeByIdentity(id: string): Promise<Prototype | undefined> {
  const matches = (await loadManifest()).prototypes.filter(proto => proto.studioId === id);
  if (matches.length > 1)
    throw new Error(`Prototype identity ${id} is declared more than once. Fix the source metadata.`);
  const ref = matches[0];
  return ref && withItems(ref);
}

export function findArtifactByIdentity(proto: Prototype, id: string): Artifact | undefined {
  const matches = proto.artifacts.filter(item => item.studioId === id);
  if (matches.length > 1) throw new Error(`Artifact identity ${id} is declared more than once in ${proto.title}.`);
  return matches[0];
}

export { artifactSlug };

// The first available artifact in navigation order opens by default.
export function firstArtifact(p: Prototype): Artifact | undefined {
  return p.artifacts[0];
}

// The artifact at a URL path ("lofi/main"), or undefined.
export const findArtifact = (p: Prototype, slug: string) => p.artifacts.find(i => artifactSlug(i.path) === slug);

// "checkout/session-done.tsx" → "Session Done": an artifact's name, without its folder.
export const artifactLabel = (
  path: string,
  proto?: Pick<PrototypeInfo, 'contributorKey' | 'id'> & { artifacts?: Artifact[] },
) => {
  const declared =
    proto?.contributorKey === SYSTEM_CONTENT_KEY && proto.artifacts?.find(item => item.path === path)?.title;
  if (declared) return declared;
  // The entry file keeps its required name on disk; people see the skill it opens.
  const skill =
    proto?.contributorKey === SYSTEM_CONTENT_KEY &&
    contentSection(proto.id) === 'skills' &&
    /^([^/]+)\/SKILL\.md$/.exec(path);
  const name = skill ? skill[1] : artifactSlug(path).split('/').pop()!;
  return name
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/\bLo ?fi\b/gi, 'Lo-fi')
    .replace(/\bHi ?fi\b/gi, 'Hi-fi');
};

// "checkout/steps/done.tsx" → "checkout/steps": the folder it's in, or "".
export const artifactFolder = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

// "2026-09-27" → "Sep 27, 2026"
export function formatDate(date: string | null) {
  if (!date) return '';
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const newestFirst = (a: PrototypeInfo, b: PrototypeInfo) => (b.created ?? '').localeCompare(a.created ?? '');

// Where a prototype's links go. The prototype's own URL opens its default view: /prototypes/<person>/<id>, or
// /examples/<id> for an artifact of a section.
export const prototypeLink = (p: Pick<PrototypeInfo, 'contributorKey' | 'id' | 'studioId'>) =>
  p.contributorKey === SYSTEM_CONTENT_KEY
    ? ({ to: contentAddress(p.contributorKey, p.id) } as never)
    : isSectionKey(p.contributorKey)
      ? linkOptions({ to: '/$contributor/$prototype', params: { contributor: p.contributorKey, prototype: p.id } })
      : linkOptions({ to: '/prototypes/$prototype', params: { prototype: resourceId(p.studioId) } });

// An artifact's URL: the prototype's, plus the artifact's path without its extension.
export const artifactLink = (p: PrototypeInfo, item: Artifact) =>
  p.contributorKey === SYSTEM_CONTENT_KEY
    ? ({ to: contentAddress(p.contributorKey, p.id) + '/' + artifactSlug(item.path) } as never)
    : isSectionKey(p.contributorKey)
      ? linkOptions({
          to: '/$contributor/$prototype/$',
          params: { contributor: p.contributorKey, prototype: p.id, _splat: artifactSlug(item.path) },
        })
      : linkOptions({
          to: '/prototypes/$prototype/artifacts/$artifact',
          params: { prototype: resourceId(p.studioId), artifact: resourceId(item.studioId) },
        });

export { matchesSystem, systemUsage } from './prototypeUsage';

export function contentAddress(contributor: string, id: string): string {
  const parts = contentParts(id);
  return contributor === SYSTEM_CONTENT_KEY && !parts.system.startsWith('module.') && parts.system !== 'platform.core'
    ? systemPath(parts.system) + '/' + parts.section
    : addressOf(contributor, id);
}
