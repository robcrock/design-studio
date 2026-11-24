import { initialLifecycle } from '../../../core/artifact-lifecycle/index.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHANNEL,
  VERSION,
  identityOf,
  prototypeScopeOf,
  isHostMessage,
  isPreviewMessage,
  acceptsPreview,
  acceptsSender,
  acceptsHost,
  previewUrl,
  readBootstrap,
  routerHref,
  validHref,
  type Target,
  type Config,
} from './protocol.ts';
const target: Target = {
  contributor: 'person',
  prototype: 'sample',
  prototypeId: '0123456789abcdef',
  artifact: 'screen.tsx',
  artifactId: 'fedcba9876543210',
};
const config: Config = {
  target,
  href: '/studio/prototypes/0123456789abcdef/artifacts/fedcba9876543210?q=hello#part',
  dark: false,
  surface: 'page',
  still: false,
};
const envelope = {
  channel: CHANNEL,
  version: VERSION,
  session: 'session-a',
  runtime: 'document-a',
  identity: identityOf(target),
};
const source = {} as Window;
const origin = 'http://localhost:5197';
const event = (data: unknown, sender: MessageEventSource | null = source, from = origin) => ({
  data,
  source: sender,
  origin: from,
});
const ready = { ...envelope, kind: 'status', state: 'ready', render: 1, detail: '' };

test('preview messages reject other frames, origins, sessions, versions and stale artifacts', () => {
  const accept = (value: ReturnType<typeof event>) =>
    acceptsPreview(value, source, origin, envelope.session, envelope.identity, envelope.runtime);
  assert.equal(accept(event(ready)), true);
  assert.equal(accept(event(ready, {} as Window)), false);
  assert.equal(accept(event(ready, null)), false);
  assert.equal(accept(event(ready, source, 'https://elsewhere.example')), false);
  for (const change of [
    { runtime: 'previous-document' },
    { version: VERSION + 1 },
    { session: 'session-b' },
    { identity: 'other-artifact' },
    { channel: 'other-channel' },
  ])
    assert.equal(accept(event({ ...ready, ...change })), false);
  // A same-session runtime reload can announce its bootstrap artifact; the host
  // responds with its current target. This exception applies only to hello.
  assert.equal(accept(event({ ...envelope, kind: 'hello', identity: 'previous-artifact' })), true);
  assert.equal(acceptsSender(event(ready), null, origin), false);
});

