// Renders a downloaded prototype in its own standalone HTML document: the left prototype
// navigation (title, assigned system, filterable artifact tree without local editing or the
// kebab menu) beside whichever view, document, diagram, or canvas is open.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
} from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
  Outlet,
  useRouter,
} from '@tanstack/react-router';
import { ErrorBoundary } from 'react-error-boundary';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  Cancel01Icon,
  CanvasIcon,
  CodeIcon,
  File01Icon,
  Flowchart01Icon,
  Search01Icon,
  SquareArrowExpand01Icon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
} from '@hugeicons/core-free-icons';
import { ThemeScope } from '#studio/systems';
import { cn, PortalContext } from '#studio/runtime';
import { SectionNav, NavHeader } from '@/platform/app/shell/nav';
import { navIndent, navRow, navRowState } from '@/platform/app/shell/nav/navRow';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/platform/systems/studio/components/collapsible';
import { Input } from '@/platform/systems/studio/components/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/platform/systems/studio/components/tooltip';
import { PrototypeNavigationProvider } from '@/platform/modules/prototypes/lib';
import { artifactSlug } from '@/platform/core/fileTypes';
import { parsePrototypeAddress } from '@/platform/core/resourceIdentity';
import { artifactReference } from '@/platform/app/artifacts/artifactReference';
import { EMBED_HEADER_HEIGHT } from '@/platform/app/artifacts/EmbedFrame';
import ViewError from '@/platform/app/files/FileError';
import EmptyView from '@/platform/modules/view/EmptyView';
import { emptyView } from '@/platform/modules/view/lib/index';
import '@/platform/modules/view/lofi.css';

export type DownloadedArtifact = {
  path: string;
  fileType: 'view' | 'document' | 'diagrams' | 'canvas' | string;
  studioId?: string;
  lofi?: boolean;
  View?: ComponentType;
  Document?: ComponentType<{ components?: Record<string, unknown> }>;
  frontmatter?: { title?: string; description?: string; toc?: boolean };
  source?: string;
};

export type DownloadedPrototypeProps = {
  title: string;
  studioId?: string;
  systemLabel: string | null;
  themeClass: string;
  artifacts: DownloadedArtifact[];
  renderDocument?: (props: { artifact: DownloadedArtifact; Component: ComponentType }) => ReactNode;
  renderDiagram?: (props: { source: string; compact?: boolean }) => ReactNode;
  renderCanvas?: (props: {
    text: string;
    dark: boolean;
    resolveLink: (link: string | null) => DownloadedArtifact | undefined;
    selectArtifact: (artifact: DownloadedArtifact) => void;
    renderEmbed: (target: DownloadedArtifact, width: number, height: number) => ReactNode;
  }) => ReactNode;
};

type TreeNode = {
  name: string;
  path: string;
  dir: boolean;
  children?: TreeNode[];
  artifact?: DownloadedArtifact;
};

const TYPE_ICONS: Record<string, typeof CodeIcon> = {
  view: CodeIcon,
  document: File01Icon,
  diagrams: Flowchart01Icon,
  canvas: CanvasIcon,
};

export function artifactDisplayLabel(path: string): string {
  const name = artifactSlug(path).split('/').pop()!;
  return name
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/\bLo ?fi\b/gi, 'Lo-fi')
    .replace(/\bHi ?fi\b/gi, 'Hi-fi');
}

function buildTree(artifacts: DownloadedArtifact[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const artifact of artifacts) {
    const parts = artifact.path.split('/');
    let level = root;
    parts.slice(0, -1).forEach((name, index) => {
      const folderPath = parts.slice(0, index + 1).join('/');
      let folder = level.find(node => node.dir && node.path === folderPath);
      if (!folder) {
        folder = { name, path: folderPath, dir: true, children: [] };
        level.push(folder);
      }
      level = folder.children!;
    });
    level.push({ name: parts.at(-1)!, path: artifact.path, dir: false, artifact });
  }
  return root;
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes.flatMap(node => {
    const label = artifactDisplayLabel(node.path).toLowerCase();
    if (node.path.toLowerCase().includes(query) || label.includes(query)) return [node];
    if (!node.dir) return [];
    const children = filterTree(node.children ?? [], query);
    return children.length ? [{ ...node, children }] : [];
  });
}

const allDirs = (nodes: TreeNode[]): string[] =>
  nodes.flatMap(node => (node.dir ? [node.path, ...allDirs(node.children ?? [])] : []));

