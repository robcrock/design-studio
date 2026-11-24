import { previewLifecycle } from './lifecycle';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
} from '@tanstack/react-router';
import { loadView } from '../load';
import { resolveTarget, previewTarget } from './target';
import {
  CHANNEL,
  VERSION,
  acceptsHost,
  identityOf,
  prototypeScopeOf,
  readBootstrap,
  routerHref,
  previewUrl,
  validHref,
  type Config,
  type PreviewMessage,
} from './protocol';
import PreviewSurface, { type LoadedView } from './PreviewSurface';
import { installStillness } from './still';
import {
  loadManifest,
  setManifest,
  allPrototypes,
  withItems,
  findArtifactByIdentity,
  findArtifact,
} from '@/platform/app/data/manifest';
import type { Manifest } from '@/platform/app/data/types';
import { addressOf } from '@/platform/core/roots';
import { previewShortcut } from '@/platform/app/shell/artifactShortcuts';
import { appPage, messageOrigin, postTarget } from '@/platform/app/data/downloaded';

let lifecycleSequence = 0; // Monotonic for this child document, including renderer remounts.
// A still embed holds its motion this long after it renders, so entrance animations finish first.
const SETTLE_MS = 1000;
type Status = Extract<PreviewMessage, { kind: 'status' }>;
const RuntimeContext = createContext<{
  config: Config;
  refresh: number;
  status: (state: Status['state'], render: number, detail?: string) => void;
} | null>(null);

// Fast handoffs never show a loading label. A slow initial load or view change still
// gets an accessible status, without replacing the outgoing screen.
function LoadingStatus({ retained }: { retained: boolean }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);
  return visible ? (
    <p role='status' className='pointer-events-none absolute inset-x-0 bottom-0 bg-background p-3 text-sm'>
      {retained ? 'Opening view' : 'Loading preview'}
    </p>
  ) : null;
}

function RuntimeView() {
  const { config, refresh, status } = useContext(RuntimeContext)!;
  const [loaded, setLoaded] = useState<{ identity: string; selector: string; value: LoadedView } | null>(null);
  const [error, setError] = useState<{ identity: string; detail: string } | null>(null);
  const render = useRef(0);
  const identity = identityOf(config.target);
  const selector = JSON.stringify([
    identity,
    config.target.contributor,
    config.target.prototype,
    config.target.artifact,
  ]);
  const pending = loaded?.selector !== selector;
  const lifecycle = useRef<ReturnType<typeof previewLifecycle> | null>(null);
  useEffect(() => {
    const controller = previewLifecycle(config.target, lifecycle => {
      const bootstrap = readBootstrap(location.search);
      if (window.parent !== window)
        window.parent.postMessage(
          {
            channel: CHANNEL,
            version: VERSION,
            session: bootstrap.session,
            runtime: document.documentElement.dataset.previewRuntime,
            identity,
            kind: 'lifecycle',
            sequence: ++lifecycleSequence,
            lifecycle,
          },
          postTarget(),
        );
    });
    lifecycle.current = controller;
    const compileError = (event: Event) => controller.failed((event as CustomEvent<string>).detail, true);
    window.addEventListener('studio:preview-compile-error', compileError);
    return () => {
      window.removeEventListener('studio:preview-compile-error', compileError);
      lifecycle.current = null;
      controller.dispose();
    };
  }, [identity, config.target.contributor, config.target.prototype, config.target.artifact]);
  useEffect(() => {
    let live = true;
    const revision = ++render.current;
    setError(null);
    status('loading', revision);
    lifecycle.current?.begin();
    void resolveTarget(config.target)
      .then(loadView)
      .then(result => {
        if (!live) return;
        if (!result) throw new Error('This React view could not load.');
        document.title = result.prototype.title + ' preview';
        setLoaded({ identity, selector, value: result });
      })
      .catch(error => {
        if (!live) return;
        const detail = error instanceof Error ? error.message : String(error);
        setLoaded(null);
        setError({ identity, detail });
        status('error', revision, detail);
        lifecycle.current?.failed(detail, false);
      });
    return () => {
      live = false;
    };
  }, [identity, config.target.contributor, config.target.prototype, config.target.artifact, refresh, status]);
  const ready = useCallback(() => {
    if (pending) return; // Retained output cannot acknowledge the incoming artifact.
    status('ready', render.current);
    lifecycle.current?.ready();
  }, [status, loaded, pending]);
  const failed = useCallback(
    (error: unknown) => {
      if (pending) return;
      const detail = error instanceof Error ? error.message : String(error);
      status('error', render.current, detail);
      lifecycle.current?.failed(detail, false);
    },
    [status, pending],
  );
  // Prepare before replacing the visible view. Keep outgoing output inert and explicitly
  // identified until the current request succeeds; the load effect rejects late results.
  if (error?.identity === identity)
    return (
      <div role='alert' className='p-8 text-sm'>
        <p>This page could not load. Give the error to your agent.</p>
        <pre className='mt-4 whitespace-pre-wrap'>{error.detail}</pre>
      </div>
    );
  return (
    <div
      className='relative flex min-h-0 flex-1 flex-col'
      aria-busy={pending || undefined}
      data-preview-displayed-identity={loaded?.identity}
      data-preview-pending-identity={pending ? identity : undefined}
    >
      <div className='flex min-h-0 flex-1 flex-col' inert={pending}>
        {loaded && <PreviewSurface loaded={loaded.value} surface={config.surface} ready={ready} failed={failed} />}
      </div>
      {pending && <LoadingStatus key={selector} retained={Boolean(loaded)} />}
    </div>
  );
}