test('protocol accepts only declared operations and bounded payloads', () => {
  for (const kind of ['write', 'save', 'execute', 'inspect', 'unknown'])
    assert.equal(isPreviewMessage({ ...envelope, kind }), false);
  for (const render of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(isPreviewMessage({ ...ready, render }), false);
  assert.equal(isPreviewMessage({ ...ready, detail: 'x'.repeat(4097) }), false);
  assert.equal(isPreviewMessage({ ...ready, state: 'invented' }), false);
  assert.equal(isPreviewMessage({ ...ready, state: new String('ready') }), false);
  assert.equal(isPreviewMessage({ ...envelope, kind: 'navigate', href: '/studio/prototypes', replace: false }), true);
  for (const href of [
    '//evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/bad\\path',
    '/bad\npath',
    'x'.repeat(2049),
  ]) {
    assert.equal(validHref(href), false);
    assert.equal(isPreviewMessage({ ...envelope, kind: 'navigate', href, replace: false }), false);
  }
  for (const action of ['source', 'grid', 'palette', 'navigation'])
    assert.equal(isPreviewMessage({ ...envelope, kind: 'shortcut', action }), true);
  assert.equal(isPreviewMessage({ ...envelope, kind: 'shortcut', action: 'save' }), false);
  assert.equal(isPreviewMessage({ ...envelope, kind: 'shortcut', action: new String('source') }), false);
});

test('configuration identity and surface are explicit and validated', () => {
  const message = { ...envelope, kind: 'configure', config };
  assert.equal(isHostMessage(message), true);
  assert.equal(isHostMessage({ ...message, identity: 'forged' }), false);
  for (const change of [
    { dark: undefined },
    { surface: 'invented' },
    { still: undefined },
    { still: true }, // a page is never still
    { href: '//evil.example' },
    { target: { ...target, artifactId: 'invalid' } },
    { target: { ...target, prototype: 'x'.repeat(257) } },
  ])
    assert.equal(isHostMessage({ ...message, config: { ...config, ...change } }), false);
  const renamed = {
    ...target,
    contributor: 'renamed-person',
    prototype: 'renamed-prototype',
    artifact: 'moved/screen.tsx',
  };
  assert.equal(identityOf(renamed), identityOf(target));
  assert.notEqual(identityOf({ ...target, artifactId: '1234567890abcdef' }), identityOf(target));
  assert.notEqual(identityOf({ ...target, prototypeId: null }), identityOf(target));
});

test('direct preview URLs round-trip under a static base path without another HTML entry', () => {
  const url = new URL(previewUrl(config, envelope.session, '/studio/index.html'), origin);
  assert.equal(url.pathname, '/studio/index.html');
  assert.equal(url.searchParams.get('studio-preview'), '1');
  assert.deepEqual(readBootstrap(url.search), { config, session: envelope.session });
  assert.throws(() => readBootstrap('?config=not-json&session=a'));
  assert.throws(() => readBootstrap('?config=null'));
  assert.throws(() => readBootstrap('?' + 'x'.repeat(8192)));
});

test('host configuration rejects other senders and obsolete documents', () => {
  const message = { ...envelope, kind: 'configure', config };
  const accept = (value: ReturnType<typeof event>) =>
    acceptsHost(value, source, origin, envelope.session, envelope.runtime, 'page', prototypeScopeOf(target));
  assert.equal(accept(event(message)), true);
  const otherTarget = { ...target, prototypeId: '1234567890abcdef' };
  assert.equal(
    accept(event({ ...message, identity: identityOf(otherTarget), config: { ...config, target: otherTarget } })),
    false,
  );
  assert.equal(accept(event(message, {} as Window)), false);
  assert.equal(accept(event(message, source, 'https://elsewhere.example')), false);
  for (const change of [
    { runtime: 'previous-document' },
    { session: 'other-session' },
    { config: { ...config, surface: 'embed' } },
  ])
    assert.equal(accept(event({ ...message, ...change })), false);
});

test('bridge hrefs lose exactly one router basepath before navigation', () => {
  assert.equal(routerHref('/studio/prototypes/a?q=x#part', '/studio/'), '/prototypes/a?q=x#part');
  assert.equal(routerHref('/studio/', '/studio/'), '/');
  assert.equal(routerHref('/studio?q=x', '/studio/'), '/?q=x');
  assert.equal(routerHref('/studio-other/page', '/studio/'), '/studio-other/page');
  assert.equal(routerHref('/prototypes/a', '/'), '/prototypes/a');
});

test('lifecycle reports require valid evidence and bounded transport ordering', () => {
  const message = { ...envelope, kind: 'lifecycle', sequence: 1, lifecycle: initialLifecycle() };
  assert.equal(isPreviewMessage(message), true);
  assert.equal(
    acceptsPreview(event(message), source, origin, envelope.session, envelope.identity, envelope.runtime),
    true,
  );
  for (const sequence of [undefined, -1, Infinity, 0.5])
    assert.equal(isPreviewMessage({ ...message, sequence }), false);
  assert.equal(isPreviewMessage({ ...message, lifecycle: { ...initialLifecycle(), phase: 'ready' } }), false);
  assert.equal(
    acceptsPreview(
      event({ ...message, identity: 'old-artifact' }),
      source,
      origin,
      envelope.session,
      envelope.identity,
      envelope.runtime,
    ),
    false,
  );
});
