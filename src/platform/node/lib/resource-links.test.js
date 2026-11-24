import { viewIdentity } from '../../modules/view/identity.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { rewriteResourceLinks } from './resource-links.js';
import { identifyPrototypeArtifacts } from './resource-identity-lifecycle.js';
import {
  markdownIdentity,
  jsonIdentityMetadata as canvasIdentity,
  resourceId,
  parsePrototypeAddress,
} from '../../core/resourceIdentity.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prototypeArtifactHref, PrototypeNavigationProvider, Link } from '../../modules/prototypes/lib/index.ts';

const parent = resourceId('0123456789abcdef'),
  child = resourceId('abcdefghjkmnpqrs'),
  next = resourceId('23456789abcdefgh');
const from = `/prototypes/${parent}/artifacts/${child}`,
  to = `/prototypes/${next}/artifacts/${child}`;

test('permanent addresses require strict parent and artifact IDs and reject legacy paths', () => {
  assert.deepEqual(parsePrototypeAddress(from), { prototypeId: parent, artifactId: child });
  assert.deepEqual(parsePrototypeAddress(`/prototypes/${parent}`), { prototypeId: parent });
  for (const path of [
    '/prototypes/pat/example/main',
    `/prototypes/${parent}/artifacts/invalid`,
    `${from}/extra`,
    `/prototypes/${parent}/main`,
    `/prototypes/${parent.toUpperCase()}`,
  ])
    assert.equal(parsePrototypeAddress(path), null);
});

test('prototype runtime navigation resolves source paths, preserves selection, and refuses missing files', () => {
  const inventory = { studioId: parent, artifacts: [{ path: 'app/main.tsx', studioId: child }] };
  assert.equal(prototypeArtifactHref(inventory, 'app/main?mode=source#frame'), from + '?mode=source#frame');
  assert.equal(prototypeArtifactHref(inventory, 'app/main.tsx'), from);
  assert.throws(() => prototypeArtifactHref(inventory, 'outside/main'), /No identified artifact/);
});

test('an unresolvable Link renders inert in place and names its path instead of failing the view', t => {
  const errors = t.mock.method(console, 'error', () => {});
  const inventory = { studioId: parent, artifacts: [] };
  const html = renderToStaticMarkup(
    createElement(PrototypeNavigationProvider, { value: inventory }, createElement(Link, { to: 'gone/page' }, 'Gone')),
  );
  assert.match(html, /data-studio-broken-link="gone\/page"/);
  assert.match(html, />Gone<\/a>/);
  assert.doesNotMatch(html, /href=/);
  assert.match(errors.mock.calls[0].arguments[0], /Link to "gone\/page": No identified artifact/);
});

test('browser reference migration preserves imports, external links, Markdown fences and scene identity', () => {
  const routes = new Map([[from, to]]);
  const source = `import Main from '${from}';\nexport { Main } from '${from}';\nconst lazy = import('${from}');\nconst required = require('${from}');\nconst link = '${from}?frame=one#pin';\nconst external = 'https://example.com${from}';`;
  const rewritten = rewriteResourceLinks(source, 'helper.tsx', routes);
  assert.match(rewritten, new RegExp(`const link = '${to}\\?frame=one#pin'`));
  assert.equal(rewritten.replace(to, from), source);
  const md = `[View](${from}#pin)\n[view]: <${from}>\n\n\`\`\`md\n[Example](${from})\n\`\`\`\n`;
  assert.equal(
    rewriteResourceLinks(md, 'notes.md', routes),
    md.replace(from, to).replace(`[view]: <${from}>`, `[view]: <${to}>`),
  );
  const scene = {
    studioId: child,
    custom: { keep: true },
    elements: [
      { id: 'deleted', isDeleted: true, link: from, version: 2 },
      { id: 'external', link: `https://example.com${from}` },
    ],
  };
  const result = JSON.parse(rewriteResourceLinks(JSON.stringify(scene), 'board.excalidraw', routes));
  assert.equal(result.studioId, child);
  assert.deepEqual(result.custom, scene.custom);
  assert.equal(result.elements[0].link, to);
  assert.equal(result.elements[0].version, 3);
  assert.deepEqual(result.elements[1], scene.elements[1]);
});

test('copied artifacts receive unique IDs and remap contained permanent links while retaining source dependencies', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-copy-identities-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(
    path.join(directory, 'main.tsx'),
    viewIdentity.write("import Other from './other';\nexport default () => null;", child),
  );
  fs.writeFileSync(
    path.join(directory, 'notes.md'),
    markdownIdentity.write(
      `[View](${from}) [Source](./main.tsx) [Parent](/prototypes/${parent})`,
      resourceId('3456789abcdefghj'),
    ),
  );
  fs.writeFileSync(
    path.join(directory, 'board.excalidraw'),
    canvasIdentity.write(
      JSON.stringify({ elements: [{ id: 'pin', link: from }], appState: {} }),
      resourceId('456789abcdefghjk'),
    ),
  );
  fs.mkdirSync(path.join(directory, '_helpers'));
  fs.writeFileSync(path.join(directory, '_helpers/nav.ts'), `export const href = '${from}';`);
  const types = {
    view: { systemUsage: 'independent', inPrototype: true, extensions: ['.tsx'], identity: viewIdentity },
    document: { systemUsage: 'independent', inPrototype: true, extensions: ['.md'], identity: markdownIdentity },
    canvas: { systemUsage: 'independent', inPrototype: true, extensions: ['.excalidraw'], identity: canvasIdentity },
  };
  const used = new Set([parent, child, next, resourceId('3456789abcdefghj'), resourceId('456789abcdefghjk')]);
  identifyPrototypeArtifacts(directory, types, used, next, parent);
  const main = fs.readFileSync(path.join(directory, 'main.tsx'), 'utf8');
  const mainId = viewIdentity.read(main);
  assert.notEqual(mainId, child);
  assert.match(main, /import Other from '\.\/other'/);
  const copiedHref = `/prototypes/${next}/artifacts/${mainId}`;
  const notes = fs.readFileSync(path.join(directory, 'notes.md'), 'utf8');
  assert.ok(notes.includes(copiedHref));
  assert.ok(notes.includes('[Source](./main.tsx)'));
  assert.ok(notes.includes(`[Parent](/prototypes/${next})`));
  assert.notEqual(markdownIdentity.read(notes), mainId);
  const board = JSON.parse(fs.readFileSync(path.join(directory, 'board.excalidraw'), 'utf8'));
  assert.equal(board.elements[0].link, copiedHref);
  assert.notEqual(board.studioId, mainId);
  assert.ok(fs.readFileSync(path.join(directory, '_helpers/nav.ts'), 'utf8').includes(copiedHref));
});