async function targetFromHref(href: string): Promise<Config['target'] | null> {
  const url = new URL(href, location.href);
  if (url.searchParams.get('mode') === 'source') return null;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const pathname = url.pathname.slice(base.length);
  const refs = allPrototypes(await loadManifest());
  const permanent = /^\/prototypes\/([^/]+)\/artifacts\/([^/]+)$/.exec(pathname);
  if (permanent) {
    const ref = refs.find(proto => proto.studioId === permanent[1]);
    if (!ref) return null;
    const proto = await withItems(ref);
    const item = findArtifactByIdentity(proto, permanent[2]);
    return item?.fileType === 'view' ? previewTarget({ proto, item }) : null;
  }
  for (const ref of refs) {
    const prefix = addressOf(ref.contributorKey, ref.id) + '/';
    if (!pathname.startsWith(prefix)) continue;
    const proto = await withItems(ref);
    const item = findArtifact(proto, pathname.slice(prefix.length));
    if (item?.fileType === 'view') return previewTarget({ proto, item });
  }
  return null;
}

// What the document shows, for code running in it: its theme, and (as data-preview-surface and data-preview-target)
// whether it is a page or an embed and which view, so a module library can tell where it is (dialkit/README.md).
function describe(config: Config) {
  document.documentElement.classList.toggle('dark', config.dark);
  document.documentElement.dataset.previewSurface = config.surface;
  document.documentElement.dataset.previewTarget = JSON.stringify(config.target);
}

