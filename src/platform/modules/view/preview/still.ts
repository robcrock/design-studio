// Holds an embedded preview's motion so it stays on screen as a still picture (README.md#still-embeds).
// While held, animation-frame and timeout callbacks wait, intervals skip their ticks, and running
// animations and media pause. Releasing runs what waited and resumes what was paused. Each preview
// is its own document, so this changes only that document's window.
export type Stillness = { hold(): void; release(): void };

export function installStillness(win: Window & typeof globalThis): Stillness {
  let held = false;
  // Callbacks that came due while held. Frame ids and timer ids are separate number spaces.
  const frames = new Map<number, FrameRequestCallback>();
  const timeouts = new Map<unknown, () => void>();
  let paused: { animations: Animation[]; media: HTMLMediaElement[] } = {
    animations: [],
    media: [],
  };
  const native = {
    requestAnimationFrame: win.requestAnimationFrame.bind(win),
    cancelAnimationFrame: win.cancelAnimationFrame.bind(win),
    setTimeout: win.setTimeout.bind(win),
    clearTimeout: win.clearTimeout.bind(win),
    setInterval: win.setInterval.bind(win),
  };
  win.requestAnimationFrame = callback => {
    const id: number = native.requestAnimationFrame(time => (held ? frames.set(id, callback) : callback(time)));
    return id;
  };
  win.cancelAnimationFrame = id => {
    frames.delete(id);
    native.cancelAnimationFrame(id);
  };
  win.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof handler !== 'function') return native.setTimeout(handler, delay, ...args);
    const id = native.setTimeout(() => (held ? timeouts.set(id, () => handler(...args)) : handler(...args)), delay);
    return id;
  }) as typeof win.setTimeout;
  win.clearTimeout = id => {
    if (id !== undefined) timeouts.delete(id);
    native.clearTimeout(id);
  };
  win.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
    if (typeof handler !== 'function') return native.setInterval(handler, delay, ...args);
    return native.setInterval(() => !held && handler(...args), delay);
  }) as typeof win.setInterval;

  return {
    hold() {
      if (held) return;
      held = true;
      paused = {
        animations: win.document.getAnimations().filter(animation => animation.playState === 'running'),
        media: [...win.document.querySelectorAll<HTMLMediaElement>('video, audio')].filter(media => !media.paused),
      };
      paused.animations.forEach(animation => animation.pause());
      paused.media.forEach(media => media.pause());
    },
    release() {
      if (!held) return;
      held = false;
      paused.animations.forEach(animation => animation.playState === 'paused' && animation.play());
      paused.media.forEach(media => void media.play().catch(() => {}));
      paused = { animations: [], media: [] };
      const due = [...timeouts.values()];
      const drawn = [...frames.values()];
      timeouts.clear();
      frames.clear();
      due.forEach(callback => callback());
      // Frame callbacks run in the next real frame, as they would have.
      if (drawn.length) native.requestAnimationFrame(time => drawn.forEach(callback => callback(time)));
    },
  };
}
