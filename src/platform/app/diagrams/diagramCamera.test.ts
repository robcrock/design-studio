import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FITTED, MAX_SCALE, clampView, panView, pinchView, wheelIntent, zoomView } from './diagramCamera.ts';

const size = { width: 1000, height: 500 };
const wheel = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, shiftKey: false };

test('zoom keeps the point under the pointer fixed and stays within limits', () => {
  const zoomed = zoomView(FITTED, { x: 250, y: 100 }, 2, size);
  assert.deepEqual(zoomed, { scale: 2, x: -250, y: -100 });
  assert.equal(zoomView(FITTED, { x: 0, y: 0 }, 0.5, size), FITTED);
  assert.equal(zoomView(FITTED, { x: 0, y: 0 }, 100, size).scale, MAX_SCALE);
});

test('panning never uncovers the viewport and does nothing when fitted', () => {
  assert.deepEqual(panView(FITTED, 40, -40, size), FITTED);
  const zoomed = { scale: 2, x: -500, y: -250 };
  assert.deepEqual(panView(zoomed, 10_000, 10_000, size), { scale: 2, x: 0, y: 0 });
  assert.deepEqual(panView(zoomed, -10_000, -10_000, size), { scale: 2, x: -1000, y: -500 });
  assert.deepEqual(clampView({ scale: 0.5, x: 30, y: 30 }, size), FITTED);
});

test('pinch zooms by finger spread and follows the midpoint', () => {
  const spread = pinchView(
    FITTED,
    [
      { x: 400, y: 200 },
      { x: 600, y: 200 },
    ],
    [
      { x: 300, y: 200 },
      { x: 700, y: 200 },
    ],
    size,
  );
  assert.deepEqual(spread, { scale: 2, x: -500, y: -200 });
  const slide = pinchView(
    spread,
    [
      { x: 300, y: 200 },
      { x: 700, y: 200 },
    ],
    [
      { x: 350, y: 220 },
      { x: 750, y: 220 },
    ],
    size,
  );
  assert.deepEqual(slide, { scale: 2, x: -450, y: -180 });
});

test('wheel follows the canvas: Ctrl or Cmd zooms, everything else pans', () => {
  const pinchOut = wheelIntent({ ...wheel, deltaY: -10, ctrlKey: true });
  assert.equal(pinchOut.kind, 'zoom');
  assert.ok(pinchOut.kind === 'zoom' && pinchOut.factor > 1);
  const fastWheel = wheelIntent({ ...wheel, deltaY: 500, metaKey: true });
  assert.ok(fastWheel.kind === 'zoom' && fastWheel.factor === 1 / 1.4);
  assert.deepEqual(wheelIntent({ ...wheel, deltaX: 5, deltaY: 30 }), { kind: 'pan', dx: -5, dy: -30 });
  assert.deepEqual(wheelIntent({ ...wheel, deltaY: 3, deltaMode: 1 }), { kind: 'pan', dx: 0, dy: -48 });
  assert.deepEqual(wheelIntent({ ...wheel, deltaY: 30, shiftKey: true }), { kind: 'pan', dx: -30, dy: 0 });
});
