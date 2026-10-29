import { FitToScreenIcon, ZoomInIcon, ZoomOutIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/platform/systems/studio/components/button';

// Scale 1 is the diagram fitted to the page. Larger scales enlarge that same SVG.
const MIN_SCALE = 1;
const MAX_SCALE = 8;
const BUTTON_STEP = 1.25;
const PAN_STEP = 48;

type View = { scale: number; x: number; y: number };

const fitted: View = { scale: MIN_SCALE, x: 0, y: 0 };

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function clampView(view: View, width: number, height: number): View {
  const scale = clampScale(view.scale);
  const minX = width * (1 - scale);
  const minY = height * (1 - scale);
  return {
    scale,
    x: Math.min(0, Math.max(minX, view.x)),
    y: Math.min(0, Math.max(minY, view.y)),
  };
}

function zoomView(current: View, originX: number, originY: number, factor: number, width: number, height: number) {
  const scale = clampScale(current.scale * factor);
  if (scale === current.scale) return current;
  const ratio = scale / current.scale;
  return clampView(
    {
      scale,
      x: originX - (originX - current.x) * ratio,
      y: originY - (originY - current.y) * ratio,
    },
    width,
    height,
  );
}

function transformOf(view: View) {
  return `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}

export function DiagramViewport({ svg, resetKey }: { svg: string; resetKey: string }) {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const percentNode = useRef<HTMLSpanElement>(null);
  const camera = useRef(fitted);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const [view, setView] = useState<View>(fitted);
  const [panning, setPanning] = useState(false);

  const paint = (next: View) => {
    camera.current = next;
    if (stage.current) stage.current.style.transform = transformOf(next);
    if (percentNode.current) percentNode.current.textContent = `${Math.round(next.scale * 100)}%`;
  };

  useEffect(() => {
    paint(fitted);
    setView(fitted);
  }, [resetKey]);

  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let settle = 0;
    const reclamp = () => {
      const next = clampView(camera.current, element.clientWidth, element.clientHeight);
      paint(next);
      setView(next);
    };
    const observer = new ResizeObserver(reclamp);
    observer.observe(element);
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const raw = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.03 : 0.0015));
      const factor = Math.min(1.4, Math.max(1 / 1.4, raw));
      paint(
        zoomView(camera.current, event.clientX - rect.left, event.clientY - rect.top, factor, rect.width, rect.height),
      );
      window.clearTimeout(settle);
      settle = window.setTimeout(() => setView(camera.current), 80);
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener('wheel', onWheel);
      window.clearTimeout(settle);
    };
  }, []);

  const zoomToward = (factor: number, clientX?: number, clientY?: number) => {
    const element = viewport.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const next = zoomView(
      camera.current,
      clientX === undefined ? rect.width / 2 : clientX - rect.left,
      clientY === undefined ? rect.height / 2 : clientY - rect.top,
      factor,
      rect.width,
      rect.height,
    );
    paint(next);
    setView(next);
  };

  const panBy = (dx: number, dy: number) => {
    const element = viewport.current;
    if (!element) return;
    const next = clampView(
      { ...camera.current, x: camera.current.x + dx, y: camera.current.y + dy },
      element.clientWidth,
      element.clientHeight,
    );
    paint(next);
  };

  const percent = Math.round(view.scale * 100);

  return (
    <div className='relative min-h-0 min-w-0 flex-1'>
      <div
        ref={viewport}
        tabIndex={0}
        role='group'
        aria-label={`Diagram, ${percent} percent. Scroll to zoom, drag to pan, or use the arrow keys.`}
        className={`absolute inset-0 touch-none outline-none focus-visible:[&_.diagram-focus]:ring-ring/50 ${panning ? 'cursor-grabbing' : 'cursor-grab'}`}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
          setPanning(true);
        }}
        onPointerMove={event => {
          const current = drag.current;
          if (!current || current.id !== event.pointerId) return;
          const dx = event.clientX - current.x;
          const dy = event.clientY - current.y;
          current.x = event.clientX;
          current.y = event.clientY;
          panBy(dx, dy);
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return;
          drag.current = null;
          setPanning(false);
          setView(camera.current);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPanning(false);
          setView(camera.current);
        }}
        onDoubleClick={event => zoomToward(BUTTON_STEP, event.clientX, event.clientY)}
        onKeyDown={event => {
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === '+' || event.key === '=') zoomToward(BUTTON_STEP);
          else if (event.key === '-' || event.key === '_') zoomToward(1 / BUTTON_STEP);
          else if (event.key === '0') {
            paint(fitted);
            setView(fitted);
          } else if (event.key === 'ArrowLeft') panBy(PAN_STEP, 0);
          else if (event.key === 'ArrowRight') panBy(-PAN_STEP, 0);
          else if (event.key === 'ArrowUp') panBy(0, PAN_STEP);
          else if (event.key === 'ArrowDown') panBy(0, -PAN_STEP);
          else return;
          event.preventDefault();
        }}
      >
        <div className='absolute inset-0 overflow-hidden'>
          <div
            ref={stage}
            className='h-full w-full [&_svg]:absolute [&_svg]:inset-0 [&_svg]:h-full! [&_svg]:w-full! [&_svg]:max-w-none!'
            style={{ transformOrigin: '0 0' }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <div
            aria-hidden
            className='diagram-focus pointer-events-none absolute inset-0 ring-3 ring-transparent ring-inset'
          />
        </div>
      </div>
      <div
        role='group'
        aria-label={`Diagram zoom, ${percent} percent`}
        className='absolute right-3 bottom-3 z-10 flex items-center gap-0.5 rounded-lg border border-border bg-card/95 p-1 shadow-sm'
      >
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Zoom out'
          disabled={view.scale <= MIN_SCALE}
          onClick={() => zoomToward(1 / BUTTON_STEP)}
        >
          <HugeiconsIcon icon={ZoomOutIcon} />
        </Button>
        <span ref={percentNode} className='min-w-12 text-center text-xs tabular-nums text-muted-foreground'>
          {percent}%
        </span>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Zoom in'
          disabled={view.scale >= MAX_SCALE}
          onClick={() => zoomToward(BUTTON_STEP)}
        >
          <HugeiconsIcon icon={ZoomInIcon} />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Fit diagram'
          disabled={view.scale <= MIN_SCALE}
          onClick={() => {
            paint(fitted);
            setView(fitted);
          }}
        >
          <HugeiconsIcon icon={FitToScreenIcon} />
        </Button>
      </div>
    </div>
  );
}
