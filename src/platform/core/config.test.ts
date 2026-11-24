import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FORMAT_VERSIONS, formatVersionProblem } from './formats.ts';
import {
  adminProblems,
  CONFIG_KEYS,
  configProblems,
  isEnabled,
  studioRole,
  systemRegistered,
  TAGLINE_MAX,
  USAGES,
  type StudioConfig,
} from './config.ts';

const modules = [
  { id: 'contributors', optional: true },
  { id: 'documentation', optional: true },
  { id: 'prototypes', optional: false },
];
const config: StudioConfig = {
  formatVersion: 1,
  name: 'Studio',
  usage: 'team',
  admins: ['sam'],
  modules: { contributors: true, documentation: true, prototypes: true },
  systems: ['product'],
  systemMaintainers: { product: [] },
  defaultSystem: 'product',
  assetLimitKB: 750,
};
const problems = (changes: Record<string, unknown>) =>
  configProblems({ ...config, ...changes }, modules, ['product']).join('\n');

test('an explicit configuration is complete', () => {
  assert.deepEqual(configProblems(config, modules, ['product']), []);
  assert.deepEqual(
    configProblems({ ...config, usage: 'personal', modules: { ...config.modules, documentation: false } }, modules, [
      'product',
    ]),
    [],
  );
});

test('identity and optional tagline are validated', () => {
  assert.match(problems({ name: ' ' }), /add a name/);
  assert.match(problems({ usage: undefined }), /usage should/);
  assert.match(problems({ usage: 'other' }), /usage should/);
  assert.match(problems({ tagline: 'x'.repeat(141) }), /tagline/);
  assert.match(problems({ tagline: 42 }), /tagline/);
  assert.deepEqual(configProblems({ ...config, tagline: 'Our work' }, modules, ['product']), []);
  assert.match(configProblems(undefined, modules)[0], /must be a JSON object/);
  assert.match(configProblems([], modules)[0], /must be a JSON object/);
  assert.match(
    configProblems({ ...config, theme: 'dark' }, modules, ['product']).join(' '),
    /"theme" is not a setting/,
  );
  assert.match(problems({ $schema: 42 }), /\$schema should be/);
  assert.deepEqual(configProblems({ ...config, $schema: './schema.json' }, modules, ['product']), []);
});

test('Onboarding needs no studio-wide progress declaration', () => {
  const installed = [...modules, { id: 'onboarding', optional: true }];
  const enabled = { ...config, modules: { ...config.modules, onboarding: true } };
  assert.deepEqual(configProblems(enabled, installed, ['product']), []);
  assert.match(
    configProblems({ ...enabled, welcomeDismissed: true } as StudioConfig, installed, ['product']).join(' '),
    /"welcomeDismissed" is not a setting/,
  );
  assert.deepEqual(
    configProblems({ ...enabled, modules: { ...enabled.modules, onboarding: false } }, installed, ['product']),
    [],
  );
});