function start() {
  const bootstrap = readBootstrap(location.search);
  const hosted = window.parent !== window;
  const runtime = crypto.randomUUID();
  document.documentElement.dataset.previewRuntime = runtime;
  // Native links (including modified clicks) and relative assets see the artifact address.
  const addressBase = document.createElement('base');
  addressBase.href = new URL(bootstrap.config.href, location.href).href;
  document.head.prepend(addressBase);
  let current = bootstrap.config;
  let request = 0;
  let lastRender = 0;
  // Still embeds (README.md#still-embeds). Native timers, taken before stillness wraps them, keep the
  // runtime's own scheduling running while the view's motion is held.
  const later = window.setTimeout.bind(window) as (handler: () => void, ms: number) => number;
  const cancel = window.clearTimeout.bind(window);
  const stillness = current.surface === 'embed' ? installStillness(window) : null;
  let rendered = false;
  let settling: number | undefined | undefined;
  const updateMotion = () => {
    cancel(settling);
    if (!stillness) return;
    if (!current.still || !rendered) stillness.release();
    else settling = later(stillness.hold, SETTLE_MS);
  };
  const history = createMemoryHistory({ initialEntries: [current.href] });
  const rootRoute = createRootRoute({ component: Outlet });
  const viewRoute = createRoute({ getParentRoute: () => rootRoute, path: '$', component: RuntimeView });
  const router = createRouter({
    routeTree: rootRoute.addChildren([viewRoute]),
    history,
    basepath: import.meta.env.BASE_URL,
  });
  const envelope = () =>
    ({
      channel: CHANNEL,
      version: VERSION,
      session: bootstrap.session,
      runtime,
      identity: identityOf(current.target),
    }) as const;
  const send = (
    event:
      | Omit<Extract<PreviewMessage, { kind: 'status' }>, keyof ReturnType<typeof envelope>>
      | { kind: 'hello' }
      | { kind: 'navigate'; href: string; replace: boolean }
      | { kind: 'shortcut'; action: 'source' | 'grid' | 'palette' | 'navigation' },
  ) => {
    if (hosted) window.parent.postMessage({ ...envelope(), ...event }, postTarget());
  };
  function Runtime() {
    const [config, setConfig] = useState(current);
    const [refresh, setRefresh] = useState(0);
    const identity = identityOf(config.target);
    const status = useCallback(
      (state: Status['state'], render: number, detail = '') => {
        lastRender = Math.max(lastRender, render);
        rendered = state === 'ready';
        updateMotion();
        if (hosted)
          window.parent.postMessage(
            { ...envelope(), identity, kind: 'status', state, render: lastRender, detail: detail.slice(0, 4096) },
            postTarget(),
          );
      },
      [identity],
    );
    useEffect(() => {
      const apply = (next: Config) => {
        current = next;
        addressBase.href = new URL(next.href, location.href).href;
        describe(next);
        updateMotion();
        setConfig(next);
        if (history.location.href !== next.href) {
          void router.navigate({ to: routerHref(next.href, import.meta.env.BASE_URL) as never, replace: true });
        }
      };
      const onMessage = (event: MessageEvent) => {
        if (
          !acceptsHost(
            event,
            window.parent,
            messageOrigin(),
            bootstrap.session,
            runtime,
            bootstrap.config.surface,
            prototypeScopeOf(bootstrap.config.target),
          )
        )
          return;
        apply(event.data.config);
      };
      const navigation = async (href: string, replace: boolean) => {
        if (!validHref(href)) return;
        if (current.surface === 'embed' || href === current.href) return;
        if (hosted) {
          send({ kind: 'navigate', href, replace });
          return;
        }
        const ticket = ++request;
        const target = await targetFromHref(href);
        if (ticket !== request) return;
        if (!target) {
          window.location.assign(href);
          return;
        }
        if (prototypeScopeOf(target) !== prototypeScopeOf(current.target)) {
          window.location.assign(previewUrl({ ...current, target, href }, crypto.randomUUID(), appPage()));
          return;
        }
        apply({ ...current, target, href });
        const url = previewUrl(current, bootstrap.session, appPage());
        if (replace) window.history.replaceState(null, '', url);
        else window.history.pushState(null, '', url);
      };
      const unsubscribe = history.subscribe(({ action }) => {
        void navigation(history.location.href, action.type === 'REPLACE');
      });
      const onClick = (event: MouseEvent) => {
        const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
        if (
          !anchor ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.altKey ||
          event.shiftKey ||
          anchor.download ||
          anchor.target === '_blank'
        )
          return;
        const raw = anchor.getAttribute('href')!;
        const url = new URL(raw, document.baseURI);
        if (raw.startsWith('#')) {
          event.preventDefault();
          const hash = raw.slice(1);
          try {
            document.getElementById(decodeURIComponent(hash))?.scrollIntoView();
          } catch {
            /* malformed hash */
          }
          void router.navigate({
            to: routerHref(
              history.location.pathname + history.location.search + raw,
              import.meta.env.BASE_URL,
            ) as never,
          });
        } else if (url.origin === messageOrigin() && url.pathname.startsWith(import.meta.env.BASE_URL)) {
          // Native anchors and TanStack links both stay inside the Studio navigation policy.
          event.preventDefault();
          void router.navigate({
            to: routerHref(url.pathname + url.search + url.hash, import.meta.env.BASE_URL) as never,
          });
        } else if (url.protocol === 'https:' || url.protocol === 'http:') {
          event.preventDefault();
          window.open(url.href, '_blank', 'noopener,noreferrer');
        }
      };
      const onKey = (event: KeyboardEvent) => {
        const action = previewShortcut(event);
        if (!hosted || current.surface !== 'page' || event.defaultPrevented || !action) return;
        if (
          event.target instanceof HTMLElement &&
          (event.target.isContentEditable || event.target.closest('input,textarea,select'))
        )
          return;
        if (
          (action === 'source' || action === 'grid') &&
          document.querySelector('[role="dialog"],[role="alertdialog"],[role="menu"]')
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        send({ kind: 'shortcut', action });
      };
      // Preserve the shell's reserved shortcuts; search can be consumed by prototype handlers.
      const onReservedKey = (event: KeyboardEvent) => {
        if (previewShortcut(event) !== 'palette') onKey(event);
      };
      const onSearchKey = (event: KeyboardEvent) => {
        if (previewShortcut(event) === 'palette') onKey(event);
      };
      const onPopState = () => {
        if (hosted) return;
        try {
          const next = readBootstrap(location.search);
          if (
            next.session !== bootstrap.session ||
            prototypeScopeOf(next.config.target) !== prototypeScopeOf(current.target) ||
            next.config.surface !== current.surface
          ) {
            window.location.reload();
            return;
          }
          ++request; // Cancel any pending direct navigation before restoring browser history.
          apply(next.config);
        } catch {
          window.location.reload();
        }
      };
      window.addEventListener('popstate', onPopState);
      // A change releases held motion first, so the update renders and settles before holding again.
      const reload = () => {
        rendered = false;
        updateMotion();
        setRefresh(value => value + 1);
      };
      const manifest = ({ manifest }: { manifest: Manifest }) => {
        setManifest(manifest);
        reload();
      };
      let hmrTimer: number | undefined | undefined;
      const hmrComplete = () => {
        cancel(hmrTimer);
        rendered = false;
        updateMotion();
        hmrTimer = later(reload, 40);
      };
      const reportError = (detail: string) => {
        send({ kind: 'status', state: 'error', render: lastRender, detail: detail.slice(0, 4096) });
        window.dispatchEvent(new CustomEvent('studio:preview-compile-error', { detail }));
      };
      const uncaught = (event: ErrorEvent) => reportError(event.message);
      const rejected = (event: PromiseRejectionEvent) => reportError(String(event.reason));
      window.addEventListener('message', onMessage);
      document.addEventListener('click', onClick);
      window.addEventListener('keydown', onReservedKey, true);
      window.addEventListener('keydown', onSearchKey);
      window.addEventListener('error', uncaught);
      window.addEventListener('unhandledrejection', rejected);
      window.addEventListener('studio:views', reload);
      if (import.meta.hot) {
        import.meta.hot.on('studio:manifest', manifest);
        import.meta.hot.on('studio:file', reload);
        import.meta.hot.on('vite:afterUpdate', hmrComplete);
      }
      apply(current);
      send({ kind: 'hello' });
      return () => {
        cancel(hmrTimer);
        cancel(settling);
        unsubscribe();
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('message', onMessage);
        document.removeEventListener('click', onClick);
        window.removeEventListener('keydown', onReservedKey, true);
        window.removeEventListener('keydown', onSearchKey);
        window.removeEventListener('error', uncaught);
        window.removeEventListener('unhandledrejection', rejected);
        window.removeEventListener('studio:views', reload);
        import.meta.hot?.off('studio:manifest', manifest);
        import.meta.hot?.off('studio:file', reload);
        import.meta.hot?.off('vite:afterUpdate', hmrComplete);
      };
    }, []);
    return (
      <RuntimeContext.Provider value={{ config, refresh, status }}>
        <RouterProvider router={router} />
      </RuntimeContext.Provider>
    );
  }
  describe(current);
  const mount = document.getElementById('root')!;
  mount.style.cssText = 'height:100vh;display:flex;flex-direction:column;overflow:hidden';
  if (current.surface === 'embed') mount.inert = true;
  const root = createRoot(mount);
  root.render(<Runtime />);
  import.meta.hot?.dispose(() => {
    root.unmount();
    addressBase.remove();
  });
}

try {
  start();
} catch (error) {
  const root = document.getElementById('root')!;
  root.setAttribute('role', 'alert');
  root.textContent = error instanceof Error ? error.message : 'This preview could not start.';
}
