// What a design system's system.ts may say (systems.ts). Run with `pnpm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformSystemId, systemProblems, systemRootProblems, systemColorMode, type SystemSpec } from './spec.ts';
import { platformSourceOf, sourceOf } from './sources.ts';

const product: SystemSpec = {
  status: 'active',
  role: 'prototype',
  styling: 'tailwind',
  colorModes: ['light', 'dark'],
  screens: [{ name: 'Desktop', width: 1440 }],
  label: 'Product',
  themeClass: 'product-theme',
  docs: 'warn',
  origin: 'shadcn',
  libraries: [],
};

test('a well formed system has no problems', () => {
  assert.deepEqual(systemProblems(product, 'product'), []);
  assert.deepEqual(
    systemProblems({ ...product, label: 'Brand', themeClass: 'brand-theme', origin: null }, 'brand'),
    [],
  );
});

test('declared system identity is strict while legacy systems await explicit migration', () => {
  assert.deepEqual(systemProblems({ ...product, studioId: '0123456789abcdef' }, 'product'), []);
  assert.match(systemProblems({ ...product, studioId: 'product' }, 'product').join(' '), /exactly 16/);
  assert.match(systemProblems({ ...product, studioId: null }, 'product').join(' '), /exactly 16/);
});

test('a label and a theme class are required', () => {
  assert.match(systemProblems({ ...product, label: ' ' }, 'product')[0], /add a label/);
  assert.match(
    systemProblems({ ...product, themeClass: 'Product Theme' }, 'product')[0],
    /themeClass should be a CSS class name like "product-theme"/,
  );
});

test('docs and origin take only the values the build understands', () => {
  assert.match(systemProblems({ ...product, docs: 'loud' as 'warn' }, 'product')[0], /docs should be/);
  assert.match(systemProblems({ ...product, origin: 'radix' as 'shadcn' }, 'product')[0], /origin should be 'shadcn'/);
});

test('the folder is the id: lowercase', () => {
  assert.match(systemProblems(product, 'Product')[0], /lowercase letters/);
});

test('anything that is not an object is not a system', () => {
  assert.match(systemProblems(undefined, 'product')[0], /must export a system/);
});

test('systems declare supported modes and safely resolve a global mode', () => {
  assert.equal(systemColorMode(product.colorModes, 'dark'), 'dark');
  assert.equal(systemColorMode(product.colorModes, 'light'), 'light');
  assert.equal(systemColorMode(['light'], 'dark'), 'light');
  assert.equal(systemColorMode(['dark'], 'light'), 'dark');
  assert.equal(systemColorMode(['light', 'dark'], 'dark'), 'dark');
  assert.equal(systemColorMode(['light', 'dark'], 'light'), 'light');
  for (const colorModes of [[], ['light', 'light'], ['automatic'], 'light']) {
    assert.match(systemProblems({ ...product, colorModes }, 'product').join(' '), /colorModes must/);
  }
  assert.deepEqual(systemProblems({ ...product, colorModes: ['dark'] }, 'product'), []);
});

test('a system declares the screens its designs are made for', () => {
  const phone = { name: 'Phone', width: 390 };
  assert.deepEqual(systemProblems({ ...product, screens: [phone, ...product.screens] }, 'product'), []);
  for (const screens of [
    [],
    [phone, phone],
    [{ ...phone, name: ' ' }],
    [{ ...phone, width: 390.5 }],
    [{ ...phone, width: 100 }],
    [{ name: 'Phone' }],
    'Phone',
  ])
    assert.match(systemProblems({ ...product, screens } as never, 'product').join(' '), /screens must/);
});

test('the application system is resolved by role, not its folder name', () => {
  const studio = { ...product, role: 'platform' as const, themeClass: 'studio-theme' };
  assert.deepEqual(systemProblems(studio, 'custom-studio'), []);
  assert.equal(platformSystemId({ product, 'custom-studio': studio }), 'custom-studio');
  assert.throws(() => platformSystemId({ product }), /Exactly one/);
  assert.throws(() => platformSystemId({ studio, duplicate: studio }), /Exactly one/);
});

test('system policy fields cannot be inferred from omission', () => {
  for (const field of ['status', 'role', 'styling', 'colorModes', 'screens', 'docs', 'origin', 'libraries']) {
    const spec = { ...product };
    delete (spec as Record<string, unknown>)[field];
    assert.ok(
      systemProblems(spec, 'product').some(problem => problem.includes(field)),
      field,
    );
  }
});

