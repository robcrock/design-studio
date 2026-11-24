import {
  freshness,
  lifecycleAttributes,
  initialLifecycle,
  type ArtifactLifecycle,
} from '@/platform/core/artifact-lifecycle/index';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useRouterState } from '@tanstack/react-router';
import { appPage, messageOrigin, postTarget } from '@/platform/app/data/downloaded';
import {
  CHANNEL,
  VERSION,
  acceptsPreview,
  identityOf,
  routerHref,
  previewUrl,
  type Config,
  type Target,
  type Surface,
  type HostMessage,
} from './protocol';

export default function PreviewHost({
  target,
  href,
  title,
  surface,
  still,
  width,
  height,
}: {
  target: Target;
  href: string;
  title: string;
  surface: Surface;
  // An embed that holds its motion once rendered. A page is never still.
  still: boolean;
  width?: number;
  height?: number;
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const boundary = useRef<HTMLDivElement>(null);
  const armWatchdog = useRef(() => {});
  const session = useRef(crypto.randomUUID());
  const runtime = useRef<string | null>(null);
  const interactive = useRef(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [state, setState] = useState('loading');
  const [lifecycle, setLifecycle] = useState<ArtifactLifecycle>(initialLifecycle);
  const lifecycleOrder = useRef(-1);
  const [unresponsive, setUnresponsive] = useState(false);
  // A saved file is briefly newer than the preview until the dev server swaps the code in. Say "out of date" only
  // when that lasts; errors and unverified previews show at once.
  const updating = freshness(lifecycle) === 'stale' && lifecycle.phase !== 'error' && !lifecycle.detail;
  const updatingNotice = useLasting(updating, NOTICE_DELAY);
  const identity = identityOf(target);
  const latestRender = useRef({ identity, render: -1 });
  if (latestRender.current.identity !== identity) latestRender.current = { identity, render: -1 };
  useRouterState({ select: state => state.location });
  // Router locations may omit a deployment basepath; history retains the public address.
  const pageUrl = new URL(router.history.location.href, window.location.href);
  interactive.current = surface === 'page' && pageUrl.searchParams.get('mode') !== 'source';
  if (pageUrl.searchParams.get('mode') === 'source') pageUrl.searchParams.delete('mode');
  const currentHref =
    surface === 'page'
      ? pageUrl.pathname + pageUrl.search + pageUrl.hash
      : import.meta.env.BASE_URL.replace(/\/$/, '') + href;
  const config: Config = { target, href: currentHref, dark, surface, still: surface === 'embed' && still };
  const current = useRef(config);
  current.current = config;
  // Stable URL: artifact, theme and search changes travel through configure, never a remount.
  const [src] = useState(() => previewUrl(config, session.current, appPage()));
  const send = () => {
    const config = current.current;
    if (!runtime.current) return;
    const message: HostMessage = {
      channel: CHANNEL,
      version: VERSION,
      session: session.current,
      runtime: runtime.current,
      identity: identityOf(config.target),
      kind: 'configure',
      config,
    };
    frame.current?.contentWindow?.postMessage(message, postTarget());
  };
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    // Studio may restore its saved theme between this render and subscription.
    setDark(document.documentElement.classList.contains('dark'));
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setState('loading');
    setLifecycle(initialLifecycle());
    lifecycleOrder.current = -1;
    armWatchdog.current();
  }, [identity]);
  useEffect(send, [identity, currentHref, dark, config.still]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setUnresponsive(true), 15000);
    };
    armWatchdog.current = arm;
    const onMessage = (event: MessageEvent) => {
      const config = current.current;
      if (
        !acceptsPreview(
          event,
          frame.current?.contentWindow ?? null,
          messageOrigin(),
          session.current,
          identityOf(config.target),
          runtime.current,
        )
      )
        return;
      const message = event.data;
      setUnresponsive(false);
      if (message.kind === 'lifecycle') {
        const next = message.lifecycle;
        if (message.sequence <= lifecycleOrder.current) return;
        lifecycleOrder.current = message.sequence;
        setLifecycle(next);
        boundary.current?.dispatchEvent(
          new CustomEvent('studio:artifact-lifecycle', {
            bubbles: true,
            detail: {
              identity: message.identity,
              session: session.current,
              runtime: message.runtime,
              surface: config.surface,
              lifecycle: next,
            },
          }),
        );
      }
      if (message.kind === 'hello') {
        setState('loading');
        setLifecycle(initialLifecycle());
        lifecycleOrder.current = -1;
        runtime.current = message.runtime;
        latestRender.current.render = -1;
        send();
        arm();
      }
      if (message.kind === 'status') {
        if (message.render < latestRender.current.render) return;
        latestRender.current.render = message.render;
        if (message.state === 'loading') arm();
        else clearTimeout(timer);
        setState(message.state);
        boundary.current?.dispatchEvent(
          new CustomEvent('studio:preview-state', {
            bubbles: true,
            detail: {
              session: session.current,
              runtime: message.runtime,
              identity: message.identity,
              surface: config.surface,
              state: message.state,
              render: message.render,
            },
          }),
        );
      }
      if (!interactive.current) return;
      if (message.kind === 'navigate')
        void router.navigate({
          to: routerHref(message.href, import.meta.env.BASE_URL) as never,
          replace: message.replace,
        });
      if (message.kind === 'shortcut') {
        // Reuse the host's shortcut guards and behavior (source and canvas grid).
        const key = message.action === 'palette' ? 'k' : message.action === 'navigation' ? ';' : "'";
        window.dispatchEvent(
          new KeyboardEvent('keydown', {
            key,
            code: key === 'k' ? 'KeyK' : key === ';' ? 'Semicolon' : 'Quote',
            ctrlKey: true,
            shiftKey: message.action === 'grid',
            bubbles: true,
          }),
        );
      }
    };
    arm();
    window.addEventListener('message', onMessage);
    return () => {
      armWatchdog.current = () => {};
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    };
  }, [router]);
  return (
    <div
      ref={boundary}
      {...lifecycleAttributes(lifecycle)}
      data-artifact-identity={identity}
      className='relative flex min-h-0 min-w-0 flex-1 flex-col'
      data-preview-state={state}
      data-preview-identity={identity}
      data-preview-session={session.current}
      data-preview-freshness={freshness(lifecycle)}
      data-preview-phase={lifecycle.phase}
      data-preview-source-revision={lifecycle.source?.source}
      data-preview-input-revision={lifecycle.source?.inputs}
      data-preview-displayed-revision={lifecycle.displayed?.revision.inputs}
    >
      <iframe
        ref={frame}
        src={src}
        title={title + ' preview'}
        onLoad={send}
        tabIndex={surface === 'embed' ? -1 : undefined}
        aria-hidden={surface === 'embed' || undefined}
        className='min-h-0 w-full flex-1 border-0 bg-background'
        style={{
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
          ...(surface === 'embed' && { pointerEvents: 'none' }),
        }}
      />
      {surface === 'page' &&
        !unresponsive &&
        (updating ? updatingNotice : freshness(lifecycle) === 'stale' || lifecycle.detail) && (
          <div role='status' className='absolute inset-x-0 bottom-0 bg-background p-3 text-sm'>
            {freshness(lifecycle) === 'stale' ? 'This preview is out of date. ' : ''}
            {lifecycle.phase === 'error'
              ? 'The latest changes could not render. Give the error to your agent.'
              : lifecycle.detail || 'Updating preview'}
          </div>
        )}
      {surface === 'page' && unresponsive && (
        <div role='status' className='absolute inset-x-0 bottom-0 bg-background p-3 text-sm'>
          Preview has not responded.
        </div>
      )}
    </div>
  );
}

const NOTICE_DELAY = 1000;

// True once `value` has stayed true for `delay` ms; false again as soon as it turns false.
function useLasting(value: boolean, delay: number) {
  const [lasting, setLasting] = useState(false);
  useEffect(() => {
    if (!value) {
      setLasting(false);
      return;
    }
    const timer = setTimeout(() => setLasting(true), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return value && lasting;
}
