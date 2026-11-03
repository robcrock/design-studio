import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadPrototype, prototypeArtifacts } from './download-prototype.js';
import { parseOrder } from '../../core/order.ts';

test('download refuses a prototype that has no artifacts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-download-'));
  try {
    fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ title: 'Empty' }));
    fs.mkdirSync(path.join(dir, '_components'));
    fs.writeFileSync(path.join(dir, '_components', 'Row.tsx'), 'export default function Row() { return null }\n');
    fs.writeFileSync(path.join(dir, 'helper.tsx'), 'export function helper() { return null }\n');
    await assert.rejects(downloadPrototype(dir), /no screen to download/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('download discovers views, documents, diagrams, canvases, and folder states in meta.json order', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-download-all-'));
  try {
    fs.mkdirSync(path.join(dir, '_components'));
    fs.mkdirSync(path.join(dir, 'states'));
    fs.writeFileSync(path.join(dir, '_components', 'Helper.tsx'), 'export default function Helper() { return null }\n');
    fs.writeFileSync(
      path.join(dir, 'prototype.tsx'),
      '/** @studio-id cwgsecnzf6xw5vze */\nexport default function Main() { return null }\n',
    );
    fs.writeFileSync(
      path.join(dir, 'lofi.tsx'),
      '/** @studio-id 1sr4fz2y2ah8z7mr */\n/** @lofi */\nexport default function Lofi() { return null }\n',
    );
    fs.writeFileSync(path.join(dir, 'brief.md'), '---\nstudioId: 6b28mq3jc0mf14xd\ntitle: Brief\n---\n\nHello\n');
    fs.writeFileSync(path.join(dir, 'flow.mermaid'), '%% @studio-id 6ctg2x82jsyg64xm\nflowchart LR\n  a --> b\n');
    fs.writeFileSync(
      path.join(dir, 'board.excalidraw'),
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], studioId: 'hteb2fh563mmp5mv' }),
    );
    fs.writeFileSync(
      path.join(dir, 'states', 'empty.tsx'),
      '/** @studio-id rszs99q19h6kqfz3 */\nexport default function Empty() { return null }\n',
    );

    const order = parseOrder(['prototype.tsx', 'brief.md', 'board.excalidraw', 'flow.mermaid', 'lofi.tsx', 'states']);
    const items = prototypeArtifacts(dir, order);
    assert.deepEqual(
      items.map(item => ({ path: item.path, fileType: item.fileType, lofi: Boolean(item.lofi) })),
      [
        { path: 'prototype.tsx', fileType: 'view', lofi: false },
        { path: 'brief.md', fileType: 'document', lofi: false },
        { path: 'board.excalidraw', fileType: 'canvas', lofi: false },
        { path: 'flow.mermaid', fileType: 'diagrams', lofi: false },
        { path: 'lofi.tsx', fileType: 'view', lofi: true },
        { path: 'states/empty.tsx', fileType: 'view', lofi: false },
      ],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
