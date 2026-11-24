import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeProfiles } from './fixtures/contributors.js';
import { writeFixtureConfig } from './fixtures/identities.js';
import { markdownIdentity } from '../../core/resourceIdentity.ts';
import {
  planPrototypeIdentification,
  applyPrototypeIdentification,
  identifyAuthored,
  prototypeFolderOf,
} from './prototype-identification.js';

const types = {
  document: { systemUsage: 'independent', inPrototype: true, extensions: ['.md'], identity: markdownIdentity },
};
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-identify-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  writeProfiles(root, { admin: { name: 'Admin' }, pat: { name: 'Pat' }, sam: { name: 'Sam' } });
  writeFixtureConfig(root, {
    usage: 'team',
    admins: ['admin'],
    systems: ['product'],
    defaultSystem: 'product',
    systemMaintainers: { product: [] },
    modules: {},
  });
  const folder = 'src/prototypes/pat/example';
  fs.mkdirSync(path.join(root, folder), { recursive: true });
  fs.writeFileSync(path.join(root, folder, 'meta.json'), '{"formatVersion":1,"title":"Example","systemId":null}');
  fs.writeFileSync(path.join(root, folder, 'notes.md'), '# Notes\n');
  return { root, folder };
}

test('explicit authoring assigns only missing IDs, preserves dependencies, and is idempotent', t => {
  const { root, folder } = fixture(t);
  fs.mkdirSync(path.join(root, 'src/prototypes/sam/unrelated'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/prototypes/sam/unrelated/meta.json'), '{"title":"Other","systemId":null}');
  const plan = planPrototypeIdentification(root, types, folder, 'pat');
  assert.equal(fs.readFileSync(path.join(root, folder, 'notes.md'), 'utf8'), '# Notes\n');
  const result = applyPrototypeIdentification(root, types, plan, 'pat');
  assert.equal(result.changed, 2);
  const meta = JSON.parse(fs.readFileSync(path.join(root, folder, 'meta.json')));
  assert.equal(meta.ownerContributorId, JSON.parse(fs.readFileSync(path.join(root, 'contributors/pat.json'))).studioId);
  assert.equal(meta.systemId, null);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(root, 'src/prototypes/sam/unrelated/meta.json'))).studioId,
    undefined,
  );
  assert.equal(planPrototypeIdentification(root, types, folder, 'pat').changes.length, 0);
  assert.ok(fs.readFileSync(path.join(root, folder, 'notes.md'), 'utf8').endsWith('# Notes\n'));
});

test('scoped assignment rejects other owners, changed authority, edited previews, and malformed IDs', t => {
  const { root, folder } = fixture(t);
  assert.throws(() => planPrototypeIdentification(root, types, folder, 'sam'), /Only the prototype owner/);
  const plan = planPrototypeIdentification(root, types, folder, 'admin');
  assert.throws(() => applyPrototypeIdentification(root, types, plan, 'sam'), /Only the prototype owner/);
  assert.throws(
    () => applyPrototypeIdentification(root, types, { ...plan, changes: [] }, 'pat'),
    /preview or inventory changed/,
  );
  fs.writeFileSync(path.join(root, folder, 'notes.md'), '---\nstudioId: invalid\n---\n');
  assert.throws(() => planPrototypeIdentification(root, types, folder, 'pat'), /16 lowercase/);
});

test('inventory additions and owner spoofing invalidate a reviewed assignment before any write', t => {
  const { root, folder } = fixture(t);
  const plan = planPrototypeIdentification(root, types, folder, 'pat');
  fs.writeFileSync(path.join(root, folder, 'new.md'), '# New');
  assert.throws(() => applyPrototypeIdentification(root, types, plan, 'pat'), /preview or inventory changed/);
  const other = JSON.parse(fs.readFileSync(path.join(root, 'contributors/sam.json'))).studioId;
  fs.writeFileSync(
    path.join(root, folder, 'meta.json'),
    JSON.stringify({ title: 'Example', ownerContributorId: other }),
  );
  assert.throws(() => planPrototypeIdentification(root, types, folder, 'admin'), /owner identity/);
});

test('direct authoring never infers an omitted assignment from the configured default', t => {
  const { root, folder } = fixture(t),
    file = path.join(root, folder, 'meta.json');
  const before = '{"title":"Example"}';
  fs.writeFileSync(file, before);
  assert.throws(() => planPrototypeIdentification(root, types, folder, 'pat'), /declare systemId explicitly/);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  assert.equal(fs.readFileSync(path.join(root, folder, 'notes.md'), 'utf8'), '# Notes\n');
});

