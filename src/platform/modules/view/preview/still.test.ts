import assert from 'node:assert/strict';
import test from 'node:test';
import { installStillness } from './still.ts';

const tick = (ms = 5) => new Promise(done => setTimeout(done, ms));

function fakeWindow() {
  const animation = {
    playState: 'running',
    pause() {
      this.playState = 'paused';
    },
    play() {
      this.playState = 'running';
    },
  };
  const win = {
    requestAnimationFrame: (callback: (time: number) => void) => setTimeout(() => callback(0), 1),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    performance,
    document: { getAnimations: () => [animation], querySelectorAll: () => [] },
  };
  return { win: win as unknown as Window & typeof globalThis, animation };
}

test('held motion waits, then runs on release', async () => {
  const { win, animation } = fakeWindow();
  const still = installStillness(win);
  const ran: string[] = [];
  still.hold();
  assert.equal(animation.playState, 'paused');
  win.setTimeout(() => ran.push('timeout'), 0);
  win.requestAnimationFrame(() => ran.push('frame'));
  const cleared = win.setTimeout(() => ran.push('cleared'), 0);
  await tick(2);
  win.clearTimeout(cleared);
  const interval = win.setInterval(() => ran.push('interval'), 1);
  try {
    await tick();
    assert.equal(ran.length, 0);
    still.release();
    assert.equal(animation.playState, 'running');
    assert.deepEqual(ran, ['timeout']); // frames wait for the next real frame
    await tick();
    assert.ok(ran.includes('interval'));
    assert.ok(!ran.includes('cleared'));
  } finally {
    win.clearInterval(interval);
  }
});
