import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { componentProblems, discoverComponents, exampleNames, type ComponentPropsDoc } from './docs.ts';
import { systemDocs } from './node/docs.js';
import { docTemplates } from './scaffold.ts';

const doc = {
  frontmatter: { title: 'Button', description: 'Starts an action.' },
  body: '## When to use\nFor actions.',
};
const examples =
  'export const Primary = () => null;\nexport function WithIcon() {}\nexport const meta = {};\nconst Hidden = 1;';

test('component scanning joins companions within their folder, excludes helpers and reports page collisions', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-docs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const markdown = '---\ntitle: Button\ndescription: Starts an action.\n---\n## When to use\nFor actions.';
  write('Button/Button.tsx', 'export function Button() {return null;}');
  write('Button/button.md', markdown);
  write('Button/Button.examples.tsx', examples);
  write('Button/IconButton.tsx', 'export function IconButton() {return null;}');
  write('Button/parts/ButtonIcon.tsx', 'export function ButtonIcon() {return null;}');
  write('Dialog/Dialog.tsx', 'export function Dialog() {return null;}');
  write('Dialog/DialogTrigger.tsx', 'export function DialogTrigger() {return null;}');
  write('Dialog/DialogTrigger.md', markdown.replace('Button', 'Dialog trigger'));
  write('Dialog/index.ts', '');
  write('other/button.md', markdown);
  write('package.md', markdown);
  write('package.examples.tsx', examples);
  write('flat.tsx', 'export function Flat() {return null;}');
  const generated = docTemplates({ system: 'product', source: 'flat.tsx' });
  write(generated.doc.file, generated.doc.content.replace('description:', 'description: Synthetic example.'));
  write(generated.examples.file, generated.examples.content);
  for (const file of [
    'index.tsx',
    'Button/index.ts',
    '_util.tsx',
    '.hidden/z.tsx',
    'node_modules/x/y.tsx',
    'button.test.tsx',
    'button.stories.tsx',
    'types.d.ts',
    'README.md',
    'lib.ts',
  ])
    write(file, '');
  const { components, problems } = systemDocs(root);
  assert.equal(components.length, 6);
  const button = components.find(c => c.files.source === 'Button/Button.tsx')!;
  assert.deepEqual(button.files, {
    source: 'Button/Button.tsx',
    doc: 'Button/button.md',
    examples: 'Button/Button.examples.tsx',
  });
  assert.equal(components.find(c => c.files.doc === 'other/button.md')!.files.source, null);
  assert.equal(components.find(c => c.files.doc === 'package.md')!.files.source, null);
  // Inside a folder with an index file, only the file named like the folder, or one documented on its own, is a component.
  assert.ok(!components.some(c => /IconButton|ButtonIcon/.test(c.files.source ?? '')));
  assert.ok(components.some(c => c.files.source === 'Dialog/Dialog.tsx'));
  assert.ok(components.some(c => c.files.source === 'Dialog/DialogTrigger.tsx'));
  assert.deepEqual([...new Set(problems.filter(p => !/same name/.test(p.message)).map(p => p.file))].sort(), [
    'Dialog/Dialog.tsx',
    'Dialog/DialogTrigger.tsx',
    'other/button.md',
  ]);
  assert.equal(problems.filter(p => /same name/.test(p.message)).length, 1);
  assert.deepEqual(exampleNames(examples), ['Primary', 'WithIcon']);
});

test('component validation rejects missing companions, invalid metadata, fake prose headings and non-component exports', () => {
  const complete = discoverComponents(['button.tsx', 'button.md', 'button.examples.tsx'])[0];
  const check = (files = complete.files, text = { doc, examples }) => componentProblems({ ...complete, files }, text);
  assert.deepEqual(check(), []);
  for (const files of [
    { ...complete.files, doc: null },
    { ...complete.files, examples: null },
    { source: 'button.tsx', doc: null, examples: null },
  ])
    assert.ok(check(files).length > 0);
  for (const [field, value] of [
    ['title', ''],
    ['description', ' '],
  ])
    assert.ok(
      check(complete.files, { doc: { ...doc, frontmatter: { ...doc.frontmatter, [field]: value } }, examples }).length >
        0,
    );
  for (const body of ['', '<!-- ## When to use -->\n```md\n## When to use\n```\n'])
    assert.ok(check(complete.files, { doc: { ...doc, body }, examples }).length > 0);
  assert.ok(check(complete.files, { doc, examples: 'export const meta = {};' }).length > 0);
});

test('props resolve imported types, defaults and native attributes independently of example systems', async t => {
  const { extractProps } = await import('./node/extract-props.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-props-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.symlinkSync(path.resolve('node_modules'), path.join(root, 'node_modules'));
  fs.writeFileSync(
    path.join(root, 'tsconfig.app.json'),
    JSON.stringify({
      compilerOptions: { jsx: 'react-jsx', moduleResolution: 'bundler', module: 'esnext', strict: true },
    }),
  );
  fs.writeFileSync(path.join(root, 'types.ts'), 'export interface Variants { variant?: "default" | "outline"; }');
  const file = path.join(root, 'components.tsx');
  fs.writeFileSync(
    file,
    `import type { ComponentProps } from 'react';
import type { Variants } from './types';
import { Button as Primitive } from '@base-ui/react/button';
export function Button({ variant = "default", ...props }: Primitive.Props & Variants & { label: string }) { return null; }
export function Input(props: ComponentProps<'input'>) { return null; }
`,
  );
  const result = extractProps([file], root) as Record<string, ComponentPropsDoc[]>;
  const button = result[file].find(c => c.name === 'Button')!;
  assert.equal(button.native, true);
  const variant = button.props.find(p => p.name === 'variant')!;
  assert.equal(variant.default, '"default"');
  assert.match(variant.type, /"outline"/);
  assert.equal(variant.required, false);
  assert.equal(button.props.find(p => p.name === 'label')!.required, true);
  assert.equal(
    button.props.some(p => p.name === 'onClick'),
    false,
  );
  const input = result[file].find(c => c.name === 'Input')!;
  assert.equal(input.native, true);
  assert.deepEqual(input.props, []);
});
