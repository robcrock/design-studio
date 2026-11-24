// Camera math for the zoomable diagram page, kept free of the DOM so gestures share one model.
// Scale 1 is the diagram fitted to the viewport; larger scales enlarge that same SVG.
export const MIN_SCALE = 1;
export const MAX_SCALE = 8;

export type View = { scale: number; x: number; y: number };
export type Point = { x: number; y: number };
export type Size = { width: number; height: number };

export const FITTED: View = { scale: MIN_SCALE, x: 0, y: 0 };

// One wheel event zooms at most this much, so a fast mouse wheel steps instead of jumping.
const WHEEL_STEP_LIMIT = 1.4;
const WHEEL_ZOOM_RATE = 0.01;
const LINE_HEIGHT = 16;

export function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

// Keeps the scaled diagram covering the viewport, so panning never reveals empty space.
export function clampView(view: View, size: Size): View {
  const scale = clampScale(view.scale);
  return {
    scale,
    x: Math.min(0, Math.max(size.width * (1 - scale), view.x)),
    y: Math.min(0, Math.max(size.height * (1 - scale), view.y)),
  };
}

// Zooms by `factor` while keeping the diagram point under `origin` in place.
export function zoomView(view: View, origin: Point, factor: number, size: Size): View {
  const scale = clampScale(view.scale * factor);
  if (scale === view.scale) return view;
  const ratio = scale / view.scale;
  return clampView(
    { scale, x: origin.x - (origin.x - view.x) * ratio, y: origin.y - (origin.y - view.y) * ratio },
    size,
  );
}

export function panView(view: View, dx: number, dy: number, size: Size): View {
  return clampView({ ...view, x: view.x + dx, y: view.y + dy }, size);
}

// Two fingers moving from `before` to `after`: zoom by their spread around the old midpoint,
// then follow the midpoint, so the content under the fingers stays under them.
export function pinchView(view: View, before: [Point, Point], after: [Point, Point], size: Size): View {
  const spread = (pair: [Point, Point]) => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
  const middle = (pair: [Point, Point]) => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
  const from = spread(before);
  const factor = from > 0 ? spread(after) / from : 1;
  const start = middle(before);
  const end = middle(after);
  return panView(zoomView(view, start, factor, size), end.x - start.x, end.y - start.y, size);
}

export type WheelInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;
export type WheelIntent = { kind: 'zoom'; factor: number } | { kind: 'pan'; dx: number; dy: number };

// Matches the canvas: a trackpad pinch arrives as Ctrl + wheel, so Ctrl/Cmd + wheel zooms and
// every other wheel, including two-finger scroll, pans. Shift turns a vertical wheel sideways.
export function wheelIntent(event: WheelInput): WheelIntent {
  const unit = event.deltaMode === 1 ? LINE_HEIGHT : 1;
  if (event.ctrlKey || event.metaKey) {
    const raw = Math.exp(-event.deltaY * unit * WHEEL_ZOOM_RATE);
    return { kind: 'zoom', factor: Math.min(WHEEL_STEP_LIMIT, Math.max(1 / WHEEL_STEP_LIMIT, raw)) };
  }
  const sideways = event.shiftKey && !event.deltaX;
  // Subtracting from 0 keeps an axis that did not move at 0 rather than -0.
  return {
    kind: 'pan',
    dx: 0 - (sideways ? event.deltaY : event.deltaX) * unit,
    dy: 0 - (sideways ? 0 : event.deltaY) * unit,
  };
}

export function transformOf(view: View) {
  return `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
}
