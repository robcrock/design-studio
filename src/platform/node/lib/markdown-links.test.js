import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { anchorsOf, markdownLinkProblems } from './markdown-links.js';

const write = (root, file, text) => {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), text);
};

test('heading anchors follow rendered heading ids', () => {
  const anchors = anchorsOf('# Use `pnpm` & [links](x.md)\n\n## Notes\n\n## Notes\n\n```md\n## Not a heading\n```\n');
  assert.deepEqual([...anchors], ['use-pnpm--links', 'notes', 'notes-1']);
});

test('broken files, anchors, and Studio pages are reported; valid and external links are not', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-links-'));
  try {
    write(root, 'src/platform/context/checks.md', '## Respond to a check\n');
    write(
      root,
      'src/platform/context/guide.md',
      [
        '[ok](checks.md#respond-to-a-check) [self](#guide) [web](https://example.com/x.md)',
        '[page](/documentation/context/platform.core/context/checks#respond-to-a-check)',
        '[missing](gone.md) [anchor](checks.md#nope) [route](/documentation/context/platform.core/context/gone)',
        '`[code](ignored.md)`',
        '',
        '## Guide',
      ].join('\n'),
    );
    const problems = markdownLinkProblems(root);
    assert.deepEqual(problems, [
      'src/platform/context/guide.md: gone.md points to a missing file',
      'src/platform/context/guide.md: checks.md#nope names no heading in src/platform/context/checks.md',
      'src/platform/context/guide.md: /documentation/context/platform.core/context/gone names no Studio page',
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
