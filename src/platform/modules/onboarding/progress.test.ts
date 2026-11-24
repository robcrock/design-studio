import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createServer } from 'vite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claimWelcome } from './node/progress.js';
import server from './server.ts';
import { contributorPreferenceProblems } from '../../core/modules/preferences.ts';
import { readContributors } from '../../node/lib/contributors.js';
import { writeProfiles } from '../../node/lib/fixtures/contributors.js';
import onboarding from './module.ts';
const check = ({ root }: { root: string }) =>
  contributorPreferenceProblems(readContributors(root).contributors, [onboarding]);
// Exercise the browser-only public entry through Vite, rather than loading it in native Node.
const browser = await createServer({
  configFile: path.resolve('vite.config.ts'),
  configLoader: 'native',
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});
after(() => browser.close());
const { complete, isComplete, progressKey, claimIntroduction, recordIntroduction } = await browser.ssrLoadModule(
  '/platform/modules/onboarding/progress.ts',
);

test('onboarding completion persists and does not cross base paths', () => {
  const data = new Map<string, string>();
  const storage = () => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  const key = progressKey('/studio-test/');
  assert.equal(isComplete(key, storage), false);
  assert.equal(complete(key, storage), true);
  assert.equal(data.get(key), 'complete');
  assert.equal(isComplete(progressKey('/other-studio/'), storage), false);
});

test('persisted completion is recognized without completing again', () => {
  assert.equal(
    isComplete(progressKey('/returning/'), () => ({ getItem: () => 'complete', setItem: () => assert.fail() })),
    true,
  );
});

test('blocked storage still allows the person to leave Welcome for this session', () => {
  const unavailable = () => {
    throw new Error('Storage blocked');
  };
  const key = progressKey('/blocked/');
  assert.equal(isComplete(key, unavailable), false);
  assert.equal(complete(key, unavailable), false);
  assert.equal(isComplete(key, unavailable), true);
});

const fixture = (t: { after: (fn: () => void) => void }) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-welcome-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'contributors'));
  fs.mkdirSync(path.join(root, 'src/platform/modules/onboarding'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'src/platform/modules/onboarding/module.ts'),
    'export default ' + JSON.stringify(onboarding) + ';',
  );
  fs.writeFileSync(
    path.join(root, 'studio.config.json'),
    JSON.stringify({ ...JSON.parse(fs.readFileSync('studio.config.json', 'utf8')), modules: { onboarding: true } }),
  );
  writeProfiles(root, {
    owner: { name: 'Owner', extra: 'keep' },
    newcomer: { name: 'Newcomer', email: 'new@example.test', custom: { keep: true } },
  });
  return root;
};

test('each contributor gets Welcome once and keeps their own progress across restarts', t => {
  const root = fixture(t);
  const beforeOwner = JSON.parse(fs.readFileSync(path.join(root, 'contributors/owner.json'), 'utf8'));
  const beforeNewcomer = JSON.parse(fs.readFileSync(path.join(root, 'contributors/newcomer.json'), 'utf8'));
  assert.equal(claimWelcome(root, 'owner'), true);
  assert.equal(claimWelcome(root, 'owner'), false);
  assert.equal(claimWelcome(root, 'newcomer'), true);
  assert.equal(claimWelcome(root, 'newcomer'), false);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'contributors/newcomer.json'), 'utf8')), {
    ...beforeNewcomer,
    preferences: { onboarding: { welcomeDismissed: true } },
  });
  const owner = JSON.parse(fs.readFileSync(path.join(root, 'contributors/owner.json'), 'utf8'));
  assert.deepEqual(owner, { ...beforeOwner, preferences: { onboarding: { welcomeDismissed: true } } });
  const other = fixture(t);
  assert.equal(claimWelcome(other, 'owner'), true);
});

test('unregistered exploration and legacy studio state cannot dismiss a new contributor', t => {
  const root = fixture(t);
  const configSource = fs.readFileSync(path.join(root, 'studio.config.json'), 'utf8');
  fs.writeFileSync(path.join(root, '.design-studio-welcome-dismissed'), '');
  const before = fs.readFileSync(path.join(root, 'contributors/newcomer.json'), 'utf8');
  assert.equal(claimWelcome(root, null), null);
  assert.equal(fs.readFileSync(path.join(root, 'contributors/newcomer.json'), 'utf8'), before);
  assert.equal(claimWelcome(root, 'newcomer'), true);
  assert.equal(fs.readFileSync(path.join(root, 'studio.config.json'), 'utf8'), configSource);
});

test('progress preserves other roster entries and honors explicit false', t => {
  const root = fixture(t);
  const file = path.join(root, 'contributors/colleague.json');
  fs.writeFileSync(
    file,
    JSON.stringify({ name: 'Colleague', preferences: { onboarding: { welcomeDismissed: true } } }),
  );
  assert.equal(claimWelcome(root, 'owner'), true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), {
    name: 'Colleague',
    preferences: { onboarding: { welcomeDismissed: true } },
  });
});

