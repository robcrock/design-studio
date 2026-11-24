// Metadata inspection does not import format open.tsx modules or mount their renderers.
import { MODULES } from '../data/modules';
import { isEnabled } from '../data/config';
import { compatible } from '../../core/modules';
import { FILE_TYPES } from '../data/fileTypeSpecs';
import { artifactAvailability, type EmbedSurface, type HostSurfaceSpec } from '../../core/fileTypes';
import { parsePrototypeAddress } from '../../core/resourceIdentity';
import { isSectionKey } from '../../core/roots';
import { allPrototypes, loadManifest, withItems } from '../data/manifest';
import type { ArtifactContext } from '../data/fileTypeModule';
import type { Manifest, Prototype, PrototypeRef } from '../data/types';
import { artifactReference } from './artifactReference';
import { appPathOf, artifactPath, resolveArtifactPath } from './artifactLinks';

export type AvailabilityCode =
  | 'invalid_reference'
  | 'unavailable'
  | 'inactive_format'
  | 'unsupported_scope'
  | 'unsupported_surface'
  | 'missing_system'
  | 'unsupported_preview';
export type ArtifactRequest = { reference: string; origin: ArtifactContext; surface: EmbedSurface };
export type ArtifactResolution =
  | { state: 'pending'; reason: 'inventory' }
  | { state: 'unavailable'; code: AvailabilityCode; message: string }
  | {
      state: 'resolved';
      target: Readonly<ArtifactContext>;
      href: string;
      typeLabel: string;
      presentation: 'preview' | 'card';
      preview: { available: boolean; code?: AvailabilityCode; message?: string };
      // The screens a live preview of it can be laid out at: its system's, for a type that uses one. The first is the default.
      screens?: Readonly<Prototype['screens']>;
    };
const hosts: HostSurfaceSpec[] = [
  { id: 'document', scopes: ['prototype'], references: 'same-prototype' },
  ...MODULES.filter(m => compatible(m) && isEnabled(m.id)).flatMap(m => m.hosts ?? []),
];
const unavailable = (code: AvailabilityCode, message: string): ArtifactResolution => ({
  state: 'unavailable',
  code,
  message,
});
const same = (a: PrototypeRef, b: PrototypeRef) =>
  a.contributorKey === b.contributorKey && a.id === b.id && a.studioId === b.studioId;
function locate(request: ArtifactRequest, manifest: Manifest) {
  const origin = allPrototypes(manifest).find(p => same(p, request.origin.proto));
  if (!origin) return { error: unavailable('unavailable', 'The origin prototype is unavailable.') };
  const scope: 'prototype' | 'systemContent' = isSectionKey(origin.contributorKey) ? 'systemContent' : 'prototype';
  const host = hosts.find(h => h.id === request.surface);
  if (!host) return { error: unavailable('unsupported_surface', 'This artifact host is unavailable.') };
  if (!host.scopes.includes(scope))
    return { error: unavailable('unsupported_scope', 'This host does not support this content scope.') };
  if (!origin.artifacts) return { pending: origin };
  const originItem = origin.artifacts.find(
    i => i.studioId === request.origin.item.studioId && i.path === request.origin.item.path,
  );
  if (!originItem) return { error: unavailable('unavailable', 'The origin artifact is unavailable.') };
  const path = parsePrototypeAddress(request.reference)?.artifactId ? request.reference : appPathOf(request.reference);
  if (path) {
    const address = parsePrototypeAddress(path);
    if (address && address.prototypeId !== origin.studioId)
      return { error: unavailable('unsupported_scope', 'Choose an artifact inside this prototype.') };
    const target = resolveArtifactPath(manifest, path);
    if (target && !same(target.proto, origin))
      return { error: unavailable('unsupported_scope', 'Choose an artifact inside this prototype.') };
    return { target, origin, scope };
  }
  const folder = originItem.path.includes('/') ? originItem.path.slice(0, originItem.path.lastIndexOf('/')) : '';
  const base = `/prototypes/${origin.contributorKey}/${origin.id}${folder ? '/' + folder : ''}`;
  const reference = artifactReference(request.reference, base);
  if (!reference) return { error: unavailable('invalid_reference', 'Choose a file inside this prototype.') };
  const item = origin.artifacts.find(i => i.path === reference.path);
  return { target: item ? { proto: origin as Prototype, item } : null, origin, scope };
}
export function inspectArtifact(request: ArtifactRequest, manifest: Manifest): ArtifactResolution {
  const found = locate(request, manifest);
  if (found.error) return found.error;
  if (found.pending) return { state: 'pending', reason: 'inventory' };
  const target = found.target;
  if (!target) return unavailable('unavailable', 'File unavailable. Check its path and whether its module is enabled.');
  const spec = FILE_TYPES[target.item.fileType];
  if (!spec)
    return unavailable(
      MODULES.some(m => m.id === target.item.fileType) ? 'inactive_format' : 'unavailable',
      'This artifact format is unavailable.',
    );
  const state = artifactAvailability(spec, {
    local: false,
    editable: false,
    present: true,
    renderer: true,
    scope: found.scope!,
    ...target.proto,
  }).embeds[request.surface];
  const available = state?.available === true;
  const code: AvailabilityCode =
    target.proto.systemMissing && spec.systemUsage === 'assigned' ? 'missing_system' : 'unsupported_preview';
  return {
    state: 'resolved',
    target,
    href: artifactPath(target.proto, target.item),
    typeLabel: spec.label,
    ...(available && spec.systemUsage === 'assigned' && { screens: target.proto.screens }),
    presentation: available ? 'preview' : 'card',
    preview: available
      ? { available: true }
      : {
          available: false,
          code,
          message: state && !state.available ? state.reason : 'This artifact does not support this host.',
        },
  };
}
export async function resolveArtifact(
  request: ArtifactRequest,
  options: { signal?: AbortSignal; manifest?: Manifest } = {},
): Promise<ArtifactResolution> {
  options.signal?.throwIfAborted();
  const manifest = options.manifest ?? (await loadManifest());
  let result = inspectArtifact(request, manifest);
  if (result.state === 'pending') {
    const located = locate(request, manifest);
    if (located.pending) await withItems(located.pending);
    options.signal?.throwIfAborted();
    result = inspectArtifact(request, manifest);
  }
  return result;
}
