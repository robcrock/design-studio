import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scopePolicy } from './scope.js';
import { importsOf, dependencyResolver, moduleConsumers } from './imports.js';
import { cssProblems } from './css-scope.js';
import { canonicalDirectory } from './safe-paths.js';
import { themeClassProblems } from '../../modules/systems/spec.ts';

const temporary = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'studio-boundaries-')));
const write = (root, file, code) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, code);
  return target;
};

test('runtime dependency scopes reject indirect, private, documentation and dotted-folder escapes', () => {
  const root = temporary();
  try {
    write(
      root,
      'src/prototypes/sam/flow.v1/meta.json',
      JSON.stringify({ title: 'Flow', systemId: '0123456789abcdef' }),
    );
    const policy = scopePolicy({
      root,
      systems: {
        product: { studioId: '0123456789abcdef', role: 'prototype', dir: 'src/systems/product' },
        brand: { studioId: 'abcdefghjkmnpqrs', role: 'prototype', dir: 'src/systems/brand' },
      },
      defaultSystem: 'product',
      modules: [{ id: 'extra', lib: true, optional: true }],
    });
    const file = p => path.join(root, p);
    const cases = [
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/platform/app/router.tsx', false],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/platform/node/lib/helper.js', false],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/prototypes/sam/other/main.tsx', false],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/lib/shared.ts', true],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/systems/studio/components/button.tsx', false],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/prototypes/sam/flow.v1/_helper.ts', true],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/systems/product/components/button.tsx', true],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/systems/brand/components/button.tsx', false],
      ['src/prototypes/sam/flow.v1/main.tsx', 'src/systems/product/intro.tsx', false],
      ['src/systems/product/components/button.tsx', 'src/systems/studio/components/button.tsx', false],
      ['src/systems/product/components/button.tsx', 'src/prototypes/sam/other/main.tsx', false],
      ['src/systems/product/components/button.tsx', 'src/systems/brand/components/button.tsx', false],
      ['src/systems/product/components/button.tsx', 'src/lib/shared.ts', true],
      ['src/lib/shared.ts', 'src/prototypes/sam/other/main.tsx', false],
      ['src/lib/shared.ts', 'src/systems/product/components/button.tsx', false],
      ['src/lib/shared.ts', 'src/lib/other.ts', true],
      ['src/modules/extra/lib/index.ts', 'src/platform/app/router.tsx', false],
      ['src/modules/extra/lib/index.ts', 'src/modules/extra/lib/helper.ts', true],
    ];
    for (const [from, to, allowed] of cases)
      assert.equal(policy.problem('./target', file(from), file(to)) === null, allowed, `${from} → ${to}`);
    write(root, 'src/prototypes/sam/unassigned/meta.json', JSON.stringify({ systemId: null }));
    const unassigned = file('src/prototypes/sam/unassigned/main.tsx');
    assert.equal(policy.scopeOf(unassigned).system, null);
    assert.match(
      policy.problem('./target', unassigned, file('src/systems/product/components/button.tsx')),
      /outside its runtime boundary/,
    );
    const proto = file('src/prototypes/sam/flow.v1/main.tsx');
    assert.equal(policy.problem('@module/extra', proto, file('src/modules/extra/lib/index.ts')), null);
    assert.match(
      policy.problem('@/modules/extra/lib/private', proto, file('src/modules/extra/lib/private.ts')),
      /scope/,
    );
    assert.match(policy.problem('@/modules/extra/lib/index', proto, file('src/modules/extra/lib/index.ts')), /scope/);
    assert.equal(
      policy.scopeOf(file('src/systems/product/intro.tsx')),
      null,
      'documentation can use platform adapters',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the shared AST resolver finds aliases, root paths, exports and dynamic imports without reading string examples as code', () => {
  const root = temporary();
  try {
    write(
      root,
      'tsconfig.app.json',
      JSON.stringify({ compilerOptions: { paths: { '@custom/*': ['./src/custom/*'] } } }),
    );
    const entry = write(root, 'src/modules/extra/lib/index.ts', 'export const value = 1');
    const consumer = write(
      root,
      'src/lib/consumer.ts',
      "export {value} from '/modules/extra/lib/index.ts'; import type {Value} from '@module/extra'; const example = \"import value from 'ignored'\";",
    );
    const custom = write(root, 'src/custom/value.ts', 'export const value = 1');
    const resolve = dependencyResolver(root);
    for (const source of [
      '@module/extra',
      '@/modules/extra/lib/index',
      '/modules/extra/lib/index.ts',
      '../modules/extra/lib/index',
    ])
      assert.equal(resolve(source, consumer), entry);
    assert.equal(resolve('@custom/value', consumer), custom);
    write(root, 'src/lib/type-consumer.ts', "export type Value = import('@module/extra').Value;");
    assert.deepEqual(moduleConsumers(root, 'extra'), ['src/lib/consumer.ts', 'src/lib/type-consumer.ts']);
    const linked = `${root}-link`;
    fs.symlinkSync(root, linked);
    try {
      assert.deepEqual(moduleConsumers(linked, 'extra'), ['src/lib/consumer.ts', 'src/lib/type-consumer.ts']);
    } finally {
      fs.rmSync(linked);
    }
    assert.deepEqual(
      importsOf("import type {A} from './types'; export {x} from './x'; import('./lazy'); import(choice)"),
      [
        { source: './types', typeOnly: true },
        { source: './x', typeOnly: false },
        { source: './lazy', typeOnly: false },
        { source: null, typeOnly: false },
      ],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a module in the supplied root has the same library scope and public entry as one in the team root', () => {
  const root = temporary();
  try {
    write(
      root,
      'tsconfig.app.json',
      JSON.stringify({ compilerOptions: { paths: { '@module/*': ['./src/platform/modules/*/lib/index'] } } }),
    );
    write(root, 'src/prototypes/sam/flow/meta.json', JSON.stringify({ title: 'Flow', systemId: '0123456789abcdef' }));
    write(root, 'src/platform/modules/shipped/module.ts', 'export default {};');
    const entry = write(root, 'src/platform/modules/shipped/lib/index.ts', 'export const value = 1');
    write(root, 'src/platform/modules/shipped/lib/private.ts', 'export const hidden = 1');
    write(root, 'src/modules/mine/module.ts', 'export default {};');
    const mine = write(root, 'src/modules/mine/lib/index.ts', 'export const value = 1');
    const policy = scopePolicy({
      root,
      systems: { product: { studioId: '0123456789abcdef', role: 'prototype', dir: 'src/systems/product' } },
      defaultSystem: 'product',
      modules: [
        { id: 'shipped', lib: true, optional: true },
        { id: 'mine', lib: true, optional: true },
      ],
    });
    const file = p => path.join(root, p);
    for (const [dir, importer] of [
      ['src/platform/modules/shipped', 'shipped'],
      ['src/modules/mine', 'mine'],
    ]) {
      assert.deepEqual(policy.scopeOf(file(`${dir}/lib/index.ts`))?.kind, 'Module library', importer);
      assert.equal(policy.scopeOf(file(`${dir}/app.tsx`)), null, 'only lib/ is runtime library code');
      for (const [to, allowed] of [
        ['src/platform/app/router.tsx', false],
        [`${dir}/lib/helper.ts`, true],
        ['src/lib/shared.ts', true],
      ])
        assert.equal(
          policy.problem('./target', file(`${dir}/lib/index.ts`), file(to)) === null,
          allowed,
          `${dir} → ${to}`,
        );
    }
    const proto = file('src/prototypes/sam/flow/main.tsx');
    assert.equal(policy.problem('@module/shipped', proto, entry), null);
    assert.equal(policy.problem('@module/mine', proto, mine), null);
    assert.match(
      policy.problem(
        '@/platform/modules/shipped/lib/private',
        proto,
        file('src/platform/modules/shipped/lib/private.ts'),
      ),
      /scope/,
    );
    assert.match(policy.problem('@/platform/modules/shipped/lib/index', proto, entry), /scope/);
    assert.match(policy.problem('@/modules/mine/lib/index', proto, mine), /scope/);
    // The resolver and the consumers of a module find it in whichever root holds it.
    const consumer = write(
      root,
      'src/lib/consumer.ts',
      "import {value} from '@module/shipped'; import {value as other} from '@module/mine'; export {value, other};",
    );
    const resolve = dependencyResolver(root);
    for (const source of [
      '@module/shipped',
      '@/platform/modules/shipped/lib/index',
      '/platform/modules/shipped/lib/index.ts',
      '../platform/modules/shipped/lib/index',
    ])
      assert.equal(resolve(source, consumer), entry, source);
    assert.equal(resolve('@module/mine', consumer), mine);
    assert.deepEqual(moduleConsumers(root, 'shipped'), ['src/lib/consumer.ts']);
    assert.deepEqual(moduleConsumers(root, 'mine'), ['src/lib/consumer.ts']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CSS validation contains exact selector targets, nested rules and imported styles', () => {
  const root = temporary();
  try {
    const file = path.join(root, 'theme.css');
    const check = (code, mode = 'theme') => cssProblems(code, { file, themeClass: 'product-theme', mode });
    for (const code of [
      'body {color:red}',
      'body:has(.product-theme) {color:red}',
      '.product-theme-other {color:red}',
      '.product-theme + body {color:red}',
      '.product-theme ~ .a .b {color:red}',
      '.product-theme { & ~ body {color:red} }',
      '@import "https://example.test/global.css";',
      '@keyframes pulse {from {opacity:0} to {opacity:1}}',
    ])
      assert.ok(check(code).length, code);
    assert.match(check('.dark .product-theme {color:red}').join(' '), /global color-mode/);
    assert.match(check('.product-theme { .dark & {color:red} }').join(' '), /global color-mode/);
    for (const code of [
      '.product-theme {color:red}',
      '.product-theme[data-color-mode="dark"] button {color:red}',
      '.product-theme { &:hover {color:red} .child {color:blue} }',
      '.product-theme .a + .b, .product-theme > .a ~ .b {color:red}',
      '.product-theme { .a + .b {color:red} }',
      '@media (width > 1px) {.product-theme {color:red}}',
      '@font-face {font-family:Example;src:url(example.woff2)}',
    ])
      assert.deepEqual(check(code), [], code);
    for (const code of [
      ':global(body) {color:red}',
      ':global .local {color:red}',
      'body {color:red}',
      '.local + body {color:red}',
    ])
      assert.ok(check(code, 'module').length, code);
    assert.deepEqual(check('.local {color:red} .local:hover > span {color:blue}', 'module'), []);
    write(root, 'imported.css', 'body {color:red}');
    assert.ok(check('@import "./imported.css";').length);
    write(root, 'imported.css', '.product-theme {color:red}');
    assert.deepEqual(check('@import "./imported.css";'), []);
    assert.ok(themeClassProblems({ a: { themeClass: 'same' }, b: { themeClass: 'same' } }).length);
    assert.ok(themeClassProblems({ a: { themeClass: 'dark' } }).length);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('canonical scope roots reject links at either contributor or prototype level', () => {
  const root = temporary();
  try {
    fs.mkdirSync(path.join(root, 'alex/other'), { recursive: true });
    fs.mkdirSync(path.join(root, 'sam'));
    fs.symlinkSync(path.join(root, 'alex/other'), path.join(root, 'sam/linked'));
    fs.symlinkSync(path.join(root, 'alex'), path.join(root, 'alias'));
    assert.equal(canonicalDirectory(path.join(root, 'sam/linked'), root), null);
    assert.equal(canonicalDirectory(path.join(root, 'alias/other'), root), null);
    assert.equal(canonicalDirectory(path.join(root, 'alex/other'), root), path.join(root, 'alex/other'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Tailwind inventories allow intentional omissions and reject inherited references', async () => {
  const { tailwindThemeProblems, themeInventory, themeAdapter, scopeThemeUtilities } = await import(
    './tailwind-theme.js'
  );
  const options = { file: 'test.css', styling: 'tailwind', themeClass: 'product-theme' };
  assert.deepEqual(tailwindThemeProblems('.product-theme { --shadow-sm: 0 1px black; }', options), []);
  assert.ok(
    tailwindThemeProblems('.product-theme[data-color-mode="dark"] { --blur-xs: 4px; }', options).some(p =>
      p.includes('base value'),
    ),
  );
  assert.ok(
    tailwindThemeProblems('.product-theme { --blur-xs: var(--missing-blur); }', options).some(p =>
      p.includes('references --missing-blur'),
    ),
  );
  const systems = [
    {
      role: 'platform',
      styling: 'tailwind',
      themeClass: 'studio-theme',
      inventory: themeInventory(
        '.studio-theme { --shadow-sm: 0 1px black; --shadow-lg: 0 4px black; --spacing-4: 1rem; }',
        'studio-theme',
      ),
    },
    {
      role: 'prototype',
      styling: 'tailwind',
      themeClass: 'product-theme',
      inventory: themeInventory('.product-theme { --shadow-sm: 0 2px black; }', 'product-theme'),
    },
    {
      role: 'prototype',
      styling: 'tailwind',
      themeClass: 'marketing-theme',
      inventory: themeInventory('.marketing-theme { --color-bg-brand-solid: #7f56d9; }', 'marketing-theme'),
    },
  ];
  const { compile } = await import('tailwindcss');
  const compiler = await compile(themeAdapter(systems) + '\n@layer utilities { @tailwind utilities; }');
  const compiled = compiler.build([
    'shadow-sm',
    'shadow-lg',
    'shadow-xl',
    'p-4',
    'p-5',
    'flex',
    'rounded-full',
    'bg-bg-brand-solid',
  ]);
  assert.ok(!compiled.includes('.shadow-xl'));
  assert.ok(!compiled.includes('.p-5'));
  const scoped = scopeThemeUtilities(compiled, systems);
  assert.match(scoped, /@scope \(.product-theme\) to \(.studio-theme, .marketing-theme, .prototype-unstyled\)/);
  assert.match(scoped, /@scope \(.prototype-unstyled\) to \(.studio-theme, .product-theme, .marketing-theme\)/);
  const postcss = (await import('postcss')).default;
  const root = postcss.parse(scoped);
  const product = [];
  const marketing = [];
  const custom = [];
  const selectorParser = (await import('postcss-selector-parser')).default;
  root.walkAtRules('scope', rule => {
    const list = rule.params.startsWith('(.product-theme)')
      ? product
      : rule.params.startsWith('(.marketing-theme)')
        ? marketing
        : rule.params.startsWith('(.prototype-unstyled)')
          ? custom
          : null;
    if (list)
      rule.walkRules(r =>
        selectorParser(tree => tree.walkClasses(c => list.push('.' + c.value))).processSync(r.selector),
      );
  });
  assert.ok(scoped.includes(':scope:is(.flex)'), 'frame utilities must apply to the theme boundary itself');
  assert.ok(product.includes('.shadow-sm'));
  assert.ok(product.includes('.flex'));
  assert.ok(!product.includes('.shadow-lg'));
  assert.ok(!product.includes('.p-4'));
  assert.ok(!product.includes('.rounded-full'));
  assert.ok(!product.includes('.bg-bg-brand-solid'));
  assert.ok(marketing.includes('.bg-bg-brand-solid'));
  assert.ok(marketing.includes('.flex'));
  assert.ok(!marketing.includes('.shadow-sm'));
  assert.ok(custom.includes('.flex'));
  assert.ok(!custom.includes('.p-4'));
  assert.ok(!custom.includes('.bg-bg-brand-solid'));
  assert.ok(scoped.includes('--shadow-lg: initial'));
});

test('utility diagnostics distinguish omitted tokens from unrelated text', async () => {
  const { themeInventory } = await import('./tailwind-theme.js');
  const { themeUsageProblems, literalCandidates } = await import('./theme-usage.js');
  assert.deepEqual(literalCandidates('window.addEventListener("blur", handler);', 'event.ts'), []);
  const dir = temporary();
  try {
    const file = write(dir, 'view.tsx', '<div className="shadow-lg flex" />');
    const system = {
      themeClass: 'example-theme',
      styling: 'tailwind',
      inventory: themeInventory('.example-theme { --shadow-sm: 0 1px black; }', 'example-theme'),
    };
    const problems = await themeUsageProblems([system], () => [file]);
    assert.equal(problems.length, 2);
    assert.match(problems[0], /shadow-lg requires --shadow-lg/);
    assert.match(problems[1], /missing 1 token\(s\) in all: --shadow-lg \(Tailwind default /);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('upstream semantic aliases preserve utilities in other systems regardless of order', async () => {
  const { themeInventory, themeAdapter, scopeThemeUtilities } = await import('./tailwind-theme.js');
  const { themeUsageProblems } = await import('./theme-usage.js');
  const { compile } = await import('tailwindcss');
  const dir = temporary();
  try {
    const file = write(dir, 'view.tsx', '<div className="bg-primary text-primary-foreground" />');
    const plain = {
      role: 'prototype',
      styling: 'tailwind',
      themeClass: 'plain-theme',
      inventory: themeInventory('.plain-theme { --primary: #123; --primary-foreground: #fff; }', 'plain-theme'),
    };
    const imported = {
      role: 'prototype',
      styling: 'tailwind',
      themeClass: 'imported-theme',
      inventory: themeInventory(
        '.imported-theme { --primary: #456; --primary-foreground: #fff; --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground); }',
        'imported-theme',
      ),
    };
    for (const systems of [
      [plain, imported],
      [imported, plain],
    ]) {
      assert.deepEqual(await themeUsageProblems(systems, () => [file]), []);
      const compiler = await compile(themeAdapter(systems) + '\n@layer utilities { @tailwind utilities; }');
      const scoped = scopeThemeUtilities(compiler.build(['bg-primary', 'text-primary-foreground']), systems);
      const plainScope = (await import('postcss')).default
        .parse(scoped)
        .nodes.find(node => node.type === 'atrule' && node.name === 'layer' && node.params === 'utilities')
        .nodes.find(node => node.params.startsWith('(.plain-theme)'));
      assert.match(plainScope.toString(), /\.bg-primary/);
      assert.match(plainScope.toString(), /\.text-primary-foreground/);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('group and peer markers do not inherit another utility request', async () => {
  const { themeInventory } = await import('./tailwind-theme.js');
  const { themeUsageProblems } = await import('./theme-usage.js');
  const dir = temporary();
  try {
    const marker = write(dir, 'marker.tsx', '<input className="peer group/demo" />');
    const styled = write(
      dir,
      'styled.tsx',
      '<div className="peer-data-[variant=inset]:rounded-xl group-hover/demo:shadow-lg" />',
    );
    const plain = {
      themeClass: 'plain-theme',
      styling: 'tailwind',
      inventory: themeInventory('.plain-theme {}', 'plain-theme'),
    };
    const imported = {
      themeClass: 'imported-theme',
      styling: 'tailwind',
      inventory: themeInventory('.imported-theme { --radius-xl: 1rem; --shadow-lg: 0 4px black; }', 'imported-theme'),
    };
    assert.deepEqual(
      await themeUsageProblems([plain, imported], system => (system === plain ? [marker] : [styled])),
      [],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('team modules and systems reach the platform only through #studio/*; supplied modules are platform code', async () => {
  const { platformImportProblem, API_ENTRIES } = await import('../../core/modules/boundaries.ts');
  for (const file of [
    'src/modules/research/app.tsx',
    'src/modules/research/node/tool.js',
    'src/systems/kit/system.ts',
  ]) {
    // Allowed: each API entry, by its specifier.
    for (const entry of API_ENTRIES)
      assert.equal(platformImportProblem(file, `src/platform/api/${entry}.ts`, `#studio/${entry}`), null, file);
    assert.equal(platformImportProblem(file, 'src/platform/api/ui.ts', '#studio/ui'), null, file);
    // Rejected: a deep relative or aliased import of the same files, platform internals, Node tooling, Studio's system.
    assert.match(
      platformImportProblem(file, 'src/platform/api/ui.ts', '../../platform/api/ui.ts'),
      /#studio\/module, #studio\/system/,
      file,
    );
    assert.match(
      platformImportProblem(file, 'src/platform/app/shell/nav/index.ts', '../../platform/app/shell/nav/index.ts'),
      /imports the platform only through its public API/,
      file,
    );
    assert.match(
      platformImportProblem(file, 'src/platform/core/fileTypes.ts', '@/platform/core/fileTypes'),
      /public API/,
    );
    assert.match(
      platformImportProblem(file, 'src/platform/node/lib/modules.js', '../../platform/node/lib/modules.js'),
      /public API/,
      file,
    );
    assert.match(
      platformImportProblem(
        file,
        'src/platform/systems/studio/components/button/index.ts',
        '@/platform/systems/studio/components/button',
      ),
      /public API/,
      file,
    );
    assert.match(
      platformImportProblem(file, 'src/platform/core/fileTypes.ts', '#studio/../core/fileTypes'),
      /public API/,
    );
    // A module's public library, wherever it lives, and anything outside src/platform/ are judged elsewhere.
    assert.equal(platformImportProblem(file, 'src/platform/modules/canvas/lib/index.ts', '@module/canvas'), null, file);
    assert.equal(platformImportProblem(file, 'src/lib/shared.ts', '@/lib/shared'), null, file);
    assert.equal(platformImportProblem(file, 'src/modules/other/lib/index.ts', '@module/other'), null, file);
  }
  assert.match(
    platformImportProblem('src/systems/kit/intro.tsx', 'src/platform/app/data/types.ts', '@/platform/app/data/types'),
    /A team system/,
  );
  assert.match(
    platformImportProblem('src/modules/research/app.tsx', 'src/platform/app/router.tsx', '@/platform/app/router'),
    /A team module/,
  );
  // Supplied modules ship with the platform and import its internals like platform code does.
  for (const [target, specifier] of [
    ['src/platform/app/router.tsx', '@/platform/app/router'],
    ['src/platform/node/lib/modules.js', '../../node/lib/modules.js'],
    ['src/platform/core/declarations.ts', '../../core/declarations.ts'],
    ['src/platform/context/principles.md', '../../context/principles.md'],
  ])
    assert.equal(platformImportProblem('src/platform/modules/canvas/app.tsx', target, specifier), null, target);
  // Platform code, shared utilities and prototypes are not judged here.
  assert.equal(
    platformImportProblem('src/platform/app/router.tsx', 'src/platform/app/shell/App.tsx', './shell/App'),
    null,
  );
  assert.equal(
    platformImportProblem('src/lib/shared.ts', 'src/platform/app/router.tsx', '@/platform/app/router'),
    null,
  );
  assert.equal(platformImportProblem('src/modules/README.md', 'src/platform/app/router.tsx', 'x'), null);
  assert.equal(platformImportProblem('src/modulesque/x.ts', 'src/platform/app/router.tsx', 'x'), null);
});

test('the API entries match the files in src/platform/api', async () => {
  const { API_ENTRIES, API_FOLDER } = await import('../../core/modules/boundaries.ts');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  const files = fs.readdirSync(path.join(root, API_FOLDER)).map(file => file.replace(/\.ts$/, ''));
  assert.deepEqual([...files].sort(), [...API_ENTRIES].sort());
  // One specifier resolves in Node too: the root package.json maps #studio/* to the entry files.
  const declarations = await import('#studio/files');
  assert.equal(typeof declarations.defineFileType, 'function');
});
