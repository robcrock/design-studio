// The DialKit panel in a local Studio's view preview, loaded only there (index.tsx). It is built from DialKit's own
// parts (Folder, ControlRenderer, PresetManager), laid out the way DialKit lays out several groups, so it is always
// titled DialKit with one section per group, even when the view has only one. Each group's first row holds DialKit's
// versions menu, reset, and Save to code, which writes the values into the view's code through the same
// version-checked save as Studio's source editor, so a file changed meanwhile is never overwritten.
import 'dialkit/styles.css';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from 'react';
import { createRoot } from 'react-dom/client';
import { ControlRenderer, DialStore, Folder, PresetManager, type DialValue, type PanelConfig } from 'dialkit';
import {
  CHANNEL,
  isHidden,
  isToggleShortcut,
  sameTarget,
  setHidden,
  subscribeHidden,
  type ChannelMessage,
  type Panels,
  type Target,
} from './shared';

const HOST = 'data-studio-dialkit';

const target = (): Target | null => {
  try {
    return JSON.parse(document.documentElement.dataset.previewTarget ?? '');
  } catch {
    return null;
  }
};
const livePanels = (): Panels =>
  DialStore.getPanels('panel').map(panel => ({ name: panel.name, values: DialStore.getValues(panel.id) }));

// Studio's sliders icon (Hugeicons SlidersHorizontalIcon, MIT), the one DialKit's menu items use, for the collapsed
// panel button in place of DialKit's own filled icon, so the button matches the rest of Studio's outline set.
const SLIDERS = [
  'M3.99963 5.00055L9.99963 5.00031',
  'M12.9996 5.00031L19.9996 5.00031',
  'M15.9996 9.00031L15.9996 15.0003',
  'M9.99963 2.00031L9.99963 8.00031',
  'M11.9996 16.0003L11.9996 22.0003',
  'M15.9996 12.0001L19.9996 12.0003',
  'M3.99963 12.0005L12.9996 12.0003',
  'M11.9996 19.0003L19.9996 19.0003',
  'M3.99963 19.0005L8.99963 19.0003',
];
const slidersMask = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.5' stroke-linecap='round'>${SLIDERS.map(d => `<path d='${d}'/>`).join('')}</svg>`,
)}")`;

