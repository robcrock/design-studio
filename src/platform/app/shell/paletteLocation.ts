import { findArtifact, findArtifactByIdentity, findPrototype, firstArtifact } from '@/platform/app/data/manifest';
import type { Manifest, Prototype } from '@/platform/app/data/types';

type Params = { contributor?: string; prototype?: string; artifact?: string; _splat?: string };

export function paletteLocation(manifest: Manifest, params: Params) {
  const ref = params.prototype
    ? params.contributor
      ? findPrototype(manifest, params.contributor, params.prototype)
      : manifest.prototypes.find(proto => proto.studioId === params.prototype)
    : undefined;
  const current = ref?.artifacts ? (ref as Prototype) : undefined;
  const item =
    current &&
    (params.artifact
      ? findArtifactByIdentity(current, params.artifact)
      : params._splat
        ? findArtifact(current, params._splat)
        : firstArtifact(current));
  return { current, item };
}
