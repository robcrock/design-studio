import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import path from 'node:path';
import { createServer } from 'vite';
const server = await createServer({
  configFile: path.resolve('vite.config.ts'),
  configLoader: 'native',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});
after(() => server.close());
const client = await server.ssrLoadModule('/platform/api/data.ts');
const { onMutation } = await server.ssrLoadModule('/platform/app/data/mutations.ts');
const parent = '0123456789abcdef',
  child = 'abcdefghjkmnpqrs';
const proto = {
  studioId: parent,
  id: 'demo',
  contributorKey: 'test',
  title: 'Demo',
  system: null,
  artifacts: [{ studioId: child, path: 'new.tsx', fileType: 'view' }],
};
const manifest = () => ({
  prototypes: [proto],
  sections: {},
  systemContent: [],
  contributions: {},
  systemContentMaps: {},
});

test('generic mutations apply successful inventories once, attribute the tab, and return identities before navigation', async t => {
  let refreshes = 0;
  const stop = onMutation(() => refreshes++);
  t.after(stop);
  const headers = [];
  let latest;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    headers.push(init.headers['X-Studio-Tab']);
    latest = manifest();
    return new Response(
      JSON.stringify({
        contributor: 'test',
        prototype: 'demo',
        path: 'new.tsx',
        manifest: latest,
        trashedTo: '/trash',
      }),
    );
  });
  for (const operation of [
    { op: 'create', path: '', name: 'new.tsx' },
    { op: 'rename', path: 'old.tsx', name: 'new.tsx' },
    { op: 'move', path: 'old.tsx', to: '' },
    { op: 'reorder', path: 'new.tsx', before: '' },
    { op: 'delete', path: 'old.tsx' },
    { op: 'meta', title: 'Renamed' },
  ]) {
    const result = await client.fileOp(proto, operation);
    assert.equal(result.artifactId, child);
    assert.deepEqual(await client.loadManifest(), latest);
  }
  assert.equal((await client.createPrototype('Demo', null)).prototypeId, parent);
  assert.equal((await client.duplicatePrototype(proto, { title: 'Copy', system: null })).prototypeId, parent);
  assert.equal((await client.renamePrototype(proto, { title: 'Rename' })).prototypeId, parent);
  await client.deletePrototype(proto);
  assert.equal(refreshes, 10);
  assert.ok(headers.every(h => h && h === headers[0]));
});

test('failed or malformed replies cannot replace the current inventory; source conflicts remain typed', async t => {
  const before = await client.loadManifest();
  let refreshes = 0;
  const stop = onMutation(() => refreshes++);
  t.after(stop);
  for (const response of [
    () => new Response('{"error":"Denied"}', { status: 403 }),
    () => new Response('{"manifest":null}'),
    () => new Response('{"prototype":"missing","manifest":' + JSON.stringify(manifest()) + '}'),
  ]) {
    t.mock.method(globalThis, 'fetch', async () => response());
    await assert.rejects(client.createPrototype('Fails', null));
    assert.equal(await client.loadManifest(), before);
  }
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{"error":"Stale source","code":"changed"}', { status: 409 }),
  );
  await assert.rejects(
    client.writeSource(proto, 'new.tsx', 'new', 'old'),
    error => error instanceof client.SourceChanged && error.code === 'source_changed' && error.status === 409,
  );
  // Removing the studio ID is refused with its own message, not treated as a newer version on disk.
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('{"error":"Keep the ID","code":"identity"}', { status: 409 }),
  );
  await assert.rejects(
    client.writeSource(proto, 'new.tsx', 'new', 'old'),
    error => !(error instanceof client.SourceChanged) && error.message === 'Keep the ID',
  );
  assert.equal(refreshes, 0);
});

test('this tab serializes concurrent mutations and recovers after a rejected operation', async t => {
  let resolveFirst,
    calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1)
      return new Promise(resolve => {
        resolveFirst = resolve;
      });
    return new Response(JSON.stringify({ manifest: manifest() }));
  });
  const first = client.fileOp(proto, { op: 'meta', title: 'First' }),
    second = client.fileOp(proto, { op: 'meta', title: 'Second' });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  resolveFirst(new Response('{"error":"Rejected"}', { status: 400 }));
  await assert.rejects(first);
  await second;
  assert.equal(calls, 2);
});