export function start() {
  if (document.querySelector(`[${HOST}]`)) return;
  const host = document.createElement('div');
  host.setAttribute(HOST, '');
  document.body.append(host);
  const style = document.createElement('style');
  style.textContent = `
    .dialkit-panel-header, .dialkit-panel-inner[data-collapsed='true'] { touch-action: none; user-select: none; }
    /* DialKit's inline-flex wrapper sits on a text baseline, leaving a gap below the panel; anchoring by the bottom would show it. */
    [data-studio-dialkit] .dialkit-panel-wrapper { vertical-align: top; }
    [data-studio-dialkit] .dialkit-panel-inner[data-collapsed='true'] .dialkit-panel-icon { visibility: hidden; }
    [data-studio-dialkit] .dialkit-panel-inner[data-collapsed='true']::after { content: ''; position: absolute; top: 12px; right: 12px; width: 16px; height: 16px; background: var(--dial-text-focus); -webkit-mask: ${slidersMask} center / contain no-repeat; mask: ${slidersMask} center / contain no-repeat; pointer-events: none; }
    /* Three levels: the DialKit title, each group's name a size smaller in the same dark colour, and folders inside a
       group a size smaller again in DialKit's grey for sections. DialKit styles several groups' names like its title. */
    [data-studio-dialkit] .dialkit-panel[data-multiple='true'] .dialkit-folder-root > .dialkit-folder-content > .dialkit-folder-inner > .dialkit-folder > .dialkit-folder-header .dialkit-folder-title { font-size: 13px; font-weight: 600; color: var(--dial-text-root); }
    [data-studio-dialkit] .dialkit-folder-root .dialkit-folder .dialkit-folder .dialkit-folder-title { font-size: 12px; font-weight: 600; color: var(--dial-text-section); }
    .studio-dialkit-start { padding: 12px 0 12px; font-size: 13px; line-height: 1.5; color: var(--dial-text-label); }
    .studio-dialkit-start h3 { margin: 0 0 12px; font-size: 14px; font-weight: 600; color: var(--dial-text-root); }
    .studio-dialkit-start ol { margin: 0; padding: 0; list-style: none; counter-reset: step; display: grid; gap: 10px; }
    .studio-dialkit-start li { counter-increment: step; display: grid; grid-template-columns: 20px 1fr; gap: 8px; }
    .studio-dialkit-start li::before { content: counter(step); display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; background: var(--dial-surface); color: var(--dial-text-primary); font-size: 11px; font-weight: 600; }
    .studio-dialkit-start q { display: block; margin-top: 6px; padding: 8px 10px; border-radius: var(--dial-radius); background: var(--dial-surface); color: var(--dial-text-primary); quotes: none; }
    /* A step with an icon in it: a row centred on the text, so the icon sits on the text's middle and the line keeps its height. */
    .studio-dialkit-start .studio-dialkit-inline { display: flex; align-items: center; gap: 4px; height: 20px; }
    .studio-dialkit-start code { display: grid; place-items: center; flex: none; width: 20px; height: 20px; border-radius: 4px; background: var(--dial-surface); color: var(--dial-text-primary); }
    .studio-dialkit-start code svg { width: 13px; height: 13px; }
    .studio-dialkit-empty { margin: 0; padding: 0 0 12px; font-size: 13px; line-height: 1.5; color: var(--dial-text-label); }
    .studio-dialkit-reset { color: var(--dial-text-label); }
    .studio-dialkit-reset:disabled { opacity: 0.4; cursor: default; background: var(--dial-surface); }
    /* Into "saved" quickly, so it answers the click; back to rest slowly, so it settles rather than snaps. */
    .studio-dialkit-save { position: relative; transition: background 0.5s ease-out, color 0.5s ease-out, opacity 0.3s; }
    .studio-dialkit-save:disabled:not([data-status='saved']) { opacity: 0.4; cursor: default; }
    .studio-dialkit-save[data-status='saved'] { transition-duration: 0.15s; background: rgb(22 163 74 / 0.14); color: rgb(21 128 61); }
    .studio-dialkit-save svg { position: absolute; transition: opacity 0.35s ease-out, transform 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2); }
    .studio-dialkit-save[data-status='saved'] svg { transition-duration: 0.15s, 0.25s; }
    .studio-dialkit-save:not([data-status='saved']) svg[data-icon='check'],
    .studio-dialkit-save[data-status='saved'] svg[data-icon='save'] { opacity: 0; transform: scale(0.6); }
    @media (prefers-reduced-motion: reduce) { .studio-dialkit-save, .studio-dialkit-save svg { transition: none !important; } }
    .dialkit-root[data-theme='dark'] .studio-dialkit-save[data-status='saved'] { background: rgb(74 222 128 / 0.16); color: rgb(134 239 172); }
  `;
  document.head.append(style);
  createRoot(host).render(<StudioDials />);
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = ({ data }: MessageEvent<ChannelMessage>) => {
    if (data?.kind === 'request' && sameTarget(data.target, target()))
      channel.postMessage({ kind: 'values', id: data.id, panels: livePanels() } satisfies ChannelMessage);
  };
  window.addEventListener('keydown', event => {
    if (!isToggleShortcut(event)) return;
    event.preventDefault();
    setHidden(!isHidden());
  });
}

// DialStore has no change counter, so the snapshot is each group's id and dial count.
const panelsKey = () =>
  DialStore.getPanels('panel')
    .map(panel => `${panel.id}:${panel.controls.length}`)
    .join('|');
const subscribeGlobal = (listener: () => void) => DialStore.subscribeGlobal(listener);

function StudioDials() {
  const hidden = useSyncExternalStore(subscribeHidden, isHidden);
  const dark = useDarkTheme();
  const drag = usePanelDrag();
  useSyncExternalStore(subscribeGlobal, panelsKey);
  const panels = DialStore.getPanels('panel');
  if (hidden || !panels.length) return null;
  const theme = dark ? 'dark' : 'light';
  return (
    <div className='dialkit-root' data-mode='popover' data-theme={theme}>
      <div
        ref={drag.ref}
        className='dialkit-panel'
        style={drag.style}
        onPointerDown={drag.onPointerDown}
        data-mode='popover'
        data-position={drag.position}
        data-origin-x={drag.originX}
        data-origin-y={drag.originY}
        data-multiple='true'
      >
        <div className='dialkit-panel-wrapper'>
          <Folder title='DialKit' isRoot defaultOpen>
            {/* Right after Add DialKit no group has dials yet: show how to start instead of empty groups. */}
            {panels.some(panel => panel.controls.length) ? (
              panels.map(panel => <Group key={panel.id} panel={panel} />)
            ) : (
              <GettingStarted />
            )}
          </Folder>
        </div>
      </div>
    </div>
  );
}

