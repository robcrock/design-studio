// A canvas: views and documents from its own prototype, laid out with sticky notes, text and arrows,
// on Excalidraw. Each canvas is one .excalidraw file. In dev you edit it and it saves itself;
// the deployed site shows the committed file, read-only.
//
// This wires the pieces together; each lives in its own module (README.md).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Excalidraw, FONT_FAMILY, getSceneVersion, restoreElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, ExcalidrawImperativeAPI, ExcalidrawProps } from '@excalidraw/excalidraw/types';
import { ownsPrototype, useMe } from '@/platform/app/data/files';
import { useManifest } from '@/platform/app/data/useManifest';
import type { Artifact, Prototype } from '@/platform/app/data/types';
import './canvas.css';
import { cameraKey, initialCamera, useRememberCamera } from './camera';
import { ControlTooltip } from './ControlTooltip';
import {
  CanvasItem,
  normalizeEmbeds,
  onlyItemsSelected,
  openingEmbedIds,
  playingId,
  renderFlags,
  validateEmbed,
} from './embeds';
import { parseCanvas } from './format';
import { useHelpDialogPruning } from './helpDialog';
import { MOUNT_INTERVAL_MS, SWEEP_INTERVAL_MS, createMountGate, pickEvictions } from './liveViews';
import { useCanvasOpening, CanvasOpeningSurface } from './CanvasOpening';
import { CanvasMenu, UI_OPTIONS } from './menu';
import { useCanvasShortcuts } from './shortcuts';
import { useCanvasFile } from './useCanvasFile';
import { useCanvasDark } from './theme';
import { Button } from '@/platform/systems/studio/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/systems/studio/components/dialog';

type Props = { proto: Prototype; item: Artifact; text: string; version: string };

// The page is keyed by its file, so opening another canvas starts fresh.
export default function Canvas(props: Props) {
  return <OpenCanvas key={`${props.proto.contributorKey}/${props.proto.id}/${props.item.path}`} {...props} />;
}

