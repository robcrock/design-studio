const key = 'studio:settings-transition';
const pending = () => {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') as { external?: boolean } | null;
  } catch {
    return null;
  }
};
// `external`: the change came from outside this tab (the CLI, an agent, another tab), so the
// first rendered page after the restart releases the surface instead of the settings page.
export function beginSettingsTransition({ external = false } = {}) {
  if (external && pending()) return;
  const style = getComputedStyle(document.querySelector('.studio-theme') ?? document.documentElement);
  sessionStorage.setItem(
    key,
    JSON.stringify({
      started: Date.now(),
      external,
      // A save in Settings belongs to that page, which alone finishes it; another page in this tab must not show it.
      // An outside change covers whichever page the tab is on, and its first render releases it.
      ...(external ? {} : { path: location.pathname }),
      appearance: {
        background: style.getPropertyValue('--background'),
        foreground: style.getPropertyValue('--foreground'),
        muted: style.getPropertyValue('--muted-foreground'),
        border: style.getPropertyValue('--border'),
      },
    }),
  );
  window.dispatchEvent(new Event('studio:settings-applying'));
}
export function finishSettingsTransition() {
  window.dispatchEvent(new Event('studio:settings-ready'));
}
export function finishExternalTransition() {
  if (pending()?.external) finishSettingsTransition();
}