function Group({ panel }: { panel: PanelConfig }) {
  const subscribe = useCallback((listener: () => void) => DialStore.subscribe(panel.id, listener), [panel.id]);
  const values = useSyncExternalStore(
    subscribe,
    useCallback(() => DialStore.getValues(panel.id), [panel.id]),
  );
  const activePreset = useSyncExternalStore(
    subscribe,
    useCallback(() => DialStore.getActivePresetId(panel.id), [panel.id]),
  );
  return (
    <Folder title={panel.name} defaultOpen>
      {panel.controls.length ? (
        <>
          <div className='dialkit-panel-toolbar'>
            <PresetManager panelId={panel.id} presets={DialStore.getPresets(panel.id)} activePresetId={activePreset} />
            <ResetButton panel={panel} values={values} />
            <SaveButton panel={panel} values={values} />
          </div>
          <ControlRenderer panelId={panel.id} controls={panel.controls} values={values} />
        </>
      ) : (
        // Beside groups that have dials, one without any has nothing to tune, reset or save yet.
        <p className='studio-dialkit-empty'>No dials yet. Ask your agent to add some to this group.</p>
      )}
    </Folder>
  );
}

function GettingStarted() {
  return (
    <div className='studio-dialkit-start'>
      <h3>Ready to tune this view</h3>
      <ol>
        <li>
          <span>
            Ask your agent for dials.
            <q>Add dials for spacing and radius.</q>
          </span>
        </li>
        <li>
          <span>Drag to adjust.</span>
        </li>
        <li>
          <span className='studio-dialkit-inline'>
            Press
            <code aria-label='Save to code'>
              <StatusIcon paths={SAVE_PATHS} />
            </code>
            to save to code.
          </span>
        </li>
      </ol>
    </div>
  );
}

// Dragging as DialKit's own panel does: by the header when open, or the whole button when collapsed. A press only
// becomes a drag after it moves a few pixels, so a click still opens or collapses, and the click that ends a drag is
// swallowed. Where a drag ends, the panel anchors to the nearest corner of the window: it opens away from that corner
// and collapses back into it, so the button returns to where it was left. Fitting the panel inside the window only
// changes where it is drawn, never that remembered spot.
const EDGE = 16;
const DRAG_THRESHOLD = 8;
const HEADER = 42;
const NOT_A_HANDLE = '.dialkit-panel-icon, button, input, select, textarea, a, [role="slider"]';
type Spot = { h: 'left' | 'right'; v: 'top' | 'bottom'; x: number; y: number };
type Box = { left: number; top: number };

