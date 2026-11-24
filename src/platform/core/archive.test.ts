// How archived prototypes are left out of a deploy (archive.ts). Run with `pnpm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forDeploy, linksToArchived, parseStatus } from './archive.ts';

const proto = (id: string, extra: object = {}) => ({ id, contributorKey: 'samples', ...extra });

test('parseStatus accepts only statuses', () => {
  assert.equal(parseStatus('archived'), 'archived');
  assert.equal(parseStatus('active'), 'active');
  assert.equal(parseStatus('done'), null);
  assert.equal(parseStatus(undefined), null);
  assert.equal(parseStatus(3), null);
});

test('a deploy keeps active prototypes as they are', () => {
  const p = proto('a');
  assert.deepEqual(forDeploy([p]), { kept: [p], archived: [] });
});

test('a deploy leaves out an archived prototype whole', () => {
  const { kept, archived } = forDeploy([proto('old', { status: 'archived' }), proto('new')]);
  assert.deepEqual(
    kept.map(p => p.id),
    ['new'],
  );
  assert.deepEqual(archived, ['/prototypes/samples/old/**']);
});

test('a download keeps only its prototype, archived or not', () => {
  const { kept, archived } = forDeploy([proto('a'), proto('b', { status: 'archived' })], 'samples/b');
  assert.deepEqual(
    kept.map(p => p.id),
    ['b'],
  );
  assert.deepEqual(archived, ['/prototypes/samples/a/**']);
});

test('a canvas link into an archived prototype is found, but not into one with a longer name', () => {
  const canvas = '{"link":"http://localhost:5173/samples/old/lofi/main"}';
  assert.deepEqual(linksToArchived(canvas, ['/samples/old']), ['/samples/old']);
  assert.deepEqual(linksToArchived('{"link":"http://localhost:5173/samples/older/lofi/main"}', ['/samples/old']), []);
});

test('a link at the end of a sentence, or with nothing after it, is still found', () => {
  assert.deepEqual(linksToArchived('Open /samples/old.', ['/samples/old']), ['/samples/old']);
  assert.deepEqual(linksToArchived('Open /samples/old', ['/samples/old']), ['/samples/old']);
});
