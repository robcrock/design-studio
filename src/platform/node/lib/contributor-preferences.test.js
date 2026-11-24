import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPreferenceProfile, transactPreferenceProfile } from './contributor-preferences.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-preferences-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'contributors'));
  fs.writeFileSync(
    path.join(root, 'contributors/sam.json'),
    JSON.stringify({
      formatVersion: 1,
      studioId: '0123456789abcdef',
      name: 'Sam',
      email: '',
      github: '',
      welcomeDismissed: false,
      preferences: { research: { keep: 3 } },
    }),
  );
  return root;
}
test('preference transactions reject foreign actors, stale versions, and symlink profiles', t => {
  const root = fixture(t);
  assert.throws(
    () => readPreferenceProfile(root, 'alex', 'sam'),
    error => error.status === 403,
  );
  const current = readPreferenceProfile(root, 'sam');
  fs.appendFileSync(current.file, '\n');
  assert.throws(
    () => transactPreferenceProfile(root, 'sam', { base: current.version, update: p => p }),
    error => error.status === 409,
  );
  fs.renameSync(current.file, current.file + '.original');
  fs.symlinkSync(current.file + '.original', current.file);
  assert.throws(() => readPreferenceProfile(root, 'sam'), /ordinary/);
});

import {
  readContributorPreferences,
  updateContributorPreferences,
  planContributorPreferences,
  applyContributorPreferences,
} from './contributor-preferences.js';
function declarations(root) {
  for (const file of ['src/platform/modules/onboarding/module.ts', 'src/platform/systems/studio/system.ts']) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(file, path.join(root, file));
  }
  // A fixture team system, so the test never depends on which team systems a studio keeps.
  fs.mkdirSync(path.join(root, 'src/systems/acme'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/systems/acme/system.ts'), "export default { studioId: 'abcdefghjkmnpqrs' };");
  const config = JSON.parse(fs.readFileSync('studio.config.json'));
  config.usage = 'personal';
  config.admins = ['0123456789abcdef'];
  config.systems = ['acme'];
  config.systemMaintainers = { abcdefghjkmnpqrs: [] };
  config.defaultSystem = 'abcdefghjkmnpqrs';
  fs.writeFileSync(path.join(root, 'studio.config.json'), JSON.stringify(config));
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  fs.writeFileSync(
    file,
    JSON.stringify({
      ...profile,
      formatVersion: 1,
      email: '',
      github: '',
      preferences: { ...profile.preferences, onboarding: { welcomeDismissed: false } },
    }),
  );
}
test('public namespace writes validate declarations and cannot change identities or other namespaces', t => {
  const root = fixture(t);
  declarations(root);
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  assert.throws(
    () =>
      updateContributorPreferences(root, {
        actor: 'sam',
        module: 'onboarding',
        base: current.version,
        value: { welcomeDismissed: 'yes' },
      }),
    error => error.status === 422,
  );
  updateContributorPreferences(root, {
    actor: 'sam',
    module: 'onboarding',
    base: current.version,
    value: { welcomeDismissed: true },
  });
  assert.throws(
    () =>
      updateContributorPreferences(root, {
        actor: 'sam',
        module: 'onboarding',
        base: current.version,
        value: { welcomeDismissed: false },
      }),
    error => error.status === 409,
  );
  const profile = readPreferenceProfile(root, 'sam').profile;
  assert.equal(profile.studioId, '0123456789abcdef');
  assert.deepEqual(profile.preferences.research, { keep: 3 });
});
test('initialization previews current namespaces, revalidates saved plans, and preserves disabled state', t => {
  const root = fixture(t);
  declarations(root);
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  delete profile.preferences.onboarding;
  profile.welcomeDismissed = true;
  fs.writeFileSync(file, JSON.stringify(profile));
  const before = fs.readFileSync(file, 'utf8');
  const plan = planContributorPreferences(root, 'sam');
  assert.equal(fs.readFileSync(file, 'utf8'), before);
  fs.appendFileSync(file, '\n');
  assert.throws(
    () => applyContributorPreferences(root, 'sam', plan),
    error => error.status === 409,
  );
  applyContributorPreferences(root, 'sam', planContributorPreferences(root, 'sam'));
  assert.equal(readPreferenceProfile(root, 'sam').profile.preferences.onboarding.welcomeDismissed, false);
  assert.equal(readPreferenceProfile(root, 'sam').profile.welcomeDismissed, true);
  assert.deepEqual(planContributorPreferences(root, 'sam').edits, []);
  const configFile = path.join(root, 'studio.config.json');
  const config = JSON.parse(fs.readFileSync(configFile));
  config.modules.onboarding = false;
  fs.writeFileSync(configFile, JSON.stringify(config));
  assert.throws(() => readContributorPreferences(root, { actor: 'sam', module: 'onboarding' }), /disabled/);
  assert.deepEqual(planContributorPreferences(root, 'sam', 'onboarding').edits, []);
  config.modules.onboarding = true;
  fs.writeFileSync(configFile, JSON.stringify(config));
  assert.equal(readContributorPreferences(root, { actor: 'sam', module: 'onboarding' }).value.welcomeDismissed, false);
  config.usage = 'team';
  config.admins = [];
  fs.writeFileSync(configFile, JSON.stringify(config));
  assert.throws(
    () => planContributorPreferences(root, 'sam'),
    error => error.status === 403,
  );
});

test('valid module IDs that match inherited properties still receive explicit namespaces', t => {
  const root = fixture(t);
  declarations(root);
  const folder = path.join(root, 'src/modules/constructor');
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(
    path.join(folder, 'module.ts'),
    "export default {id:'constructor',label:'Constructor',version:'0.1.0',requires:'0.1.0',optional:true,lib:false,preferences:{fields:{ready:'boolean'},defaults:{ready:false}}};",
  );
  const file = path.join(root, 'studio.config.json'),
    config = JSON.parse(fs.readFileSync(file));
  config.modules.constructor = true;
  fs.writeFileSync(file, JSON.stringify(config));
  applyContributorPreferences(root, 'sam', planContributorPreferences(root, 'sam'));
  const current = readContributorPreferences(root, { actor: 'sam', module: 'constructor' });
  assert.deepEqual(current.value, { ready: false });
  assert.equal(Object.hasOwn(readPreferenceProfile(root, 'sam').profile.preferences, 'constructor'), true);
});

test('namespace writes retain omitted custom fields and all other contributor data', t => {
  const root = fixture(t);
  declarations(root);
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  profile.custom = { retained: ['owned'] };
  profile.preferences.onboarding.custom = { retained: ['module-owned'] };
  fs.writeFileSync(file, JSON.stringify(profile));
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  updateContributorPreferences(root, {
    actor: 'sam',
    module: 'onboarding',
    base: current.version,
    value: { welcomeDismissed: true },
  });
  const after = JSON.parse(fs.readFileSync(file));
  assert.deepEqual(after, {
    ...profile,
    preferences: { ...profile.preferences, onboarding: { ...profile.preferences.onboarding, welcomeDismissed: true } },
  });
});

test('ordinary preferences reject unsupported formats and invalid envelopes without changing source', t => {
  const root = fixture(t);
  declarations(root);
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  for (const change of [
    { formatVersion: 2 },
    { formatVersion: 999 },
    { formatVersion: undefined },
    { preferences: undefined },
    { preferences: [] },
    { preferences: { ...profile.preferences, other: [] } },
    { studioId: 'invalid' },
  ]) {
    fs.writeFileSync(file, JSON.stringify({ ...profile, ...change }));
    const source = fs.readFileSync(file, 'utf8');
    assert.throws(
      () => readContributorPreferences(root, { actor: 'sam', module: 'onboarding' }),
      error => error.status === 422,
    );
    assert.throws(
      () =>
        updateContributorPreferences(root, {
          actor: 'sam',
          module: 'onboarding',
          base: 'unused',
          value: { welcomeDismissed: true },
        }),
      error => error.status === 422,
    );
    assert.throws(
      () => planContributorPreferences(root, 'sam'),
      error => error.status === 422,
    );
    assert.equal(fs.readFileSync(file, 'utf8'), source);
  }
});

test('non-JSON input cannot erase custom namespace fields', t => {
  const root = fixture(t);
  declarations(root);
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  profile.preferences.onboarding.custom = 'keep';
  fs.writeFileSync(file, JSON.stringify(profile));
  const source = fs.readFileSync(file, 'utf8');
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  for (const custom of [undefined, () => null, new Date(), NaN])
    assert.throws(
      () =>
        updateContributorPreferences(root, {
          actor: 'sam',
          module: 'onboarding',
          base: current.version,
          value: { welcomeDismissed: true, custom },
        }),
      error => error.status === 422,
    );
  assert.equal(fs.readFileSync(file, 'utf8'), source);
});

test('installed executable declarations share loading without unrelated preference failures', async t => {
  const root = fixture(t);
  declarations(root);
  const folder = path.join(root, 'src/platform/modules/onboarding');
  const original = fs.readFileSync(path.join(folder, 'module.ts'), 'utf8');
  fs.writeFileSync(path.join(folder, 'defaults.ts'), 'export const defaults = {welcomeDismissed:false};');
  fs.writeFileSync(
    path.join(folder, 'module.ts'),
    "import {defaults} from './defaults.ts';\n" + original.replace('defaults: { welcomeDismissed: false }', 'defaults'),
  );
  // The supplied declaration has an executable helper; an unrelated valid declaration does too.
  const unrelated = path.join(root, 'src/modules/unrelated');
  fs.mkdirSync(unrelated, { recursive: true });
  fs.writeFileSync(
    path.join(unrelated, 'module.ts'),
    "const label='Unrelated'; export default {id:'unrelated',label,version:'0.1.0',requires:'0.1.0',optional:true,lib:false};",
  );
  const { installedModuleDeclarations } = await import('./installed-module-declarations.js');
  const installed = installedModuleDeclarations(root);
  assert.equal(installed.find(d => d.id === 'unrelated').spec.label, 'Unrelated');
  assert.deepEqual(readContributorPreferences(root, { actor: 'sam', module: 'onboarding' }).value, {
    welcomeDismissed: false,
  });
  fs.writeFileSync(path.join(unrelated, 'module.ts'), "throw new Error('unrelated broken module');");
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  updateContributorPreferences(root, {
    actor: 'sam',
    module: 'onboarding',
    base: current.version,
    value: { welcomeDismissed: true },
  });
  assert.equal(readContributorPreferences(root, { actor: 'sam', module: 'onboarding' }).value.welcomeDismissed, true);
});

test('a loaded declaration edit rejects writes until restart instead of silently using a stale schema', t => {
  const root = fixture(t);
  declarations(root);
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  const file = path.join(root, 'contributors/sam.json'),
    source = fs.readFileSync(file, 'utf8');
  fs.appendFileSync(path.join(root, 'src/platform/modules/onboarding/module.ts'), '\n// edited declaration\n');
  assert.throws(
    () =>
      updateContributorPreferences(root, {
        actor: 'sam',
        module: 'onboarding',
        base: current.version,
        value: { welcomeDismissed: true },
      }),
    error => error.status === 409 && /restart/.test(error.message),
  );
  assert.equal(fs.readFileSync(file, 'utf8'), source);
});

test('accessors cannot run or delete persisted preference fields', t => {
  const root = fixture(t);
  declarations(root);
  const file = path.join(root, 'contributors/sam.json');
  const profile = JSON.parse(fs.readFileSync(file));
  profile.preferences.onboarding.custom = 'keep me';
  fs.writeFileSync(file, JSON.stringify(profile));
  const source = fs.readFileSync(file, 'utf8');
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  let calls = 0;
  for (const value of [
    {
      welcomeDismissed: true,
      get custom() {
        calls++;
        return undefined;
      },
    },
    {
      get welcomeDismissed() {
        calls++;
        return true;
      },
    },
  ]) {
    assert.throws(
      () => updateContributorPreferences(root, { actor: 'sam', module: 'onboarding', base: current.version, value }),
      error => error.status === 422,
    );
    assert.equal(fs.readFileSync(file, 'utf8'), source);
  }
  assert.equal(calls, 0);
});

test('declaration snapshots share physical file identity and isolate native exports', async t => {
  const root = fixture(t);
  declarations(root);
  const alias = root + '-alias';
  fs.symlinkSync(root, alias);
  t.after(() => fs.rmSync(alias, { force: true }));
  const { installedModuleDeclaration } = await import('./installed-module-declarations.js');
  const { createRequire } = await import('node:module');
  const first = installedModuleDeclaration(root, 'onboarding');
  const native = createRequire(import.meta.url)(path.join(root, 'src/platform/modules/onboarding/module.ts')).default;
  native.preferences.defaults.welcomeDismissed = true;
  first.spec.preferences.defaults.welcomeDismissed = true;
  assert.equal(installedModuleDeclaration(alias, 'onboarding').spec.preferences.defaults.welcomeDismissed, false);
  const current = readContributorPreferences(root, { actor: 'sam', module: 'onboarding' });
  const profile = path.join(root, 'contributors/sam.json'),
    source = fs.readFileSync(profile, 'utf8');
  fs.appendFileSync(path.join(root, 'src/platform/modules/onboarding/module.ts'), '\n// source changed\n');
  for (const directory of [root, alias])
    assert.throws(
      () =>
        updateContributorPreferences(directory, {
          actor: 'sam',
          module: 'onboarding',
          base: current.version,
          value: { welcomeDismissed: true },
        }),
      error => error.status === 409,
    );
  assert.equal(fs.readFileSync(profile, 'utf8'), source);
});
