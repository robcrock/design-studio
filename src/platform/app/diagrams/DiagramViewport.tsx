import { FitToScreenIcon, MinusSignIcon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/platform/systems/studio/components/button';
import {
  FITTED,
  MAX_SCALE,
  MIN_SCALE,
  type Point,
  type View,
  clampView,
  panView,
  pinchView,
  transformOf,
  wheelIntent,
  zoomView,
} from './diagramCamera';

const BUTTON_STEP = 1.25;
const PAN_STEP = 48;
const HINT_MS = 1500;
// Continuous gestures paint directly; React state (percent, disabled buttons) catches up once they pause.
const SETTLE_MS = 80;
const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const ZOOM_HINT = `Pinch or hold ${MAC ? '⌘' : 'Ctrl'} and scroll to zoom`;

// Safari reports trackpad pinch as non-standard gesture events instead of Ctrl + wheel.
type GestureEventLike = Event & { scale: number; clientX: number; clientY: number };

export function DiagramViewport({ svg, resetKey }: { svg: string; resetKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const percentNode = useRef<HTMLSpanElement>(null);
  const camera = useRef(FITTED);
  // Active pointers by id, in client coordinates: one pans, two pinch.
  const pointers = useRef(new Map<number, Point>());
  const settleTimer = useRef(0);
  const [view, setView] = useState<View>(FITTED);
  const [panning, setPanning] = useState(false);
  const [hint, setHint] = useState(false);

  const paint = (next: View) => {
    camera.current = next;
    if (stage.current) stage.current.style.transform = transformOf(next);
    if (percentNode.current) percentNode.current.textContent = `${Math.round(next.scale * 100)}%`;
  };

  const commit = (next: View) => {
    paint(next);
    setView(next);
  };

  const settle = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setView(camera.current), SETTLE_MS);
  };

  const measure = () => {
    const element = viewport.current!;
    const rect = element.getBoundingClientRect();
    const size = { width: element.clientWidth, height: element.clientHeight };
    const local = (clientX: number, clientY: number): Point => ({ x: clientX - rect.left, y: clientY - rect.top });
    return { size, local };
  };

  useEffect(() => {
    commit(FITTED);
  }, [resetKey]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let hintTimer = 0;
    let hinted = false;
    let gestureScale = 1;
    let gesturing = false;

    const observer = new ResizeObserver(() => commit(clampView(camera.current, measure().size)));
    observer.observe(element);

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const intent = wheelIntent(event);
      const { size, local } = measure();
      if (intent.kind === 'zoom') {
        // Safari can send Ctrl + wheel alongside its gesture events; the gesture is the source of truth.
        if (gesturing) return;
        paint(zoomView(camera.current, local(event.clientX, event.clientY), intent.factor, size));
      } else {
        // A plain scroll on the fitted diagram has nothing to pan; once per visit, say how to zoom.
        if (camera.current.scale <= MIN_SCALE && !hinted) {
          hinted = true;
          setHint(true);
          hintTimer = window.setTimeout(() => setHint(false), HINT_MS);
        }
        paint(panView(camera.current, intent.dx, intent.dy, size));
      }
      settle();
    };

    const onGestureStart = (event: Event) => {
      event.preventDefault();
      // A touch pinch is already handled through pointer events.
      if (pointers.current.size > 1) return;
      gesturing = true;
      gestureScale = (event as GestureEventLike).scale;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      if (!gesturing) return;
      const gesture = event as GestureEventLike;
      const { size, local } = measure();
      paint(zoomView(camera.current, local(gesture.clientX, gesture.clientY), gesture.scale / gestureScale, size));
      gestureScale = gesture.scale;
      settle();
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      gesturing = false;
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('gesturestart', onGestureStart);
    element.addEventListener('gesturechange', onGestureChange);
    element.addEventListener('gestureend', onGestureEnd);
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('gesturestart', onGestureStart);
      element.removeEventListener('gesturechange', onGestureChange);
      element.removeEventListener('gestureend', onGestureEnd);
      window.clearTimeout(settleTimer.current);
      window.clearTimeout(hintTimer);
    };
  }, []);

  const zoomToward = (factor: number, clientX?: number, clientY?: number) => {
    if (!viewport.current) return;
    const { size, local } = measure();
    const origin =
      clientX === undefined || clientY === undefined
        ? { x: size.width / 2, y: size.height / 2 }
        : local(clientX, clientY);
    commit(zoomView(camera.current, origin, factor, size));
  };

  const panBy = (dx: number, dy: number) => {
    if (!viewport.current) return;
    paint(panView(camera.current, dx, dy, measure().size));
    settle();
  };

  const release = (pointerId: number) => {
    if (!pointers.current.delete(pointerId)) return;
    if (pointers.current.size > 0) return;
    setPanning(false);
    setView(camera.current);
  };

  const percent = Math.round(view.scale * 100);

  return (
    // -m-6 reaches past the figure's p-6, which stays so the renderer measures the fitted width.
    <div className='relative -m-6 min-h-0 min-w-0 flex-1'>
      <div
        ref={viewport}
        tabIndex={0}
        role='group'
        aria-label={`Diagram, ${percent} percent. Pinch to zoom, scroll or drag to pan, or use the arrow keys.`}
        className={`absolute inset-0 touch-none select-none outline-none focus-visible:[&_.diagram-focus]:ring-ring/50 ${view.scale <= MIN_SCALE ? '' : panning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={event => {
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
          setPanning(true);
        }}
        onPointerMove={event => {
          const active = pointers.current;
          const previous = active.get(event.pointerId);
          if (!previous) return;
          const next = { x: event.clientX, y: event.clientY };
          if (active.size === 1) {
            active.set(event.pointerId, next);
            panBy(next.x - previous.x, next.y - previous.y);
            return;
          }
          // The first two fingers pinch; any other finger leaves their pair, and the view, unchanged.
          const { size, local } = measure();
          const pair = (): [Point, Point] => {
            const [a, b] = [...active.values()];
            return [local(a.x, a.y), local(b.x, b.y)];
          };
          const before = pair();
          active.set(event.pointerId, next);
          paint(pinchView(camera.current, before, pair(), size));
          settle();
        }}
        onPointerUp={event => release(event.pointerId)}
        onPointerCancel={event => release(event.pointerId)}
        // A pointer lost without pointerup (app switch, interrupted touch) must not linger as a pinch finger.
        onLostPointerCapture={event => release(event.pointerId)}
        onDoubleClick={event => zoomToward(BUTTON_STEP, event.clientX, event.clientY)}
        onKeyDown={event => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === '+' || event.key === '=') zoomToward(BUTTON_STEP);
          else if (event.key === '-' || event.key === '_') zoomToward(1 / BUTTON_STEP);
          else if (event.key === '0') commit(FITTED);
          else if (event.key === 'ArrowLeft') panBy(PAN_STEP, 0);
          else if (event.key === 'ArrowRight') panBy(-PAN_STEP, 0);
          else if (event.key === 'ArrowUp') panBy(0, PAN_STEP);
          else if (event.key === 'ArrowDown') panBy(0, -PAN_STEP);
          else return;
          event.preventDefault();
        }}
      >
        <div className='absolute inset-0 overflow-hidden'>
          {/* The fitted margin lives inside the stage, so a zoomed diagram reaches the page edges. */}
          <div ref={stage} className='h-full w-full p-6' style={{ transformOrigin: '0 0' }}>
            <div
              className='relative h-full w-full [&_svg]:absolute [&_svg]:inset-0 [&_svg]:h-full! [&_svg]:w-full! [&_svg]:max-w-none!'
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
          <div
            aria-hidden
            className='diagram-focus pointer-events-none absolute inset-0 ring-3 ring-transparent ring-inset'
          />
        </div>
      </div>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center transition-opacity duration-300 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        <span className='rounded-full bg-foreground/85 px-3.5 py-2 text-sm text-background shadow-sm'>{ZOOM_HINT}</span>
      </div>
      {/* Mirrors the canvas zoom group (Excalidraw, restyled in canvas.css): a segmented
          island with 10px glyphs at a 1.25px stroke, plus Fit diagram. */}
      <div
        role='group'
        aria-label={`Diagram zoom, ${percent} percent`}
        className='absolute bottom-4 left-4 z-10 flex h-10 items-center rounded-[10px] border border-border bg-card p-[3px] shadow-[0_1px_2px_rgb(0_0_0/0.05),0_1px_3px_rgb(0_0_0/0.06)]'
      >
        <Button
          variant='ghost'
          size='icon'
          className='w-10 rounded-r-none'
          aria-label='Zoom out'
          title='Zoom out (−)'
          disabled={view.scale <= MIN_SCALE}
          onClick={() => zoomToward(1 / BUTTON_STEP)}
        >
          <HugeiconsIcon icon={MinusSignIcon} className='size-[15px]' strokeWidth={2} />
        </Button>
        <span ref={percentNode} className='w-[60px] text-center text-sm font-medium tabular-nums'>
          {percent}%
        </span>
        <Button
          variant='ghost'
          size='icon'
          className='w-10 rounded-none'
          aria-label='Zoom in'
          title='Zoom in (+)'
          disabled={view.scale >= MAX_SCALE}
          onClick={() => zoomToward(BUTTON_STEP)}
        >
          <HugeiconsIcon icon={PlusSignIcon} className='size-[15px]' strokeWidth={2} />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='w-10 rounded-l-none'
          aria-label='Fit diagram'
          title='Fit diagram (0)'
          disabled={view.scale <= MIN_SCALE}
          onClick={() => commit(FITTED)}
        >
          <HugeiconsIcon icon={FitToScreenIcon} size={16} strokeWidth={1.875} />
        </Button>
      </div>
    </div>
  );
}