function usePanelDrag() {
  const element = useRef<HTMLDivElement | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);
  const [dragging, setDragging] = useState<Box | null>(null);
  const [size, setSize] = useState({ width: HEADER, height: HEADER });
  const [, setViewport] = useState(0);
  // The panel is drawn anew when it is hidden and shown, or a view without dials comes between, so measure whichever
  // panel element exists now, not the one there was when this hook first ran.
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((panel: HTMLDivElement | null) => {
    element.current = panel;
    observer.current?.disconnect();
    if (!panel) return;
    observer.current ??= new ResizeObserver(([entry]) => {
      const rect = entry.target.getBoundingClientRect();
      setSize(current => (current.width === rect.width && current.height === rect.height ? current : rect));
    });
    observer.current.observe(panel);
  }, []);
  useEffect(() => {
    const resize = () => setViewport(count => count + 1);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      observer.current?.disconnect();
    };
  }, []);
  // The whole panel stays in view; one taller than the window keeps to the top edge.
  const fit = ({ left, top }: Box, width = size.width, height = size.height): Box => ({
    left: Math.max(EDGE, Math.min(window.innerWidth - width - EDGE, left)),
    top: Math.max(EDGE, Math.min(window.innerHeight - Math.min(height, window.innerHeight - 2 * EDGE) - EDGE, top)),
  });
  const boxOf = (at: Spot): Box => ({
    left: at.h === 'left' ? at.x : window.innerWidth - at.x - size.width,
    top: at.v === 'top' ? at.y : window.innerHeight - at.y - size.height,
  });
  let style: CSSProperties | undefined;
  if (dragging) style = { ...fit(dragging), right: 'auto', bottom: 'auto' };
  else if (spot) {
    // Drawn from the anchored corner, so DialKit's open and close animations grow from and shrink into it.
    const box = fit(boxOf(spot));
    style = {
      left: spot.h === 'left' ? box.left : 'auto',
      right: spot.h === 'right' ? window.innerWidth - box.left - size.width : 'auto',
      top: spot.v === 'top' ? box.top : 'auto',
      bottom: spot.v === 'bottom' ? window.innerHeight - box.top - size.height : 'auto',
    };
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const handle =
      target.closest('.dialkit-panel-inner[data-collapsed="true"]') ??
      (target.closest(NOT_A_HANDLE) ? null : target.closest('.dialkit-panel-header'));
    if (event.button !== 0 || !handle || !element.current) return;
    const rect = element.current.getBoundingClientRect();
    const start = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
    let moved = false;
    let last: Box = start;
    const move = (next: globalThis.PointerEvent) => {
      const dx = next.clientX - start.x;
      const dy = next.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      moved = true;
      next.preventDefault();
      last = { left: start.left + dx, top: start.top + dy };
      setDragging(last);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      if (!moved) return;
      const { width, height } = rect;
      const box = fit(last, width, height);
      const h = box.left + width / 2 < window.innerWidth / 2 ? 'left' : 'right';
      const v = box.top + height / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
      setSpot({
        h,
        v,
        x: h === 'left' ? box.left : window.innerWidth - box.left - width,
        y: v === 'top' ? box.top : window.innerHeight - box.top - height,
      });
      setDragging(null);
      const swallow = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
      };
      handle.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => handle.removeEventListener('click', swallow, true), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  return {
    ref,
    onPointerDown,
    style,
    position: spot || dragging ? undefined : 'top-right',
    originX: spot?.h ?? 'right',
    originY: spot?.v ?? 'top',
  };
}

// Studio's theme reaches the preview as a class on its root element.
function useDarkTheme() {
  const read = () => document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(read);
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

type Status = 'idle' | 'saving' | 'saved';
// One write at a time, so two groups saved in quick succession never race for the same file version.
let writing = false;

async function request<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(url, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body && JSON.stringify(body),
  });
  const reply = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(reply.error ?? `Couldn’t save the dials to code (${response.status}).`);
  return reply as T;
}

// Saves one group to code: read the file, set that group's new defaults, write it if the file hasn't changed
// meanwhile. Resolves true when it saved; an error is shown as a toast.
async function saveToCode(panel: PanelConfig) {
  const view = target();
  if (!view || writing) return false;
  writing = true;
  try {
    const { contributor, prototype, artifact: path } = view;
    const query = new URLSearchParams({ contributor, prototype, path });
    const file = await request<{ content: string; version: string }>(`/__studio/file?${query}`);
    const { content } = await request<{ content: string }>('/__studio/dialkit/transform', {
      action: 'apply',
      source: file.content,
      panels: [{ name: panel.name, values: DialStore.getValues(panel.id) }],
    });
    if (content !== file.content)
      await request('/__studio/write', { contributor, prototype, path, content, base: file.version });
    return true;
  } catch (error) {
    // Studio shows it as a toast (app.tsx).
    const message = error instanceof Error ? error.message : 'Couldn’t save the dials to code.';
    new BroadcastChannel(CHANNEL).postMessage({ kind: 'error', message } satisfies ChannelMessage);
    return false;
  } finally {
    writing = false;
  }
}

// DialKit keeps each group's defaults from the code privately; its own resetValues restores them. Read them only to
// tell whether there is anything to reset: if a DialKit release moves them, the button simply stays enabled.
const codeDefaults = (id: string) =>
  (DialStore as unknown as { defaultValues?: Map<string, Record<string, DialValue>> }).defaultValues?.get(id);
const differsFromCode = (id: string, values: Record<string, DialValue>) => {
  const defaults = codeDefaults(id);
  return !defaults || Object.keys(defaults).some(key => JSON.stringify(defaults[key]) !== JSON.stringify(values[key]));
};

