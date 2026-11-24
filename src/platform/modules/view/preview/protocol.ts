import { validLifecycle, type ArtifactLifecycle } from '../../../core/artifact-lifecycle/index.ts';
// Transport validation, not a security sandbox. Same-origin repository code is trusted.
export const CHANNEL = 'studio-preview';
export const VERSION = 2;
export type Target = {
  contributor: string;
  prototype: string;
  prototypeId: string | null;
  artifact: string;
  artifactId: string | null;
};
export type Surface = 'page' | 'embed';
// `still`: an embed holds its motion once rendered (README.md#still-embeds). A page is never still.
export type Config = { target: Target; href: string; dark: boolean; surface: Surface; still: boolean };
export type Envelope = {
  channel: typeof CHANNEL;
  version: typeof VERSION;
  session: string;
  runtime: string;
  identity: string;
};
export type HostMessage = Envelope & { kind: 'configure'; config: Config };
export type PreviewMessage = Envelope &
  (
    | { kind: 'hello' }
    | { kind: 'lifecycle'; sequence: number; lifecycle: ArtifactLifecycle }
    | { kind: 'status'; state: 'loading' | 'ready' | 'error'; render: number; detail: string }
    | { kind: 'navigate'; href: string; replace: boolean }
    | { kind: 'shortcut'; action: 'source' | 'grid' | 'palette' | 'navigation' }
  );
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, max = 2048): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
export function validTarget(value: unknown): value is Target {
  return (
    record(value) &&
    text(value.contributor, 128) &&
    text(value.prototype, 256) &&
    text(value.artifact, 1024) &&
    [value.prototypeId, value.artifactId].every(
      id => id === null || (typeof id === 'string' && /^[0-9abcdefghjkmnpqrstvwxyz]{16}$/.test(id)),
    )
  );
}
export const prototypeScopeOf = (target: Target) =>
  target.prototypeId ?? JSON.stringify([target.contributor, target.prototype]);
export const identityOf = (target: Target) =>
  JSON.stringify([target.prototypeId ?? [target.contributor, target.prototype], target.artifactId ?? target.artifact]);
export function validHref(value: unknown): value is string {
  return text(value) && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\');
}
export function validConfig(value: unknown): value is Config {
  return (
    record(value) &&
    validTarget(value.target) &&
    validHref(value.href) &&
    typeof value.dark === 'boolean' &&
    (value.surface === 'page' || value.surface === 'embed') &&
    typeof value.still === 'boolean' &&
    !(value.surface === 'page' && value.still)
  );
}
function envelope(value: unknown): value is Record<string, unknown> & Envelope {
  return (
    record(value) &&
    value.channel === CHANNEL &&
    value.version === VERSION &&
    text(value.session, 128) &&
    text(value.runtime, 128) &&
    text(value.identity, 2048)
  );
}
export function isHostMessage(value: unknown): value is HostMessage {
  return (
    envelope(value) &&
    value.kind === 'configure' &&
    validConfig(value.config) &&
    value.identity === identityOf(value.config.target)
  );
}
export function isPreviewMessage(value: unknown): value is PreviewMessage {
  if (!envelope(value)) return false;
  if (value.kind === 'hello') return true;
  if (value.kind === 'lifecycle')
    return Number.isSafeInteger(value.sequence) && Number(value.sequence) >= 0 && validLifecycle(value.lifecycle);
  if (value.kind === 'navigate') return validHref(value.href) && typeof value.replace === 'boolean';
  if (value.kind === 'shortcut')
    return typeof value.action === 'string' && ['source', 'grid', 'palette', 'navigation'].includes(value.action);
  return (
    value.kind === 'status' &&
    typeof value.state === 'string' &&
    ['loading', 'ready', 'error'].includes(value.state) &&
    Number.isSafeInteger(value.render) &&
    Number(value.render) >= 0 &&
    typeof value.detail === 'string' &&
    value.detail.length <= 4096
  );
}
export function acceptsSender(
  event: Pick<MessageEvent, 'source' | 'origin'>,
  source: MessageEventSource | null,
  origin: string,
) {
  return source !== null && event.source === source && event.origin === origin;
}
export function acceptsPreview(
  event: Pick<MessageEvent, 'source' | 'origin' | 'data'>,
  source: MessageEventSource | null,
  origin: string,
  session: string,
  identity: string,
  runtime: string | null,
) {
  return (
    acceptsSender(event, source, origin) &&
    isPreviewMessage(event.data) &&
    event.data.session === session &&
    (event.data.kind === 'hello' || (event.data.runtime === runtime && event.data.identity === identity))
  );
}
// `page` is the document that runs the app (src/platform/app/data/downloaded.ts appPage).
export function previewUrl(config: Config, session: string, page: string) {
  const params = new URLSearchParams({ 'studio-preview': '1', session, config: JSON.stringify(config) });
  return page + '?' + params;
}
export function readBootstrap(search: string): { config: Config; session: string } {
  if (search.length > 8192) throw new Error('Preview address is too long.');
  const params = new URLSearchParams(search);
  const session = params.get('session');
  const config: unknown = JSON.parse(params.get('config') ?? 'null');
  if (!text(session, 128) || !validConfig(config)) throw new Error('Invalid preview address.');
  return { config, session };
}

export function acceptsHost(
  event: Pick<MessageEvent, 'source' | 'origin' | 'data'>,
  source: MessageEventSource | null,
  origin: string,
  session: string,
  runtime: string,
  surface: Surface,
  prototypeScope: string,
) {
  return (
    acceptsSender(event, source, origin) &&
    isHostMessage(event.data) &&
    event.data.session === session &&
    event.data.runtime === runtime &&
    event.data.config.surface === surface &&
    prototypeScopeOf(event.data.config.target) === prototypeScope
  );
}

// TanStack adds its basepath to navigation targets; bridge hrefs already include it.
export function routerHref(href: string, base: string) {
  const prefix = base.replace(/\/$/, '');
  if (
    !prefix ||
    !(
      href === prefix ||
      href.startsWith(prefix + '/') ||
      href.startsWith(prefix + '?') ||
      href.startsWith(prefix + '#')
    )
  )
    return href;
  const relative = href.slice(prefix.length);
  return relative.startsWith('/') ? relative : '/' + relative;
}
