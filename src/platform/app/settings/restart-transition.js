// Injected before React and styles load. Preserve the same surface across a runtime restart.
(() => {
  const key = 'studio:settings-transition';
  let surface, timer;
  function show() {
    // Views in frames sit under their page's surface.
    if (window !== window.top) return;
    let pending;
    try {
      pending = JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch {
      return;
    }
    if (!pending) return;
    // A save's transition is finished only by the page that saved (Settings). A tab that has gone elsewhere would
    // otherwise keep the surface over every page until it expires. Outside changes carry no path.
    if (Date.now() - pending.started > 120000 || (pending.path && pending.path !== location.pathname)) {
      sessionStorage.removeItem(key);
      return;
    }
    if (surface) return;
    surface = document.createElement('div');
    surface.id = 'studio-settings-transition';
    surface.setAttribute('role', 'status');
    surface.setAttribute('aria-live', 'polite');
    surface.tabIndex = -1;
    surface.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:var(--restart-background,Canvas);color:var(--restart-foreground,CanvasText);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;transition:opacity 160ms ease';
    for (const [name, value] of Object.entries(pending.appearance || {}))
      surface.style.setProperty(`--restart-${name}`, value);
    const style = document.createElement('style');
    style.textContent =
      '#studio-settings-transition *{box-sizing:border-box} @keyframes studio-settings-spin{to{transform:rotate(360deg)}} @media(prefers-reduced-motion:reduce){#studio-settings-transition,#studio-settings-transition [data-spinner]{animation:none!important;transition:none!important}}';
    const content = document.createElement('div');
    content.style.cssText = 'width:min(100%,420px);text-align:center';
    const spinner = document.createElement('div');
    spinner.dataset.spinner = '';
    spinner.setAttribute('aria-hidden', 'true');
    spinner.style.cssText =
      'width:32px;height:32px;margin:0 auto 24px;border:2px solid var(--restart-border,GrayText);border-top-color:var(--restart-foreground,CanvasText);border-radius:50%;animation:studio-settings-spin 1s linear infinite';
    const title = document.createElement('h1');
    title.textContent = 'Applying changes';
    title.style.cssText =
      'font-family:inherit;font-size:24px;font-weight:600;line-height:1.3;letter-spacing:normal;margin:0 0 12px';
    const description = document.createElement('p');
    description.textContent = pending.external
      ? 'Studio settings changed. Preparing your updated studio.'
      : 'Your settings are saved. Preparing your updated studio.';
    description.style.cssText =
      'font-family:inherit;font-size:14px;font-weight:400;line-height:1.6;letter-spacing:normal;margin:0;color:var(--restart-muted,GrayText)';
    const retry = document.createElement('button');
    retry.textContent = 'Reload studio';
    retry.hidden = true;
    retry.style.cssText =
      'margin-top:24px;padding:8px 14px;border:1px solid var(--restart-border,GrayText);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer';
    retry.onclick = () => location.reload();
    content.append(spinner, title, description, retry);
    surface.append(style, content);
    document.body.append(surface);
    document.getElementById('root')?.setAttribute('inert', '');
    surface.focus();
    timer = setTimeout(() => {
      description.textContent = 'This is taking longer than expected. Reload to check your saved settings.';
      retry.hidden = false;
    }, 30000);
  }
  function finish() {
    clearTimeout(timer);
    sessionStorage.removeItem(key);
    document.getElementById('root')?.removeAttribute('inert');
    const previous = surface;
    surface = null;
    if (previous)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          previous.style.opacity = '0';
          setTimeout(() => previous.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160);
        }),
      );
  }
  window.addEventListener('studio:settings-applying', show);
  window.addEventListener('studio:settings-ready', finish);
  show();
})();
