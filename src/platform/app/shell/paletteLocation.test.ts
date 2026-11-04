import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import type { Manifest, Prototype } from '@/platform/app/data/types';

const server = await createServer({
  configFile: path.resolve('vite.config.ts'),
  configLoader: 'native',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});
after(() => server.close());
const { paletteLocation } = await server.ssrLoadModule('/platform/app/shell/paletteLocation.ts');

function fixture() {
  const proto: Prototype = {
    studioId: '0123456789abcdef',
    contributorKey: 'alice',
    id: 'renamed-project',
    title: 'Project',
    contributor: 'Alice',
    created: null,
    system: null,
    artifacts: [
      { studioId: 'abcdefghjkmnpqrs', path: 'start.tsx', fileType: 'view' },
      { studioId: 'stuvwxyz01234567', path: 'nested/renamed.tsx', fileType: 'view' },
    ],
  };
  const section: Prototype = { ...proto, studioId: undefined, contributorKey: 'examples', id: 'tour' };
  const manifest: Manifest = {
    prototypes: [proto],
    sections: { examples: [section] },
    contributions: {},
    systemContent: [],
    systemContentMaps: {},
    platformReferences: [],
    skillCatalog: [],
    systems: {},
  };
  return { manifest, proto, section };
}

test('palette resolves permanent prototype and artifact IDs independently of their source paths', () => {
  const { manifest, proto } = fixture();
  const current = paletteLocation(manifest, { prototype: proto.studioId, artifact: proto.artifacts[1].studioId });
  assert.equal(current.current, proto);
  assert.equal(current.item, proto.artifacts[1]);
  assert.equal(paletteLocation(manifest, { prototype: proto.studioId }).item, proto.artifacts[0]);
  assert.equal(paletteLocation(manifest, { prototype: proto.id }).current, undefined);
});

test('palette retains contributor and artifact-path resolution for module sections', () => {
  const { manifest, section } = fixture();
  const params = { contributor: section.contributorKey, prototype: section.id };
  const current = paletteLocation(manifest, { ...params, _splat: 'nested/renamed' });
  assert.equal(current.current, section);
  assert.equal(current.item, section.artifacts[1]);
  assert.equal(paletteLocation(manifest, params).item, section.artifacts[0]);
});

test('palette does not invent a current location for unrelated, missing, or unloaded routes', () => {
  const { manifest, proto } = fixture();
  for (const params of [{}, { prototype: 'missing' }, { contributor: 'missing', prototype: proto.id }]) {
    assert.deepEqual(paletteLocation(manifest, params), { current: undefined, item: undefined });
  }
  manifest.prototypes[0] = { ...proto, artifacts: undefined };
  assert.deepEqual(paletteLocation(manifest, { prototype: proto.studioId }), { current: undefined, item: undefined });
});

test('palette keeps a missing artifact unresolved rather than selecting the first one', () => {
  const { manifest, proto } = fixture();
  const current = paletteLocation(manifest, { prototype: proto.studioId, artifact: 'missing' });
  assert.equal(current.current, proto);
  assert.equal(current.item, undefined);
});