function OpenCanvas({ proto, item, text, version }: Props) {
  const file = `${proto.contributorKey}/${proto.id}/${item.path}`;
  const me = useMe();
  const manifest = useManifest();
  const dark = useCanvasDark();
  const container = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  // The file as loaded. A file that can't be read is reported instead of opened.
  const loaded = useMemo<Loaded | { error: string }>(() => {
    try {
      const parsed = parseCanvas(text);
      const elements = restoreElements(parsed.elements as never, null, {
        refreshDimensions: true,
      }) as ExcalidrawElement[];
      return { parsed, elements, sceneVersion: getSceneVersion(elements) };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [text]);
  if ('error' in loaded) return <CanvasError message={loaded.error} />;

  // Editing is dev-only and only in your own prototypes; a file from a newer app is never saved over.
  const editable = import.meta.env.DEV && ownsPrototype(proto, me) && !loaded.parsed.tooNew;
  return <Editor {...{ proto, item, file, version, text, manifest, dark, container, api, setApi, editable, loaded }} />;
}

function CanvasError({ message }: { message: string }) {
  return (
    <div role='alert' className='max-w-2xl space-y-3 p-8'>
      <p className='text-sm font-medium'>This canvas couldn't be opened. Ask your agent to fix the file.</p>
      <pre className='overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap text-muted-foreground'>
        {message}
      </pre>
    </div>
  );
}

type Loaded = { parsed: ReturnType<typeof parseCanvas>; elements: ExcalidrawElement[]; sceneVersion: number };

function Editor({
  proto,
  item,
  file,
  version,
  text,
  manifest,
  dark,
  container,
  api,
  setApi,
  editable,
  loaded,
}: Props & {
  file: string;
  manifest: ReturnType<typeof useManifest>;
  dark: boolean;
  container: React.RefObject<HTMLDivElement | null>;
  api: ExcalidrawImperativeAPI | null;
  setApi: (api: ExcalidrawImperativeAPI | null) => void;
  editable: boolean;
  loaded: Loaded;
}) {
  useHelpDialogPruning();
  const {
    onChange: saveChanges,
    persist,
    saveState,
    blocker,
    retry,
    discard,
  } = useCanvasFile({
    proto,
    item,
    api,
    editable,
    initial: { text, version, elements: loaded.elements, sceneVersion: loaded.sceneVersion },
  });
  const onScrollChange = useRememberCamera(cameraKey(file));
  const { controlsHidden, toggleControls } = useCanvasShortcuts(api, container);
  const [itemsOnly, setItemsOnly] = useState(false);
  const [empty, setEmpty] = useState(!loaded.elements.some(el => !el.isDeleted));
  // The hint shows only once the canvas has stayed empty for a moment, so a scene that is still
  // arriving (opening, or a change from the file landing) never flashes it.
  const [hintReady, setHintReady] = useState(false);

  // The opening camera needs the container's size, so Excalidraw mounts once that is known.
  const [initialData, setInitialData] = useState<ExcalidrawProps['initialData']>(null);
  useLayoutEffect(() => {
    const camera = initialCamera(loaded.elements, cameraKey(file), container.current);
    setInitialData({
      elements: loaded.elements,
      appState: {
        theme: dark ? 'dark' : 'light',
        viewBackgroundColor: loaded.parsed.background,
        gridSize: loaded.parsed.gridSize ?? undefined,
        currentItemFontFamily: FONT_FAMILY.Nunito,
        ...camera,
      } as never,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { revealed, openingStatus } = useCanvasOpening(container, api, () =>
    openingEmbedIds(api!.getSceneElements(), api!.getAppState(), manifest, proto),
  );

  useEffect(() => {
    if (!empty || !revealed) {
      setHintReady(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setHintReady(true), 500);
    return () => window.clearTimeout(timer);
  }, [empty, revealed]);

  const manifestRef = useRef(manifest);
  manifestRef.current = manifest;
  useEffect(() => {
    if (!api) return;
    if (editable) normalizeEmbeds(api, api.getSceneElementsIncludingDeleted(), manifestRef.current, proto);
  }, [api, editable]);

  // Frame headers remain clickable, but their wheel gestures belong to Excalidraw. Its native
  // handler ignores HTML links; forward these to the drawing surface for the same pan/zoom behavior.
  useEffect(() => {
    const el = container.current;
    if (!el || !api) return;
    const onWheel = (event: WheelEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-canvas-frame] [data-open]')) return;
      const surface = el.querySelector('canvas.interactive');
      if (!surface) return;
      event.preventDefault();
      event.stopPropagation();
      surface.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          deltaZ: event.deltaZ,
          deltaMode: event.deltaMode,
          clientX: event.clientX,
          clientY: event.clientY,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
        }),
      );
    };
    el.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => el.removeEventListener('wheel', onWheel, true);
  }, [api, container]);

  // For an agent with a browser: the canvas tools (agent.ts), dev only. Loaded on demand, so the
  // deployed site doesn't carry them.
  const editableRef = useRef(editable);
  editableRef.current = editable;
  useEffect(() => {
    if (!api || !import.meta.env.DEV) return undefined;
    let installed: object | undefined;
    let cancelled = false;
    import('./agent').then(({ createCanvasAgent }) => {
      if (cancelled) return;
      installed = createCanvasAgent({
        api,
        proto,
        item,
        manifest: () => manifestRef.current,
        editable: () => editableRef.current,
        persist,
      });
      (window as unknown as { __studioCanvas?: object }).__studioCanvas = installed;
    });
    return () => {
      cancelled = true;
      const w = window as unknown as { __studioCanvas?: object };
      if (w.__studioCanvas === installed) delete w.__studioCanvas;
    };
  }, [api]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastVersion = useRef(0);
  const onChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (!api) return;
      // Previews are pictures: never activate one for interaction inside the canvas.
      if (appState.activeEmbeddable) api.updateScene({ appState: { activeEmbeddable: null } });
      setItemsOnly(onlyItemsSelected(elements, appState));
      setEmpty(!elements.some(el => !el.isDeleted));
      saveChanges(elements, appState);
      const version = getSceneVersion(elements);
      if (editable && version !== lastVersion.current) {
        lastVersion.current = version;
        normalizeEmbeds(api, elements, manifestRef.current, proto);
      }
    },
    [api, editable, saveChanges],
  );

  // Previews mount when they come near the viewport, one at a time, and stay live until the canvas
  // holds more than MAX_LIVE; then the ones seen longest ago unmount (keeping their sized frame).
  // `lastSeen` maps live previews to when each was last visible.
  const lastSeen = useRef(new Map<string, number>());
  const [epoch, setEpoch] = useState(0);
  const gate = useRef(createMountGate());
  const admitTimer = useRef(0);
  const renderEmbeddable = useCallback(
    (element: ExcalidrawElement, appState: AppState) => {
      const { offscreen, overview } = renderFlags(element, appState);
      if (!offscreen && !overview) {
        const now = Date.now();
        if (lastSeen.current.has(element.id) || gate.current(now)) lastSeen.current.set(element.id, now);
        else if (!admitTimer.current) {
          admitTimer.current = window.setTimeout(() => {
            admitTimer.current = 0;
            setEpoch(n => n + 1);
          }, MOUNT_INTERVAL_MS);
        }
      }
      return (
        <CanvasItem
          element={element}
          manifest={manifest}
          current={proto}
          item={item}
          offscreen={offscreen}
          overview={overview}
          mounted={lastSeen.current.has(element.id)}
          playing={playingId(appState) === element.id}
        />
      );
    },
    [manifest, proto, epoch],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // A still canvas doesn't re-render, so what's visible is re-read on a timer.
  useEffect(() => {
    if (!api) return undefined;
    const timer = window.setInterval(() => {
      const seen = lastSeen.current;
      const state = api.getAppState();
      const embeds = api.getSceneElements().filter(el => el.type === 'embeddable');
      const visible = new Set<string>();
      const now = Date.now();
      for (const el of embeds) {
        const { offscreen, overview } = renderFlags(el, state);
        if (!offscreen && !overview) {
          visible.add(el.id);
          if (seen.has(el.id)) seen.set(el.id, now);
        }
      }
      const evict = pickEvictions({ lastSeen: seen, visible, onCanvas: new Set(embeds.map(el => el.id)), now });
      if (!evict.length) return;
      evict.forEach(id => seen.delete(id));
      setEpoch(n => n + 1);
    }, SWEEP_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(admitTimer.current);
      admitTimer.current = 0;
    };
  }, [api]);

  return (
    <div
      ref={container}
      className='canvas relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/30'
      data-items-only={itemsOnly ? '' : undefined}
      data-controls-hidden={controlsHidden ? '' : undefined}
      data-canvas-opening={revealed ? 'ready' : 'loading'}
      aria-busy={!revealed || undefined}
    >
      {!revealed && <CanvasOpeningSurface visible={openingStatus} />}
      <div
        inert={!revealed || undefined}
        aria-hidden={!revealed || undefined}
        className='canvas-scene absolute inset-0'
        style={{ opacity: revealed ? 1 : 0 }}
      >
        {initialData && (
          <Excalidraw
            initialData={initialData}
            onExcalidrawAPI={setApi}
            onChange={onChange}
            validateEmbeddable={validateEmbed}
            renderEmbeddable={renderEmbeddable}
            onScrollChange={onScrollChange}
            UIOptions={UI_OPTIONS}
            viewModeEnabled={!editable}
            theme={dark ? 'dark' : 'light'}
          >
            <CanvasMenu
              api={api}
              controlsHidden={controlsHidden}
              onToggleControls={toggleControls}
              editable={editable}
            />
          </Excalidraw>
        )}
        {editable && (
          <div
            role='status'
            className='absolute right-3 bottom-3 z-10 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground'
          >
            {saveState === 'saved'
              ? 'Saved'
              : saveState === 'saving'
                ? 'Saving…'
                : saveState === 'failed'
                  ? "Couldn't save"
                  : 'Unsaved changes'}
            {saveState === 'failed' && (
              <Button size='sm' variant='outline' onClick={retry}>
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
      {empty && revealed && hintReady && (
        <div className='pointer-events-none absolute inset-0 flex items-center justify-center p-8 duration-300 animate-in fade-in'>
          <div className='max-w-sm rounded-xl border border-dashed border-border bg-background/80 px-8 py-8 text-center'>
            <p className='text-sm font-medium text-foreground'>This canvas is empty</p>
            <p className='mt-1.5 text-sm text-muted-foreground'>
              {editable
                ? 'Drag a view or document from the navigation onto this canvas, press N for a sticky note, or ask your agent to lay it out for you.'
                : 'Nothing has been put on it yet.'}
            </p>
          </div>
        </div>
      )}
      <ControlTooltip container={container} />
      <Dialog
        open={blocker.status === 'blocked'}
        onOpenChange={open => {
          if (!open) blocker.reset?.();
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>This canvas has unsaved changes</DialogTitle>
            <DialogDescription>
              Saving hasn't finished. Keep the canvas open to retry, or discard the unsaved changes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => blocker.reset?.()}>
              Keep editing
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                discard();
                blocker.proceed?.();
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