test('public libraries require clear metadata and bounded entry paths', () => {
  const library = {
    kind: 'package',
    id: 'charts',
    label: 'Charts',
    package: 'recharts',
    description: 'Charts',
    entry: 'libraries/charts.ts',
    docs: 'https://example.test',
    components: ['chart'],
  };
  assert.deepEqual(systemProblems({ ...product, libraries: [library] }, 'product'), []);
  for (const invalid of [
    { entry: '../charts.ts' },
    { package: 'recharts/private' },
    { docs: 'javascript:alert(1)' },
    { label: '' },
    { id: 'Bad Name' },
    { components: ['../chart'] },
  ])
    assert.ok(systemProblems({ ...product, libraries: [{ ...library, ...invalid }] }, 'product').length);
  assert.ok(systemProblems({ ...product, libraries: [library, library] }, 'product').length);
});

test('library inventory distinguishes curated sources from installed packages and optional public APIs', () => {
  const source = {
    kind: 'source',
    id: 'shadcn',
    label: 'shadcn/ui',
    description: 'Curated components',
    docs: 'https://ui.shadcn.com/docs',
  };
  const icons = {
    kind: 'package',
    id: 'lucide',
    label: 'Lucide',
    package: 'lucide-react',
    description: 'Interface icons',
    docs: 'https://lucide.dev/icons/',
    assets: ['icons'],
  };
  assert.deepEqual(systemProblems({ ...product, libraries: [source, icons] }, 'product'), []);
  for (const invalid of [{ kind: undefined }, { package: 'shadcn' }, { entry: 'libraries/shadcn.ts' }, { version: '' }])
    assert.ok(systemProblems({ ...product, libraries: [{ ...source, ...invalid }] }, 'product').length);
  for (const invalid of [{ version: '1.0.0' }, { assets: ['other'] }, { package: undefined }])
    assert.ok(systemProblems({ ...product, libraries: [{ ...icons, ...invalid }] }, 'product').length);
});

test('problems name the folder a system was found in, in either root', () => {
  assert.match(systemProblems({ ...product, label: ' ' }, 'product')[0], /^src\/systems\/product\/system\.ts:/);
  assert.match(
    systemProblems({ ...product, label: ' ' }, 'studio', 'src/platform/systems/studio/')[0],
    /^src\/platform\/systems\/studio\/system\.ts:/,
  );
  assert.match(systemProblems(product, 'Product', 'src/systems/Product/')[0], /^src\/systems\/Product\/:/);
});

test('a system lives in one of two roots: the supplied root holds only the platform system', () => {
  const studio = { id: 'studio', dir: 'src/platform/systems/studio/', role: 'platform' };
  const team = { id: 'product', dir: 'src/systems/product/', role: 'prototype' };
  assert.deepEqual(systemRootProblems([studio, team]), []);
  assert.deepEqual(systemRootProblems([team]), []);
  // An id in both roots is ambiguous, because the id is the folder name.
  const both = systemRootProblems([
    studio,
    team,
    { id: 'product', dir: 'src/platform/systems/product/', role: 'prototype' },
  ]);
  assert.match(
    both.join('\n'),
    /product: found in src\/systems\/product\/ and src\/platform\/systems\/product\/|product: found in src\/platform\/systems\/product\/ and src\/systems\/product\//,
  );
  const platformTwice = systemRootProblems([studio, { id: 'studio', dir: 'src/systems/studio/', role: 'platform' }]);
  assert.match(platformTwice.join('\n'), /studio: found in .* and .*can exist in only one/);
  // The supplied root may only hold the platform-role system.
  assert.match(
    systemRootProblems([studio, { id: 'extra', dir: 'src/platform/systems/extra/', role: 'prototype' }]).join('\n'),
    /src\/platform\/systems\/extra\/system\.ts: src\/platform\/systems\/ holds only the platform system/,
  );
  // The platform-role system must live in the supplied root.
  assert.match(
    systemRootProblems([{ id: 'custom', dir: 'src/systems/custom/', role: 'platform' }, team]).join('\n'),
    /src\/systems\/custom\/system\.ts: the platform system \(role: 'platform'\) lives in src\/platform\/systems\//,
  );
  // A declaration that could not say its role is not the platform system.
  assert.equal(systemRootProblems([{ id: 'odd', dir: 'src/platform/systems/odd/' }]).length, 1);
});

test('a system source is built from the folder the system was found in', () => {
  const found = (dir: string) => ({ ...product, dir });
  assert.equal(sourceOf('product', found('src/systems/product/')).components, 'src/systems/product/components');
  const studio = platformSourceOf('studio', { ...found('src/platform/systems/studio/'), role: 'platform' });
  assert.equal(studio.dir, 'src/platform/systems/studio/');
  assert.equal(studio.components, 'src/platform/systems/studio/components');
  assert.equal(studio.theme, 'src/platform/systems/studio/styles/theme.css');
  assert.deepEqual(studio.scope, { light: ':root', dark: '.dark' });
});
