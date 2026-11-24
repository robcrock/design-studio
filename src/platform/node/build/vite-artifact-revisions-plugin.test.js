import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import revisions, { digest, inputDigest, sourceInputs } from './vite-artifact-revisions-plugin.js';
import { PROTOTYPE_SYSTEMS } from '../../modules/systems/node/systems.js';
import { ROOT } from './files/paths.js';
test('entry and transitive dependency edits independently change the input digest', () => {
  const directory = fs.mkdtempSync(path.join(ROOT, 'src', '.lifecycle-test-'));
  try {
    const entry = path.join(directory, 'screen.tsx'),
      helper = path.join(directory, '_helper.ts');
    fs.writeFileSync(entry, 'export default function Screen() {}');
    fs.writeFileSync(helper, 'export const value = 1;');
    const child = { file: helper, importedModules: new Set() };
    const parent = { file: entry, importedModules: new Set([child]) };
    child.importedModules.add(parent); // Cycles are normal and must terminate.
    const graph = { getModulesByFile: () => new Set([parent]) };
    const before = sourceInputs(graph, entry);
    assert.ok(before.some(([key]) => key.endsWith('_helper.ts')));
    assert.ok(before.some(([key]) => key === '/platform/app/styles.css'));
    for (const id of Object.keys(PROTOTYPE_SYSTEMS))
      assert.ok(before.some(([key]) => key === `/systems/${id}/styles/theme.css`));
    fs.writeFileSync(helper, 'export const value = 2;');
    const after = sourceInputs(graph, entry);
    assert.notEqual(inputDigest(before), inputDigest(after));
    assert.deepEqual(
      before.find(([key]) => key.endsWith('screen.tsx')),
      after.find(([key]) => key.endsWith('screen.tsx')),
    );
    const link = path.join(directory, '_link.ts');
    fs.symlinkSync(helper, link);
    child.file = link;
    assert.throws(() => sourceInputs(graph, entry), /unavailable/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('instrumentation records exact transform input without changing authored exports and stays out of production', () => {
  const [capture, record] = revisions();
  assert.equal(capture.apply, 'serve');
  assert.equal(record.apply, 'serve');
  const file = path.join(ROOT, 'src', 'screen.tsx'),
    text = 'export default function Screen() { return null; }';
  capture.transform.handler(text, file);
  const result = record.transform.handler(text, file);
  assert.ok(result.code.startsWith(text));
  assert.ok(result.code.includes(digest(text)));
  assert.equal(record.transform.handler(text, file), null);
  capture.transform.handler(text, file + '?raw');
  assert.equal(record.transform.handler(text, file + '?raw'), null);
});
test('revision endpoint retains same-origin and existing path allowlists', () => {
  let middleware;
  revisions()[1].configureServer({
    middlewares: {
      use: (_path, handle) => {
        middleware = handle;
      },
    },
  });
  const run = request => {
    const result = {
      statusCode: 0,
      setHeader() {},
      end(body) {
        this.body = JSON.parse(body);
      },
    };
    middleware(request, result);
    return result;
  };
  assert.equal(run({ method: 'GET', headers: {}, url: '/' }).statusCode, 403);
  assert.equal(run({ method: 'POST', headers: { 'sec-fetch-site': 'same-origin' }, url: '/' }).statusCode, 403);
  assert.equal(
    run({
      method: 'GET',
      headers: { 'sec-fetch-site': 'same-origin' },
      url: '/?contributor=../escape&prototype=sample&path=screen.tsx',
    }).statusCode,
    404,
  );
});

test('relative CSS imports remain revision inputs even when Vite inlines them', () => {
  const directory = fs.mkdtempSync(path.join(ROOT, 'src', '.lifecycle-test-'));
  try {
    const entry = path.join(directory, 'screen.tsx'),
      css = path.join(directory, 'screen.css'),
      tokens = path.join(directory, 'tokens.css');
    fs.writeFileSync(entry, 'export default function Screen() {}');
    fs.writeFileSync(css, '@import url(./tokens.css);');
    fs.writeFileSync(tokens, ':root { --test-token: red; }');
    const graph = {
      getModulesByFile: () =>
        new Set([{ file: entry, importedModules: new Set([{ file: css, importedModules: new Set() }]) }]),
    };
    const before = sourceInputs(graph, entry);
    assert.ok(before.some(([key]) => key.endsWith('/tokens.css')));
    fs.writeFileSync(tokens, ':root { --test-token: blue; }');
    assert.notEqual(inputDigest(before), inputDigest(sourceInputs(graph, entry)));
    const [capture, record] = revisions();
    const source = fs.readFileSync(css, 'utf8');
    capture.transform.handler(source, css);
    assert.ok(record.transform.handler('compiled CSS', css).code.includes(digest(fs.readFileSync(tokens))));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('imported assets record their bytes on disk, matching the revision endpoint', () => {
  const directory = fs.mkdtempSync(path.join(ROOT, 'src', '.lifecycle-test-'));
  try {
    const entry = path.join(directory, 'screen.tsx'),
      image = path.join(directory, 'photo.png');
    fs.writeFileSync(entry, 'export default function Screen() {}');
    fs.writeFileSync(image, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const graph = {
      getModulesByFile: () =>
        new Set([{ file: entry, importedModules: new Set([{ file: image, importedModules: new Set() }]) }]),
    };
    const expected = sourceInputs(graph, entry).find(([key]) => key.endsWith('/photo.png'));
    const [capture, record] = revisions();
    const compiled = 'export default "/src/photo.png"';
    capture.transform.handler(compiled, image);
    const result = record.transform.handler(compiled, image);
    assert.ok(result.code.startsWith(compiled));
    assert.ok(result.code.includes(JSON.stringify([expected])));
    capture.transform.handler(compiled, path.join(directory, 'missing.png'));
    assert.equal(record.transform.handler(compiled, path.join(directory, 'missing.png')), null);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