export function resolveArtifactTarget(
  artifacts: DownloadedArtifact[],
  studioId: string | undefined,
  reference: string,
  base = '/prototype',
): DownloadedArtifact | undefined {
  const raw = reference.trim();
  if (!raw) return undefined;
  const parsed = parsePrototypeAddress(raw.split(/[?#]/)[0]);
  if (parsed?.artifactId && (!studioId || parsed.prototypeId === studioId)) {
    return artifacts.find(item => item.studioId === parsed.artifactId);
  }
  try {
    const url = new URL(raw, 'http://studio.local');
    const addr = parsePrototypeAddress(url.pathname);
    if (addr?.artifactId && (!studioId || addr.prototypeId === studioId)) {
      return artifacts.find(item => item.studioId === addr.artifactId);
    }
  } catch {
    /* relative reference */
  }
  const clean = raw.split(/[?#]/)[0].replace(/^\.\//, '');
  const direct = artifacts.find(item => item.path === clean || artifactSlug(item.path) === clean);
  if (direct) return direct;
  const rel = artifactReference(raw, base);
  if (rel) {
    return artifacts.find(item => item.path === rel.path || artifactSlug(item.path) === rel.path);
  }
  return undefined;
}

const EMBED_VIEWPORT_WIDTH = 1440;

function ViewSurface({
  artifact,
  studioId,
  artifacts,
  themeClass,
  embed,
  width,
  height,
}: {
  artifact: DownloadedArtifact;
  studioId?: string;
  artifacts: DownloadedArtifact[];
  themeClass: string;
  embed?: boolean;
  width?: number;
  height?: number;
}) {
  const [portal, setPortal] = useState<HTMLDivElement | null>(null);
  const Component = artifact.View;
  const navScope = useMemo(
    () => ({
      studioId: studioId ?? '0000000000000000',
      currentArtifactId: artifact.studioId,
      artifacts,
    }),
    [studioId, artifact.studioId, artifacts],
  );
  if (!Component || Component === emptyView) {
    return <EmptyView path={null} />;
  }
  const content = (
    <ErrorBoundary
      resetKeys={[artifact.path, Component]}
      fallbackRender={props =>
        embed ? (
          <p role='alert' className='p-4 text-sm'>
            This view has an error. Open it to see what is wrong.
          </p>
        ) : (
          <ViewError {...props} />
        )
      }
    >
      <ThemeScope
        themeClass={themeClass}
        className={
          (artifact.lofi ? 'lofi-view ' : '') +
          'bg-background text-foreground relative flex min-h-0 flex-1 flex-col [contain:layout]'
        }
      >
        <div className={embed ? 'min-h-0 flex-1 overflow-hidden' : 'min-h-0 flex-1 overflow-auto'}>
          <PortalContext.Provider value={portal}>
            <PrototypeNavigationProvider value={navScope}>
              <Component />
            </PrototypeNavigationProvider>
          </PortalContext.Provider>
        </div>
        <div ref={setPortal} />
      </ThemeScope>
    </ErrorBoundary>
  );
  if (!embed || !width || !height) return content;
  const scale = width / EMBED_VIEWPORT_WIDTH;
  return (
    <div aria-hidden inert className='relative overflow-hidden bg-background' style={{ width, height }}>
      <div
        className='absolute top-0 left-0 flex origin-top-left'
        style={{ width: EMBED_VIEWPORT_WIDTH, height: height / scale, transform: `scale(${scale})` }}
      >
        {content}
      </div>
    </div>
  );
}

export function DownloadedEmbedFrame({
  target,
  label,
  onOpen,
  children,
}: {
  target: DownloadedArtifact;
  label?: string;
  onOpen: (target: DownloadedArtifact) => void;
  children: ReactNode;
}) {
  const title = label ?? artifactDisplayLabel(target.path);
  return (
    <div
      data-canvas-frame=''
      style={{ borderRadius: 'var(--radius, 0.5rem)' }}
      className='relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background'
    >
      <button
        type='button'
        data-open
        aria-label={`Open ${title}`}
        onClick={() => onOpen(target)}
        style={{ height: EMBED_HEADER_HEIGHT }}
        className='group/open flex w-full shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 text-left text-xs text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
      >
        <span className='truncate font-semibold' title={title}>
          {title}
        </span>
        <span className='inline-flex shrink-0 items-center gap-1.5 font-medium'>
          <span className='opacity-0 transition-opacity group-hover/open:text-primary group-hover/open:opacity-100 group-focus-visible/open:text-primary group-focus-visible/open:opacity-100'>
            Open
          </span>
          <HugeiconsIcon
            icon={SquareArrowExpand01Icon}
            size={16}
            className='text-muted-foreground transition-colors group-hover/open:text-primary group-focus-visible/open:text-primary'
          />
        </span>
      </button>
      {children}
    </div>
  );
}

const iconButton =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-accent-foreground';

const ShareShellContext = createContext<DownloadedPrototypeProps | null>(null);

function FallbackMermaid({ source }: { source: string }) {
  return <pre className='overflow-x-auto rounded-md border border-border bg-muted/50 p-4 text-xs'>{source}</pre>;
}

function ShareShell() {
  const props = useContext(ShareShellContext)!;
  const router = useRouter();
  const { title, studioId, systemLabel, themeClass, artifacts, renderDocument, renderDiagram, renderCanvas } = props;
  const [current, setCurrent] = useState<DownloadedArtifact>(() => artifacts[0]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const filterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.title = `${title} — ${artifactDisplayLabel(current.path)}`;
  }, [title, current.path]);

  useEffect(() => {
    if (filterOpen) filterRef.current?.focus();
  }, [filterOpen]);

  // Follow @module/prototypes Link and useNavigate calls inside views, as well as plain anchor links.
  useEffect(() => {
    const unsubscribe = router.history.subscribe(() => {
      const target = resolveArtifactTarget(artifacts, studioId, router.history.location.href);
      if (target) setCurrent(target);
    });
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        !anchor ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      )
        return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || /^https?:/i.test(href)) return;
      const target = resolveArtifactTarget(artifacts, studioId, href);
      if (target) {
        event.preventDefault();
        setCurrent(target);
      }
    };
    document.addEventListener('click', onClick);
    return () => {
      unsubscribe();
      document.removeEventListener('click', onClick);
    };
  }, [router, artifacts, studioId]);

  const tree = useMemo(() => buildTree(artifacts), [artifacts]);
  const dirs = useMemo(() => allDirs(tree), [tree]);
  const query = filter.trim().toLowerCase();
  const shown = useMemo(() => (query ? filterTree(tree, query) : tree), [tree, query]);
  const allOpen = dirs.every(dir => !closed.has(dir));
  const isOpen = (dir: string) => Boolean(query) || !closed.has(dir);
  const setOpen = (dir: string, open: boolean) =>
    setClosed(previous => {
      const next = new Set(previous);
      if (open) next.delete(dir);
      else next.add(dir);
      return next;
    });

  const renderEmbed = useCallback(
    (target: DownloadedArtifact, width: number, height: number): ReactNode => {
      if (target.fileType === 'view') {
        return (
          <ViewSurface
            artifact={target}
            studioId={studioId}
            artifacts={artifacts}
            themeClass={themeClass}
            embed
            width={width}
            height={height}
          />
        );
      }
      if (target.fileType === 'diagrams' && target.source !== undefined && renderDiagram) {
        return (
          <div style={{ width, height }} className='overflow-hidden'>
            {renderDiagram({ source: target.source, compact: true })}
          </div>
        );
      }
      return (
        <div className='flex h-full items-center justify-between px-4 py-3 text-xs text-muted-foreground'>
          <span>{artifactDisplayLabel(target.path)}</span>
        </div>
      );
    },
    [studioId, artifacts, themeClass, renderDiagram],
  );

  const folder = current.path.includes('/') ? current.path.slice(0, current.path.lastIndexOf('/')) : '';
  const docBase = `/prototypes/local/share${folder ? '/' + folder : ''}`;

  const BoundDocumentComponent = useMemo(() => {
    const RawDoc = current.Document;
    if (!RawDoc) return null;
    const MermaidInDoc = ({ source }: { source: string }) =>
      renderDiagram ? <>{renderDiagram({ source })}</> : <FallbackMermaid source={source} />;
    const components = createDownloadedMarkdownComponents({
      base: docBase,
      resolveEmbed: (reference, base) => resolveArtifactTarget(artifacts, studioId, reference, base),
      selectArtifact: setCurrent,
      renderEmbed,
      MermaidComponent: MermaidInDoc,
    });
    return function BoundMarkdown() {
      return <RawDoc components={components} />;
    };
  }, [current.Document, docBase, artifacts, studioId, renderEmbed, renderDiagram]);

  function renderRows(nodes: TreeNode[], depth: number): ReactNode {
    return nodes.map(node => {
      if (node.dir) {
        const open = isOpen(node.path);
        const label = artifactDisplayLabel(node.name);
        return (
          <Collapsible
            key={node.path}
            open={open}
            onOpenChange={next => setOpen(node.path, next)}
            className='mt-1.5 first:mt-0'
          >
            <div className='flex flex-col gap-0.5 rounded-md'>
              <CollapsibleTrigger
                style={navIndent(depth)}
                className={cn(navRow, 'text-left font-medium text-sidebar-foreground hover:bg-sidebar-foreground/5')}
              >
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  size={14}
                  className={cn('shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
                />
                <span className='min-w-0 flex-1 truncate' title={label}>
                  {label}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className='flex flex-col gap-0.5'>
                {renderRows(node.children ?? [], depth + 1)}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      }
      const item = node.artifact!;
      const active = item.path === current.path;
      const Icon = TYPE_ICONS[item.fileType] ?? CodeIcon;
      const label = artifactDisplayLabel(item.path);
      return (
        <button
          key={node.path}
          type='button'
          aria-current={active ? 'page' : undefined}
          onClick={() => setCurrent(item)}
          style={navIndent(depth)}
          className={cn(navRow, 'text-left', navRowState(active))}
        >
          <HugeiconsIcon icon={Icon} size={14} className='shrink-0 text-muted-foreground' />
          <span className='min-w-0 flex-1 truncate' title={label}>
            {label}
          </span>
        </button>
      );
    });
  }

  return (
    <TooltipProvider>
      <div className='flex h-dvh overflow-hidden bg-background text-foreground'>
        <SectionNav label='Prototype navigation'>
          <NavHeader className='pb-0'>
            <div className='pl-3 pr-2.5'>
              <div className='flex min-h-8 items-center'>
                <h2 className='min-w-0 flex-1 truncate text-sm font-semibold leading-tight' title={title}>
                  {title}
                </h2>
              </div>
              <div className='mt-1 mb-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
                <span>System ·</span>
                <span className='min-w-0 truncate' title={systemLabel ?? 'None'}>
                  {systemLabel ?? 'None'}
                </span>
              </div>
            </div>
          </NavHeader>
          <nav className='group/tree flex min-h-0 flex-1 flex-col space-y-1.5 overflow-y-auto px-2 pt-3 pb-3'>
            <div className='flex h-7 shrink-0 items-center justify-between gap-1 pr-0.5 pl-2.5'>
              <p className='min-w-0 flex-1 truncate text-[12px] font-semibold leading-none'>Artifacts</p>
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity',
                  !filterOpen && 'opacity-0 group-hover/tree:opacity-100 group-focus-within/tree:opacity-100',
                )}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type='button'
                        aria-label='Filter'
                        aria-pressed={filterOpen}
                        onClick={() => setFilterOpen(open => !open)}
                        className={cn(
                          iconButton,
                          filterOpen && 'bg-sidebar-foreground/10 text-sidebar-accent-foreground',
                        )}
                      />
                    }
                  >
                    <HugeiconsIcon icon={Search01Icon} size={14} />
                  </TooltipTrigger>
                  <TooltipContent side='bottom'>Filter</TooltipContent>
                </Tooltip>
                {dirs.length > 0 && (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type='button'
                          aria-label={allOpen ? 'Collapse all' : 'Expand all'}
                          onClick={() => setClosed(allOpen ? new Set(dirs) : new Set())}
                          className={iconButton}
                        />
                      }
                    >
                      <HugeiconsIcon icon={allOpen ? UnfoldLessIcon : UnfoldMoreIcon} size={14} />
                    </TooltipTrigger>
                    <TooltipContent side='bottom'>{allOpen ? 'Collapse all' : 'Expand all'}</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            {filterOpen && (
              <div className='relative shrink-0 px-1'>
                <Input
                  ref={filterRef}
                  value={filter}
                  onChange={event => setFilter(event.target.value)}
                  onKeyDown={event => {
                    if (event.key !== 'Escape') return;
                    event.preventDefault();
                    if (filter) setFilter('');
                    else setFilterOpen(false);
                  }}
                  placeholder='Filter artifacts'
                  aria-label='Filter artifacts'
                  className={cn(
                    'h-8 border-sidebar-border bg-sidebar-accent text-[13px] shadow-none',
                    filter && 'pr-8',
                  )}
                />
                {filter && (
                  <button
                    type='button'
                    aria-label='Clear filter'
                    onClick={() => {
                      setFilter('');
                      filterRef.current?.focus();
                    }}
                    className='absolute top-1/2 right-3 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-sidebar-foreground'
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={12} />
                  </button>
                )}
              </div>
            )}
            <div className='flex min-h-0 flex-1 flex-col gap-0.5 rounded-md'>
              {query && shown.length === 0 && (
                <p role='status' className='px-2.5 py-1 text-[12px] text-muted-foreground'>
                  No matching artifacts.
                </p>
              )}
              {renderRows(shown, 0)}
            </div>
          </nav>
        </SectionNav>
        <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-auto overscroll-contain'>
          {current.fileType === 'view' && (
            <ViewSurface artifact={current} studioId={studioId} artifacts={artifacts} themeClass={themeClass} />
          )}
          {current.fileType !== 'view' && (
            <ErrorBoundary resetKeys={[current.path]} FallbackComponent={ViewError}>
              {current.fileType === 'document' &&
                BoundDocumentComponent &&
                renderDocument?.({
                  artifact: current,
                  Component: BoundDocumentComponent,
                })}
              {current.fileType === 'diagrams' && current.source !== undefined && (
                <div className='flex h-full min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-background'>
                  {renderDiagram?.({ source: current.source })}
                </div>
              )}
              {current.fileType === 'canvas' &&
                current.source !== undefined &&
                renderCanvas?.({
                  text: current.source,
                  dark,
                  resolveLink: link => (link ? resolveArtifactTarget(artifacts, studioId, link) : undefined),
                  selectArtifact: setCurrent,
                  renderEmbed,
                })}
            </ErrorBoundary>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function DownloadedPrototype(props: DownloadedPrototypeProps) {
  const router = useMemo(() => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const rootRoute = createRootRoute({ component: Outlet });
    const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '$', component: ShareShell });
    return createRouter({ routeTree: rootRoute.addChildren([indexRoute]), history });
  }, []);
  return (
    <ShareShellContext.Provider value={props}>
      <RouterProvider router={router} />
    </ShareShellContext.Provider>
  );
}

export function DownloadedDocumentEmbed({
  source,
  label,
  base,
  resolveEmbed,
  selectArtifact,
  renderEmbed,
}: {
  source: string;
  label?: string;
  base: string;
  resolveEmbed: (reference: string, base: string) => DownloadedArtifact | undefined;
  selectArtifact: (artifact: DownloadedArtifact) => void;
  renderEmbed: (target: DownloadedArtifact, width: number, height: number) => ReactNode;
}) {
  const [width, setWidth] = useState(640);
  const container = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (container.current) setWidth(Math.max(1, container.current.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const target = resolveEmbed(source, base);
  const height = Math.max(220, Math.min(440, Math.round(width * 0.6)));
  if (!target) {
    return (
      <figure className='not-prose my-6 min-w-0 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground'>
        File unavailable.
      </figure>
    );
  }
  return (
    <figure className='not-prose my-6 min-w-0' ref={container}>
      <DownloadedEmbedFrame target={target} label={label} onOpen={selectArtifact}>
        <div inert className='min-h-0' style={{ height, pointerEvents: 'none' }}>
          {renderEmbed(target, width, height)}
        </div>
      </DownloadedEmbedFrame>
    </figure>
  );
}

export function createDownloadedMarkdownComponents({
  base,
  resolveEmbed,
  selectArtifact,
  renderEmbed,
  MermaidComponent,
}: {
  base: string;
  resolveEmbed: (reference: string, base: string) => DownloadedArtifact | undefined;
  selectArtifact: (artifact: DownloadedArtifact) => void;
  renderEmbed: (target: DownloadedArtifact, width: number, height: number) => ReactNode;
  MermaidComponent: ComponentType<{ source: string }>;
}) {
  return {
    a: ({ href = '', ...rest }: ComponentProps<'a'>) => {
      if (href.startsWith('#')) return <a href={href} {...rest} />;
      const target = resolveEmbed(href, base);
      if (target) {
        return (
          <a
            href={`#${target.path}`}
            {...rest}
            onClick={event => {
              event.preventDefault();
              selectArtifact(target);
            }}
          />
        );
      }
      return <a href={href} target='_blank' rel='noopener noreferrer' {...rest} />;
    },
    'mermaid-diagram': MermaidComponent,
    'prototype-artifact': ({ source, label }: { source: string; label?: string }) => (
      <DownloadedDocumentEmbed
        source={source}
        label={label}
        base={base}
        resolveEmbed={resolveEmbed}
        selectArtifact={selectArtifact}
        renderEmbed={renderEmbed}
      />
    ),
  };
}
