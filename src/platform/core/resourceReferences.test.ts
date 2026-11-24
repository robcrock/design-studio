import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resourceDirectory,
  resolveStudioReferences,
  persistStudioReferences,
  systemKeyForIdentity,
} from './resourceReferences.ts';
import type { StudioConfig } from './config.ts';

const contributorId = '0123456789abcdef',
  platformId = 'abcdefghjkmnpqrs',
  systemId = '23456789abcdefgh';
const makeDirectory = (contributor = 'pat', system = 'product') =>
  resourceDirectory(
    { [contributor]: { studioId: contributorId } },
    { studio: { studioId: platformId }, [system]: { studioId: systemId } },
  );
const source: StudioConfig = {
  formatVersion: 1,
  name: 'Studio',
  usage: 'team',
  modules: {},
  systems: ['studio', 'product'],
  defaultSystem: systemId,
  admins: [contributorId],
  systemMaintainers: { [systemId]: [contributorId] },
  assetLimitKB: 750,
};

test('persisted relationships resolve independently of contributor and system source names', () => {
  const original = makeDirectory();
  const runtime = resolveStudioReferences(source, original);
  assert.equal(runtime.defaultSystem, 'product');
  assert.deepEqual(runtime.admins, ['pat']);
  assert.deepEqual(runtime.systemMaintainers, { product: ['pat'] });
  assert.deepEqual(persistStudioReferences(runtime, original), source);
  const renamed = makeDirectory('morgan', 'team-kit');
  const relocated = resolveStudioReferences({ ...source, systems: ['studio', 'team-kit'] }, renamed);
  assert.equal(relocated.defaultSystem, 'team-kit');
  assert.deepEqual(relocated.admins, ['morgan']);
  assert.deepEqual(relocated.systemMaintainers, { 'team-kit': ['morgan'] });
  assert.equal(persistStudioReferences(relocated, renamed).defaultSystem, systemId);
  assert.deepEqual(source.admins, [contributorId]);
});

test('reference projection rejects missing, duplicate, malformed and wrong-kind identities', () => {
  assert.throws(() => resourceDirectory({ pat: {} }, {}), /valid permanent/);
  assert.throws(
    () => resourceDirectory({ pat: { studioId: contributorId } }, { product: { studioId: contributorId } }),
    /already declared/,
  );
  assert.throws(() => resourceDirectory({}, { '../product': { studioId: systemId } }), /source key/);
  const directory = makeDirectory();
  for (const id of ['product', 'invalid', contributorId, '3456789abcdefghj'])
    assert.throws(() => systemKeyForIdentity(id, directory));
  assert.throws(() => resolveStudioReferences({ ...source, admins: [systemId] }, directory), /Unknown Admin/);
  assert.throws(
    () => resolveStudioReferences({ ...source, systemMaintainers: { [contributorId]: [] } }, directory),
    /Unknown maintained/,
  );
  assert.throws(
    () => persistStudioReferences({ ...source, defaultSystem: '../product' }, directory),
    /Unknown default/,
  );
  assert.throws(
    () => resolveStudioReferences({ ...source, admins: [contributorId, contributorId] }, directory),
    /unique references/,
  );
  assert.throws(
    () =>
      resolveStudioReferences(
        { ...source, systemMaintainers: { [systemId]: [contributorId, contributorId] } },
        directory,
      ),
    /unique references/,
  );
});

test('before-side projection cannot obtain proposed grants from an after-side declaration', () => {
  const directory = resourceDirectory(
    { admin: { studioId: contributorId }, member: { studioId: '3456789abcdefghj' } },
    { studio: { studioId: platformId }, product: { studioId: systemId } },
  );
  const before = resolveStudioReferences(source, directory);
  const proposed = resolveStudioReferences({ ...source, admins: ['3456789abcdefghj'] }, directory);
  assert.deepEqual(before.admins, ['admin']);
  assert.deepEqual(proposed.admins, ['member']);
  assert.ok(!before.admins!.includes('member'));
  assert.ok(Object.isFrozen(directory) && Object.isFrozen(directory.contributorKeys));
});
