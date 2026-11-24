import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const SCRIPT = path.resolve('src/platform/node/check/check-asset-size.js');

function repo(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asset-size-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  const write = (file, kb) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), Buffer.alloc(kb * 1024, 1));
  };
  const text = (file, source) => fs.writeFileSync(path.join(dir, file), source);
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, encoding: 'utf8' });
  return { git, write, text, run };
}

// Git quotes names like these unless asked not to (#112).
for (const name of ['café.jpg', '1 · Intro/A · Screen.tsx']) {
  test(`a small staged "${name}" passes`, t => {
    const { git, write, run } = repo(t);
    write(name, 10);
    git('add', '.');
    const r = run('--staged');
    assert.equal(r.status, 0, r.stderr);
  });
}

test('an oversized "café.mp4" is blocked by name in --staged and --ci', t => {
  const { git, write, run } = repo(t);
  write('café.mp4', 800);
  git('add', '.');
  const staged = run('--staged');
  assert.equal(staged.status, 1, staged.stderr);
  assert.match(staged.stdout + staged.stderr, /café\.mp4: 800 KB/);
  git('commit', '-qm', 'add');
  const ci = run('--ci', '0000000000000000000000000000000000000000', git('rev-parse', 'HEAD').trim());
  assert.equal(ci.status, 1, ci.stderr);
  assert.match(ci.stdout + ci.stderr, /café\.mp4: 800 KB/);
});

const configure = assetLimitKB => JSON.stringify({ formatVersion: 1, assetLimitKB });

test('the limit comes from the staged or committed assetLimitKB, and the message links the large files guide', t => {
  const { git, write, text, run } = repo(t);
  write('tour.mp4', 800);
  text('studio.config.json', configure(750));
  git('add', '.');
  const blocked = run('--staged');
  assert.equal(blocked.status, 1);
  assert.match(
    blocked.stderr,
    /If it needs to stay this size, see how to support large files: .*assets\.md#large-files/,
  );

  // A raised limit counts once staged, not while it's only on disk.
  text('studio.config.json', configure(1000));
  assert.equal(run('--staged').status, 1);
  git('add', 'studio.config.json');
  assert.equal(run('--staged').status, 0);
  git('commit', '-qm', 'add');
  write('big.png', 1200);
  git('add', '.');
  git('commit', '-qm', 'big');
  const ci = run('--ci', git('rev-parse', 'HEAD~1').trim(), git('rev-parse', 'HEAD').trim());
  assert.equal(ci.status, 1);
  assert.match(ci.stderr, /over 1000 KB[\s\S]*big\.png: 1200 KB/);
});

test('an undeclared or invalid assetLimitKB stops the check and says what to declare', t => {
  const { git, write, text, run } = repo(t);
  write('small.png', 10);
  for (const config of [JSON.stringify({ formatVersion: 1 }), configure(0)]) {
    text('studio.config.json', config);
    git('add', '.');
    const r = run('--staged');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /declare assetLimitKB/);
  }
});
