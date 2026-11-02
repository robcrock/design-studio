import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { downloadPrototype } from './download-prototype.js';

test('download refuses a prototype that has no view', async () => {
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