test('every installed module needs an explicit boolean', () => {
  assert.match(problems({ modules: undefined }), /declare every installed module/);
  assert.match(problems({ modules: { prototypes: true } }), /declare modules.documentation/);
  assert.match(problems({ modules: { ...config.modules, nope: true } }), /no module has that id/);
  assert.match(problems({ modules: { ...config.modules, documentation: 'yes' } }), /true or false/);
  assert.match(problems({ modules: [] }), /should list module ids/);
  assert.match(problems({ modules: { ...config.modules, prototypes: false } }), /can't be turned off/);
});

test('omission never activates a module', () => {
  assert.equal(isEnabled({}, 'documentation'), false);
  assert.equal(isEnabled({ modules: {} }, 'documentation'), false);
  assert.equal(isEnabled(config, 'documentation'), true);
  assert.equal(isEnabled({ modules: { documentation: false } }, 'documentation'), false);
});

test('systems and default system are registered explicitly', () => {
  assert.match(problems({ systems: undefined }), /systems must list/);
  assert.match(problems({ systems: 'product' }), /systems must list/);
  assert.match(problems({ systems: [] }), /register installed system "product"/);
  assert.match(problems({ systems: ['product', 'brand'] }), /"brand", but it is not installed/);
  assert.match(problems({ systems: ['product', 'product'] }), /unique/);
  assert.match(problems({ systems: ['product', 7] }), /unique/);
  assert.match(problems({ defaultSystem: undefined }), /declare defaultSystem/);
  assert.match(problems({ defaultSystem: 'studio' }), /no system has that id/);
  assert.match(problems({ defaultSystem: 'brand' }), /no system has that id/);
});

test('the platform system is always available and listing it is an error', () => {
  // Not listing it is the whole of its registration.
  assert.deepEqual(configProblems(config, modules, ['product']), []);
  const listed = configProblems({ ...config, systems: ['studio', 'product'] }, modules, ['product']);
  assert.equal(listed.length, 1);
  assert.match(
    listed[0],
    /^studio\.config\.json: systems lists "studio", the platform system\. It is always available/,
  );
  assert.match(
    configProblems({ ...config, systems: ['studio', 'product'] }, modules).join(' '),
    /systems lists "studio", the platform system/,
  );
  assert.match(problems({ systemMaintainers: { studio: [], product: [] } }), /registered prototype system/);
});

test('the platform system is registered by its role, not by its name or by systems', () => {
  assert.equal(systemRegistered(config, 'studio', 'platform'), true);
  assert.equal(systemRegistered({ systems: [] }, 'anything', 'platform'), true);
  assert.equal(systemRegistered({}, 'anything', 'platform'), true);
  assert.equal(systemRegistered(config, 'product', 'prototype'), true);
  assert.equal(systemRegistered(config, 'brand', 'prototype'), false);
  assert.equal(systemRegistered({}, 'product', 'prototype'), false);
});

test('required application registration follows the resolved platform role id', () => {
  const custom = { ...config, systems: ['product'] };
  assert.deepEqual(configProblems(custom, modules, ['product'], 'custom-studio'), []);
  assert.match(
    configProblems({ ...custom, systems: ['custom-studio', 'product'] }, modules, ['product'], 'custom-studio').join(
      ' ',
    ),
    /systems lists "custom-studio", the platform system/,
  );
  // With another platform id, "studio" is just a system that is not installed.
  assert.match(
    configProblems({ ...custom, systems: ['studio', 'product'] }, modules, ['product'], 'custom-studio').join(' '),
    /"studio", but it is not installed/,
  );
  assert.match(
    configProblems({ ...custom, defaultSystem: 'custom-studio' }, modules, ['product'], 'custom-studio').join(' '),
    /no system has that id/,
  );
});

test('team Admin assignments require unique registered contributors', () => {
  for (const admins of [undefined, [], ['sam', 'sam'], ['Invalid'], 'sam', [42]])
    assert.ok(adminProblems({ usage: 'team', admins } as Partial<StudioConfig>).length);
  assert.deepEqual(adminProblems({ usage: 'team', admins: ['sam', 'alex'] }, ['sam', 'alex']), []);
  assert.match(
    adminProblems({ usage: 'team', admins: ['missing'] }, ['sam']).join(' '),
    /not a registered contributor/,
  );
  assert.deepEqual(adminProblems({ usage: 'personal' }, ['sam']), []);
});

test('local roles derive personal Admin access and never recognize unregistered identities', () => {
  assert.equal(studioRole(config, 'sam', ['sam', 'alex']), 'admin');
  assert.equal(studioRole(config, 'alex', ['sam', 'alex']), 'contributor');
  assert.equal(studioRole(config, 'sam', []), null);
  assert.equal(studioRole(config, null, ['sam']), null);
  assert.equal(studioRole({ usage: 'personal' }, 'alex', ['alex']), 'admin');
});

test('system maintainer grants must be explicit, registered, and separate from Studio', () => {
  assert.match(problems({ systemMaintainers: undefined }), /declare systemMaintainers/);
  assert.match(problems({ systemMaintainers: {} }), /product/);
  assert.match(problems({ systemMaintainers: { studio: [], product: [] } }), /registered prototype system/);
  assert.match(problems({ systemMaintainers: { product: ['sam', 'sam'] } }), /unique/);
  assert.match(
    configProblems({ ...config, systemMaintainers: { product: ['missing'] } }, modules, ['product'], 'studio', [
      'sam',
    ]).join(' '),
    /not a registered contributor/,
  );
});

test('team management is required in team use and removable in personal use', () => {
  assert.match(problems({ modules: { ...config.modules, contributors: false } }), /team use requires/);
  const { contributors, ...personalModules } = config.modules;
  const without = modules.filter(module => module.id !== 'contributors');
  assert.deepEqual(
    configProblems({ ...config, usage: 'personal', modules: personalModules }, without, ['product']),
    [],
  );
  assert.match(
    configProblems({ ...config, modules: personalModules }, without, ['product']).join(' '),
    /team use requires/,
  );
});

// Editor completion must agree with runtime validation; do not implement a second schema engine here.
test('the editor schema exposes current settings, required fields, enums and limits', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('./studio.config.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(schema.properties), [...CONFIG_KEYS]);
  assert.equal(schema.additionalProperties, false);
  const { admins, ...withoutAdmins } = config;
  const personal = { ...withoutAdmins, usage: 'personal' as const };
  const required = CONFIG_KEYS.filter(key => {
    const { [key]: omitted, ...rest } = personal as Record<string, unknown>;
    return configProblems(rest, modules, ['product']).length > 0;
  });
  assert.deepEqual([...schema.required].sort(), [...required].sort());
  assert.deepEqual(schema.if, { properties: { usage: { const: 'team' } }, required: ['usage'] });
  assert.deepEqual(schema.then.required, ['admins']);
  assert.equal(schema.then.properties.admins.minItems, 1);
  assert.deepEqual(schema.properties.usage.enum, [...USAGES]);
  assert.equal(schema.properties.tagline.maxLength, TAGLINE_MAX);
});

test('a missing or unknown formatVersion is a problem that names the file', () => {
  const { formatVersion: _omitted, ...unstamped } = config;
  assert.match(
    configProblems(unstamped, modules, ['product']).join('\n'),
    /studio\.config\.json: add "formatVersion": 1/,
  );
  assert.match(problems({ formatVersion: 2 }), /studio\.config\.json: formatVersion is 2.*newer studio/);
  assert.match(problems({ formatVersion: 0 }), /studio\.config\.json: formatVersion is 0/);
  assert.match(problems({ formatVersion: '1' }), /studio\.config\.json: formatVersion is "1"/);
  assert.equal(problems({ formatVersion: 1 }), '');
  for (const format of Object.keys(FORMAT_VERSIONS) as (keyof typeof FORMAT_VERSIONS)[]) {
    assert.equal(formatVersionProblem(FORMAT_VERSIONS[format], format, 'stored.json'), null);
    for (const invalid of [undefined, 0, 99, '1'])
      assert.ok(formatVersionProblem(invalid, format, 'stored.json'), `${format}: ${invalid}`);
  }
});

test('assetLimitKB is declared as a number of KB above 0', () => {
  const { assetLimitKB: _omitted, ...undeclared } = config;
  assert.match(configProblems(undeclared, modules, ['product']).join('\n'), /declare assetLimitKB/);
  for (const assetLimitKB of [0, -1, '750', Number.NaN])
    assert.match(problems({ assetLimitKB }), /declare assetLimitKB/);
  assert.equal(problems({ assetLimitKB: 20000 }), '');
});