// Puts this group's dials back to the values in the code: where it started, or what was last saved.
function ResetButton({ panel, values }: { panel: PanelConfig; values: Record<string, DialValue> }) {
  const label = `Reset ${panel.name} to the code’s values`;
  return (
    <button
      type='button'
      className='dialkit-toolbar-add studio-dialkit-reset'
      title={label}
      aria-label={label}
      disabled={!differsFromCode(panel.id, values)}
      onClick={() => DialStore.resetValues(panel.id)}
    >
      {/* Studio's outline undo icon (Hugeicons Undo02Icon, MIT). */}
      <svg
        viewBox='0 0 24 24'
        width={16}
        height={16}
        fill='none'
        stroke='currentColor'
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
      >
        <path d='M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C8.66873 3 5.76018 4.80989 4.20404 7.5' />
        <path d='M3 3V4.27816C3 6.47004 3 7.56599 3.70725 8.16512C4.4145 8.76425 5.49553 8.58408 7.6576 8.22373L9 8' />
      </svg>
    </button>
  );
}

// Studio's outline save icon (Hugeicons SaveIcon, MIT), also shown in the getting-started steps.
const SAVE_PATHS = [
  'M15.8787 3H11C7.22876 3 5.34315 3 4.17157 4.17157C3 5.34315 3 7.22876 3 11V13C3 16.7712 3 18.6569 4.17157 19.8284C5.34315 21 7.22876 21 11 21H13C16.7712 21 18.6569 21 19.8284 19.8284C21 18.6569 21 16.7712 21 13V8.12132C21 7.66475 21 7.43646 20.9758 7.2174C20.8924 6.4633 20.5963 5.74846 20.122 5.15629C19.9843 4.98427 19.8228 4.82285 19.5 4.5C19.1772 4.17715 19.0157 4.01573 18.8437 3.87795C18.2515 3.40366 17.5367 3.10757 16.7826 3.02421C16.5635 3 16.3353 3 15.8787 3Z',
  'M17 3.5V4C17 5.88562 17 6.82843 16.4142 7.41421C15.8284 8 14.8856 8 13 8H11C9.11438 8 8.17157 8 7.58579 7.41421C7 6.82843 7 5.88562 7 4V3.5',
  'M17 20.5V17C17 15.1144 17 14.1716 16.4142 13.5858C15.8284 13 14.8856 13 13 13H11C9.11438 13 8.17157 13 7.58579 13.5858C7 14.1716 7 15.1144 7 17V20.5',
];

// DialKit's own toolbar button, where its Copy parameters would be: Save to code writes this group's values into
// the code. Like reset, it waits until the group differs from the code, and only the pressed one shows it worked.
function SaveButton({ panel, values }: { panel: PanelConfig; values: Record<string, DialValue> }) {
  const [current, setCurrent] = useState<Status>('idle');
  useEffect(() => {
    if (current !== 'saved') return;
    const timer = setTimeout(() => setCurrent('idle'), 1600);
    return () => clearTimeout(timer);
  }, [current]);
  const label = current === 'saved' ? `Saved ${panel.name} to code` : `Save ${panel.name} to code`;
  return (
    <button
      type='button'
      className='dialkit-toolbar-add studio-dialkit-save'
      data-status={current}
      title={label}
      aria-label={label}
      disabled={current === 'saving' || (current === 'idle' && !differsFromCode(panel.id, values))}
      onClick={async () => {
        setCurrent('saving');
        setCurrent((await saveToCode(panel)) ? 'saved' : 'idle');
      }}
    >
      {/* Both icons stay mounted so they can cross-fade. */}
      <StatusIcon kind='save' paths={SAVE_PATHS} />
      <StatusIcon kind='check' paths={['M20 6 9 17l-5-5']} />
    </button>
  );
}

function StatusIcon({ kind, paths }: { kind?: string; paths: string[] }) {
  return (
    <svg
      data-icon={kind}
      viewBox='0 0 24 24'
      width={16}
      height={16}
      fill='none'
      stroke='currentColor'
      strokeWidth={1.5}
      strokeLinecap='round'
      strokeLinejoin='round'
      aria-hidden='true'
    >
      {paths.map(d => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