test('invalid, unknown and linked profiles are preserved', t => {
  const root = fixture(t);
  const file = path.join(root, 'contributors/newcomer.json');
  const valid = JSON.parse(fs.readFileSync(file, 'utf8'));
  fs.writeFileSync(file, JSON.stringify({ ...valid, preferences: { onboarding: { welcomeDismissed: 'yes' } } }));
  assert.throws(() => claimWelcome(root, 'newcomer'), /as boolean/);
  assert.match(fs.readFileSync(file, 'utf8'), /"yes"/);
  assert.throws(() => claimWelcome(root, '../elsewhere'), /Invalid contributor/);
  assert.throws(() => claimWelcome(root, 'unknown'), /not registered/);
  fs.unlinkSync(file);
  fs.symlinkSync(path.join(root, 'contributors/owner.json'), file);
  assert.throws(() => claimWelcome(root, 'newcomer'), /ordinary file/);
  fs.unlinkSync(file);
  fs.writeFileSync(file, '[]');
  assert.throws(() => claimWelcome(root, 'newcomer'), /object/);
});

test('browser fallback progress does not cross contributor identities', () => {
  assert.notEqual(progressKey('/', 'owner'), progressKey('/', 'newcomer'));
  assert.notEqual(progressKey('/', null), progressKey('/', 'newcomer'));
});

test('Welcome route rejects arbitrary paths and unsupported actions', async () => {
  for (const body of [
    null,
    [],
    { action: 'delete' },
    { action: 'claim', path: '/tmp/elsewhere' },
    { action: 'claim', contributor: 'owner' },
  ]) {
    assert.equal((await server.progress({ me: null, body })).status, 400);
  }
});

test('effect replay shares one claim and returning after display cannot reopen it', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response(JSON.stringify({ show: true }));
  });
  const key = progressKey('/effect-replay/');
  const first = claimIntroduction(key, true);
  assert.equal(claimIntroduction(key, true), first);
  assert.equal(await first, true);
  recordIntroduction(key);
  assert.equal(await claimIntroduction(key, true), false);
  assert.equal(calls, 1);
});

test("an automated browser neither claims nor opens the person's Welcome", async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ show: true })));
  const key = progressKey('/automated/', 'newcomer');
  assert.equal(await claimIntroduction(key, true, true), false);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(await claimIntroduction(key, true, false), true);
});

test('unregistered claims use browser fallback while registered claims use profile state', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ show: null })));
  const key = progressKey('/unregistered-fallback/');
  complete(key);
  assert.equal(await claimIntroduction(key, true), false);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ show: true })));
  const registered = progressKey('/unregistered-fallback/', 'newcomer');
  complete(registered);
  assert.equal(await claimIntroduction(registered, true), true);
});

test('missing declarations fail validation and runtime without changing the profile', t => {
  const root = fixture(t);
  assert.deepEqual(check({ root }), []);
  const file = path.join(root, 'contributors/newcomer.json');
  const valid = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { preferences, ...identity } = valid;
  const source = JSON.stringify(identity);
  fs.writeFileSync(file, source);
  assert.match(check({ root }).join(' '), /newcomer.*declare a preference object/);
  assert.throws(() => claimWelcome(root, 'newcomer'), /declare preferences as module namespace objects/i);
  assert.equal(fs.readFileSync(file, 'utf8'), source);
  fs.writeFileSync(file, JSON.stringify({ ...valid, preferences: { onboarding: { welcomeDismissed: true } } }));
  assert.deepEqual(check({ root }), []);
  assert.equal(claimWelcome(root, 'newcomer'), false);
});

test('a missing profile declaration cannot activate browser fallback', async t => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response(JSON.stringify({ error: 'Declare welcomeDismissed.' }), { status: 422 }),
  );
  assert.equal(await claimIntroduction(progressKey('/invalid-declaration/', 'newcomer'), true), false);
});

test('unavailable persistence uses browser fallback but malformed successful replies fail clearly', async t => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('offline');
  });
  assert.equal(await claimIntroduction(progressKey('/unavailable/'), true), true);
  complete(progressKey('/unavailable-completed/'));
  assert.equal(await claimIntroduction(progressKey('/unavailable-completed/'), true), false);
  for (const [index, body] of ['{}', '{"show":"yes"}', 'not json'].entries()) {
    t.mock.method(globalThis, 'fetch', async () => new Response(body));
    await assert.rejects(
      claimIntroduction(progressKey('/malformed/' + index), true),
      /progress must declare|unreadable reply/,
    );
  }
});

test('delayed identity cannot consume onboarding before the registered visitor is known', async t => {
  let calls = 0;
  let dismissed = false;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    const show = !dismissed;
    dismissed = true;
    return new Response(JSON.stringify({ show }));
  });
  const loadingKey = progressKey('/delayed-registered/');
  assert.equal(await claimIntroduction(loadingKey, false), false);
  assert.equal(await claimIntroduction(loadingKey, false), false);
  assert.equal(dismissed, false, 'loading must not mark the introduction as shown on disk');
  assert.equal(calls, 0);
  const key = progressKey('/delayed-registered/', 'newcomer');
  const claim = claimIntroduction(key, true);
  assert.equal(claimIntroduction(key, true), claim, 'effect replay shares the one real claim');
  assert.equal(await claim, true, 'the actual visitor must still receive the introduction');
  assert.equal(calls, 1);
});

test('resolved unregistered identity can claim after loading without a cached false result', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(JSON.stringify({ show: null }));
  });
  const key = progressKey('/delayed-unregistered/');
  assert.equal(await claimIntroduction(key, false), false);
  assert.equal(calls, 0);
  assert.equal(await claimIntroduction(key, true), true);
  assert.equal(calls, 1);
  recordIntroduction(key);
  assert.equal(await claimIntroduction(key, true), false);
});
