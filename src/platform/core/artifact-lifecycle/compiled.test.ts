import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCompiledTracker } from './compiled.ts';
import { freshness } from './state.ts';
import type { RevisionSnapshot } from './inputs.ts';
const a: RevisionSnapshot = {
  source: 'a'.repeat(64),
  inputs: '1'.repeat(64),
  sources: [['/screen.tsx', 'a'.repeat(64)]],
};
const b: RevisionSnapshot = {
  source: 'b'.repeat(64),
  inputs: '2'.repeat(64),
  sources: [['/screen.tsx', 'b'.repeat(64)]],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}
test('a React commit with older compiled inputs cannot acknowledge new source', async () => {
  let disk = a,
    compiled = a;
  const tracker = createCompiledTracker(
    async () => disk,
    () => {},
    value => value.inputs === compiled.inputs,
  );
  await tracker.ready();
  assert.equal(freshness(tracker.state), 'current');
  disk = b;
  await tracker.invalidate();
  await tracker.ready();
  assert.equal(freshness(tracker.state), 'stale');
  assert.equal(tracker.state.phase, 'preparing');
  await tracker.failed('syntax error', true);
  await tracker.begin();
  await tracker.ready();
  assert.equal(tracker.state.phase, 'error');
  assert.deepEqual(tracker.state.displayed?.revision, a);
  compiled = b;
  await tracker.ready();
  assert.equal(tracker.state.phase, 'ready');
  assert.equal(freshness(tracker.state), 'current');
  tracker.dispose();
});
test('newer reads and disposal defeat late acknowledgements', async () => {
  const first = deferred<RevisionSnapshot>(),
    second = deferred<RevisionSnapshot>();
  let count = 0;
  const tracker = createCompiledTracker(
    () => (++count === 1 ? first.promise : second.promise),
    () => {},
    () => true,
  );
  const old = tracker.ready(),
    next = tracker.ready();
  second.resolve(b);
  await next;
  first.resolve(a);
  await old;
  assert.deepEqual(tracker.state.source, b);
  assert.equal(tracker.state.activity, null);
  const pending = deferred<RevisionSnapshot>();
  const disposed = createCompiledTracker(
    () => pending.promise,
    () => {},
    () => true,
  );
  const job = disposed.ready();
  disposed.dispose();
  pending.resolve(a);
  await job;
  assert.equal(disposed.state.phase, 'disposed');
  tracker.dispose();
});
test('a missing compilation acknowledgement has a bounded unknown outcome', async () => {
  const tracker = createCompiledTracker(
    async () => b,
    () => {},
    () => false,
    5,
  );
  await tracker.ready();
  assert.equal(tracker.state.phase, 'preparing');
  await new Promise(done => setTimeout(done, 20));
  assert.equal(tracker.state.phase, 'unknown');
  assert.match(tracker.state.detail, /could not be verified/);
  tracker.dispose();
});

test('inputs a view loads lazily after its commit are acknowledged without another commit', async () => {
  let loaded = false;
  const tracker = createCompiledTracker(
    async () => a,
    () => {},
    () => loaded,
    200,
    5,
  );
  await tracker.ready();
  assert.equal(tracker.state.phase, 'preparing');
  loaded = true; // e.g. a panel imported from an effect finishes evaluating
  await new Promise(done => setTimeout(done, 30));
  assert.equal(tracker.state.phase, 'ready');
  assert.equal(freshness(tracker.state), 'current');
  tracker.dispose();
});

test('a late compilation error cannot mark already committed repaired inputs as failed', async () => {
  let disk = a,
    compiled = a;
  const tracker = createCompiledTracker(
    async () => disk,
    () => {},
    snapshot => snapshot.inputs === compiled.inputs,
  );
  await tracker.ready();
  disk = b;
  await tracker.compilationFailed('broken source');
  assert.equal(tracker.state.phase, 'error');
  assert.equal(freshness(tracker.state), 'stale');
  compiled = b;
  await tracker.ready();
  await tracker.compilationFailed('obsolete error');
  assert.equal(tracker.state.phase, 'ready');
  assert.equal(freshness(tracker.state), 'current');
  tracker.dispose();
});