test('scoped allocation retries collisions, rejects exhausted allocation and outside paths without writing', t => {
  const { root, folder } = fixture(t);
  const owner = JSON.parse(fs.readFileSync(path.join(root, 'contributors/pat.json'))).studioId;
  let attempts = 0;
  assert.throws(
    () =>
      planPrototypeIdentification(root, types, folder, 'pat', {
        generate: () => {
          attempts++;
          return owner;
        },
      }),
    /could not allocate/,
  );
  assert.equal(attempts, 32);
  const sequence = [owner, 'zzzzzzzzzzzzzzzz', 'zzzzzzzzzzzzzzzz', 'yyyyyyyyyyyyyyyy'];
  const plan = planPrototypeIdentification(root, types, folder, 'pat', { generate: () => sequence.shift() });
  assert.equal(plan.changes.length, 2);
  assert.equal(new Set(plan.resources.map(resource => resource.studioId)).size, 2);
  assert.throws(
    () =>
      planPrototypeIdentification(root, types, folder, 'pat', {
        ids: { '../outside.json': 'zzzzzzzzzzzzzzzz' },
      }),
    /outside the current inventory/,
  );
  assert.equal(fs.readFileSync(path.join(root, folder, 'notes.md'), 'utf8'), '# Notes\n');
});

test('a scoped assignment write failure restores earlier files', t => {
  const { root, folder } = fixture(t);
  const plan = planPrototypeIdentification(root, types, folder, 'pat');
  const rename = fs.renameSync;
  let calls = 0;
  t.mock.method(fs, 'renameSync', (...args) => {
    if (++calls === 2) throw new Error('Injected assignment failure');
    return rename(...args);
  });
  assert.throws(() => applyPrototypeIdentification(root, types, plan, 'pat'), /Injected assignment failure/);
  for (const change of plan.changes) assert.equal(fs.readFileSync(path.join(root, change.path), 'utf8'), change.before);
});

test('scoped assignment rollback preserves a concurrent edit and reports required recovery', t => {
  const { root, folder } = fixture(t);
  const plan = planPrototypeIdentification(root, types, folder, 'pat');
  const rename = fs.renameSync;
  let calls = 0;
  const concurrent = path.join(root, plan.changes[0].path);
  t.mock.method(fs, 'renameSync', (...args) => {
    if (++calls === 2) {
      fs.writeFileSync(concurrent, 'Concurrent editor content\n');
      throw new Error('Injected later failure');
    }
    return rename(...args);
  });
  assert.throws(() => applyPrototypeIdentification(root, types, plan, 'pat'), /some files could not be restored/);
  assert.equal(fs.readFileSync(concurrent, 'utf8'), 'Concurrent editor content\n');
  assert.equal(fs.readFileSync(path.join(root, plan.changes[1].path), 'utf8'), plan.changes[1].before);
});

test('authoring tools identify only the touched folders the contributor may edit', t => {
  const { root, folder } = fixture(t);
  const other = 'src/prototypes/sam/unrelated';
  fs.mkdirSync(path.join(root, other), { recursive: true });
  fs.writeFileSync(path.join(root, other, 'meta.json'), '{"formatVersion":1,"title":"Other","systemId":null}');
  const touched = [`${folder}/notes.md`, `${other}/meta.json`, 'src/systems/product/system.ts'].map(prototypeFolderOf);
  assert.deepEqual(touched, [folder, other, null]);
  let resolved = 0;
  const results = identifyAuthored(root, types, touched, () => (resolved++, 'pat'));
  assert.equal(resolved, 1);
  assert.equal(results.find(result => result.folder === folder).changed, 2);
  assert.match(results.find(result => result.folder === other).error.message, /Only the prototype owner/);
  assert.equal(
    fs.readFileSync(path.join(root, other, 'meta.json'), 'utf8'),
    '{"formatVersion":1,"title":"Other","systemId":null}',
  );
  // Nothing left to assign: no contributor lookup, no writes.
  assert.deepEqual(
    identifyAuthored(root, types, [folder], () => assert.fail('resolved')),
    [],
  );
  assert.deepEqual(
    identifyAuthored(root, types, [null], () => assert.fail('resolved')),
    [],
  );
});
