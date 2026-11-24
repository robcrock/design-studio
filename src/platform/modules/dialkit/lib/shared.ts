// What the library in a view's preview and the Studio app both use: whether DialKit is hidden, its shortcut, and
// the channel the app uses to ask an open preview for its live values (README.md). Same-origin documents share both.
const HIDDEN = 'studio:dialkit:hidden';
const CHANGED = 'studio:dialkit:visibility';
export const CHANNEL = 'studio:dialkit';

export type Target = { contributor: string; prototype: string; artifact: string };
export type Panels = { name: string; values: Record<string, unknown> }[];
export type ChannelMessage =
  | { kind: 'request'; id: string; target: Target }
  | { kind: 'values'; id: string; panels: Panels }
  | { kind: 'error'; message: string };

export function isHidden() {
  try {
    return localStorage.getItem(HIDDEN) === '1';
  } catch {
    return false;
  }
}

export function setHidden(hidden: boolean) {
  try {
    if (hidden) localStorage.setItem(HIDDEN, '1');
    else localStorage.removeItem(HIDDEN);
  } catch {
    // Without storage, the change still reaches this document.
  }
  window.dispatchEvent(new Event(CHANGED));
}

// Calls `listener` when DialKit is hidden or shown here or in another document (the app or a preview).
export function subscribeHidden(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === HIDDEN || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGED, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGED, listener);
  };
}

// ⌘⇧; on a Mac, Ctrl+Shift+; elsewhere: Studio's ⌘; (navigation) with Shift.
export const isToggleShortcut = (event: KeyboardEvent) =>
  (event.metaKey || event.ctrlKey) &&
  event.shiftKey &&
  !event.altKey &&
  !event.repeat &&
  (event.code === 'Semicolon' || event.key === ';' || event.key === ':');

export const toggleShortcutLabel = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘⇧;' : 'Ctrl+Shift+;');

export const sameTarget = (a: Target | null, b: Target | null) =>
  Boolean(a && b && a.contributor === b.contributor && a.prototype === b.prototype && a.artifact === b.artifact);
