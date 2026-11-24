import {
  ArrowDown01Icon,
  Compass01Icon,
  LibraryIcon,
  CubeIcon,
  Notebook01Icon,
  MagicWand01Icon,
  ColorsIcon,
  TextFontIcon,
  SquareRoundCornerIcon,
  Layers01Icon,
  RulerIcon,
  ArrowRight01Icon,
  SparklesIcon,
  CodeIcon,
  SmileIcon,
  Image01Icon,
  Search01Icon,
  ArrowShrink01Icon,
  ArrowExpand01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';
import { getSystemSource } from '#studio/systems';
import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useSearch, useRouterState, lazyRouteComponent } from '@tanstack/react-router';
import { Input } from '@/platform/systems/studio/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/platform/systems/studio/components/tooltip';
import { artifactLabel, findArtifact } from '@/platform/app/data/manifest';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/platform/systems/studio/components/collapsible';
import { FileTree } from '#studio/ui';
import { systemFileTreePolicy } from '../content/fileTreePolicy';
import { contentId, SYSTEM_CONTENT_SECTIONS, systemFolder } from '@/platform/core/roots';
import type { ContentData } from '../content/SystemContentPage';
import SystemContentPage from '../content/SystemContentPage';
import type { Prototype } from '@/platform/app/data/types';
import { NavHeader, NavList, NavTitle, SectionNav } from '@/platform/app/shell/nav';
import { NotFound } from '@/platform/app/shell/NotFound';
import { ColorTokens, PageHeader } from '@/platform/modules/systems/pages/foundations';
import {
  OtherTokens,
  RadiusTokens,
  ShadowTokens,
  SpacingTokens,
  TypographyTokens,
} from '@/platform/modules/systems/pages/tokens';
import { ComponentDocPage } from '@/platform/modules/systems/pages/ComponentDocPage';
import { useManifest } from '@/platform/app/data/useManifest';
import type { DesignSystem, SystemIntro } from '@/platform/app/data/types';
import type { SystemComponentDoc } from '@/platform/modules/systems/docs';
import type { ThemeToken, TokenGroup } from '@/platform/modules/systems/themeTokens';
import { ThemeScope } from '#studio/systems';
import { defaultSystemKey, getSystems, systemKeyFromIdentity, systemPath } from '#studio/systems';
const DEFAULT_SYSTEM = defaultSystemKey();
const SYSTEM_SPECS = getSystems();
import { useSourceView } from '@/platform/core/source/useSourceView';
import FileNavItem from '@/platform/app/shell/FileNavItem';
import { platformSystemKey } from '#studio/systems';
const PLATFORM_ID = platformSystemKey();
import { systemSourceRequest } from './systemSource';
import SystemActionToast from './SystemActionToast';
import SystemMenu from './SystemMenu';
import type { ComponentPageData } from '../data/loadDocs';
import SystemOverview from './SystemOverview';
import SystemAssets from './SystemAssets';
import SystemLibraries from './SystemLibraries';
import { systemAssets } from '../data/assets';
import { navLinkClass, navLinkStyle } from '@/platform/app/shell/nav';

const ComponentEditor = import.meta.env.DEV
  ? lazyRouteComponent(() => import('./ComponentEditor').then(module => ({ default: module.ComponentEditor })))
  : null;

const SystemSourceEditor = import.meta.env.DEV ? lazyRouteComponent(() => import('./SystemSourceEditor')) : null;

export const prepareSystemSource = () => Promise.all([ComponentEditor?.preload?.(), SystemSourceEditor?.preload?.()]);

// Systems: one page per theme category and component,
// at /systems/<system>/<page> (the system's introduction at /systems/<system>).
// Every system is treated the same, the app's own (Studio) included. What only its people can write
// comes from <system folder>/intro.tsx (src/systems/<id>/ or, for Studio's own, src/platform/systems/studio/): overview summaries, optional additional content, and icons. The rest comes from its files: a component page for each component in its components
// folder (src/platform/modules/systems/docs.ts), and a theme page for each kind of token its theme
// defines (src/platform/modules/systems/themeTokens.ts).
const intros = import.meta.glob<{ default: SystemIntro }>(['/platform/systems/*/intro.tsx', '/systems/*/intro.tsx'], {
  eager: true,
});
// One key for a system's intro, so the page and its source action can't look in different folders.
const introKey = (id: string) => `/${systemFolder(id)}/intro.tsx`;
const introOf = (id: string): SystemIntro => intros[introKey(id)]?.default ?? {};
const PROTOTYPE_SPECS: Record<string, DesignSystem> = Object.fromEntries(
  Object.entries(SYSTEM_SPECS).map(([id, spec]) => [
    id,
    {
      label: spec.label,
      dir: `${spec.dir}components/`,
      scopeClass: spec.themeClass,
      ...introOf(id),
    },
  ]),
);
const SYSTEMS: Record<string, DesignSystem> = PROTOTYPE_SPECS;
const platform = SYSTEMS[PLATFORM_ID];
type SystemId = string;

// Map a rendered Systems page to its actual source files.
function sourcePath(system: string, page: string | undefined, components: SystemComponentDoc[], componentPage = false) {
  const source = getSystemSource(system)!;
  if (!componentPage && (page === 'assets' || page === 'fonts' || page === 'images')) return null;
  if (!componentPage && (!page || page === 'icons'))
    return intros[introKey(system)] ? source.dir + 'intro.tsx' : source.dir + 'system.ts';
  const component = componentPage ? components.find(c => c.slug === page) : undefined;
  if (component) {
    const file = component.files.doc ?? component.files.examples ?? component.files.source;
    return file ? source.components + '/' + file : null;
  }
  return !componentPage && TOKEN_PAGES.some(item => item.id === page) ? source.theme : null;
}

// The theme pages: page id and name, for each kind of token a theme can define.
const TOKEN_PAGES: { id: string; label: string; group: TokenGroup }[] = [
  { id: 'colors', label: 'Colors', group: 'colors' },
  { id: 'typography', label: 'Typography', group: 'typography' },
  { id: 'radius', label: 'Radius', group: 'radius' },
  { id: 'shadows', label: 'Shadows', group: 'shadows' },
  { id: 'spacing', label: 'Spacing', group: 'spacing' },
  { id: 'motion', label: 'Motion', group: 'motion' },
  { id: 'effects', label: 'Effects', group: 'effects' },
  { id: 'tokens', label: 'Other tokens', group: 'other' },
];

// Stable semantic icons distinguish system guidance and theme pages from source files.
const PAGE_ICONS: Record<string, IconSvgElement> = {
  intro: Compass01Icon,
  colors: ColorsIcon,
  typography: TextFontIcon,
  radius: SquareRoundCornerIcon,
  shadows: Layers01Icon,
  spacing: RulerIcon,
  motion: ArrowRight01Icon,
  effects: SparklesIcon,
  tokens: CodeIcon,
  icons: SmileIcon,
};
const CONTENT_ICONS: Record<string, IconSvgElement> = { context: Notebook01Icon, skills: MagicWand01Icon };
const navIcon = (icon: IconSvgElement) => (
  <HugeiconsIcon icon={icon} aria-hidden='true' className='size-3.5 shrink-0 text-muted-foreground' />
);

// Different Systems routes mount separate page instances. Keep tree choices for the session.
const systemTreeState = new Map<
  string,
  {
    openGroups: Record<string, boolean>;
    folderCommand: { version: number; expanded: boolean };
    foldersExpanded: Record<string, boolean>;
  }
>();

// A fixed system folder and its readable contents. Page changes preserve branch state.
function SystemBranch({
  label,
  path,
  open,
  onOpenChange,
  children,
}: {
  label: string;
  path: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        title={path}
        className='mx-1 flex h-7 w-[calc(100%-8px)] items-center gap-1.5 rounded-md px-2 text-left text-[12px] font-medium leading-tight hover:bg-sidebar-foreground/5'
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className={'size-3.5 shrink-0 text-muted-foreground transition-transform ' + (open ? '' : '-rotate-90')}
        />
        {label}
      </CollapsibleTrigger>
      <CollapsibleContent className='space-y-0.5 pl-5'>{children}</CollapsibleContent>
    </Collapsible>
  );
}

function TreeAction({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type='button'
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className='inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-foreground/5 disabled:opacity-40'
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side='bottom'>{label}</TooltipContent>
    </Tooltip>
  );
}

// The system navigation uses the shared pieces (shell/nav/): its name and pages under their headings.
function SystemNav({
  system,
  components,
  tokens,
  page,
}: {
  system: SystemId;
  components: SystemComponentDoc[];
  tokens: ThemeToken[];
  page?: string;
}) {
  const params = useRouterState({ select: state => state.matches.at(-1)?.params }) as { _splat?: string };
  const manifest = useManifest();
  const source = getSystemSource(system)!;
  const foundations = TOKEN_PAGES.filter(p => tokens.some(t => t.group === p.group));
  const savedTree = systemTreeState.get(system);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    () => savedTree?.openGroups ?? { context: true, skills: true, theme: true, assets: true, components: true },
  );
  const [folderCommand, setFolderCommand] = useState(() => savedTree?.folderCommand ?? { version: 0, expanded: true });
  const [foldersExpanded, setFoldersExpanded] = useState<Record<string, boolean>>(
    () => savedTree?.foldersExpanded ?? {},
  );
  useEffect(() => {
    systemTreeState.set(system, { openGroups, folderCommand, foldersExpanded });
  }, [system, openGroups, folderCommand, foldersExpanded]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);
  const q = query.trim().toLowerCase();
  const matches = (label: string) => !q || label.toLowerCase().includes(q);
  const activeGroup =
    page &&
    (Object.hasOwn(SYSTEM_CONTENT_SECTIONS, page)
      ? page
      : ['assets', 'fonts', 'icons', 'images'].includes(page)
        ? 'assets'
        : foundations.some(p => p.id === page)
          ? 'theme'
          : page.startsWith('components/')
            ? 'components'
            : undefined);
  useEffect(() => {
    if (activeGroup) setOpenGroups(prev => ({ ...prev, [activeGroup]: true }));
  }, [activeGroup, page, params._splat]);
  const groupOpen = (id: string) => Boolean(q) || openGroups[id];
  const changeGroup = (id: string, open: boolean) => {
    if (!q) setOpenGroups(prev => ({ ...prev, [id]: open }));
  };
  const allExpanded = Object.values(openGroups).every(Boolean) && Object.values(foldersExpanded).every(Boolean);
  const toggleAll = () => {
    const expanded = !allExpanded;
    setOpenGroups({ context: expanded, skills: expanded, theme: expanded, assets: expanded, components: expanded });
    setFolderCommand(prev => ({ version: prev.version + 1, expanded }));
  };
  const contentSections = Object.entries(SYSTEM_CONTENT_SECTIONS).flatMap(([id, section]) => {
    const proto = manifest.systemContent.find(p => p.id === contentId(system, id));
    return proto ? [{ id, section, proto }] : [];
  });
  const matchingFoundations = foundations.filter(p => matches('Theme') || matches(p.label));
  const matchingComponents = components.filter(
    c =>
      matches('Components') ||
      matches(c.title) ||
      Object.values(c.files).some(file => file && matches(`${source.components}/${file}`)),
  );
  const librariesMatch =
    matches('Libraries') ||
    (manifest.systems[system]?.libraries ?? []).some(library => matches(library.label) || matches(library.description));
  const assetPages = [
    { id: 'fonts', label: 'Fonts', icon: TextFontIcon },
    { id: 'icons', label: 'Icons', icon: SmileIcon },
    { id: 'images', label: 'Images', icon: Image01Icon },
  ].filter(
    item =>
      matches('Assets') ||
      matches(item.label) ||
      systemAssets(system).some(asset => asset.kind === item.label && matches(asset.path)),
  );
  const anyMatch =
    librariesMatch ||
    matches('Overview') ||
    assetPages.length > 0 ||
    matchingFoundations.length > 0 ||
    matchingComponents.length > 0 ||
    contentSections.some(
      ({ section, proto }) =>
        matches(section.title) || proto.artifacts.some(a => matches(artifactLabel(a.path, proto)) || matches(a.path)),
    );
  const file = (id: string | undefined, label: string, component = false) => {
    const path = sourcePath(system, id, components, component);
    return (
      path && (
        <FileNavItem
          key={id ?? 'intro'}
          href={systemPath(system) + (id ? '/' + (component ? 'components/' : '') + id : '')}
          path={path}
          label={label}
          className={id ? undefined : 'h-7'}
          icon={navIcon(component ? CubeIcon : (PAGE_ICONS[id ?? 'intro'] ?? CubeIcon))}
          reveal={() => systemSourceRequest('reveal', path)}
        />
      )
    );
  };
  return (
    <SectionNav label='Systems'>
      <NavHeader>
        <SystemActionToast />
        <NavTitle actions={<SystemMenu key={system} system={system} />}>{SYSTEMS[system].label}</NavTitle>
        {system === DEFAULT_SYSTEM && <p className='px-3 pt-0.5 text-xs text-muted-foreground'>Default system</p>}
      </NavHeader>
      <div className='shrink-0 px-3 pt-3'>
        <div className='flex h-7 items-center justify-between pl-2'>
          <p className='text-[12px] font-semibold'>Resources</p>
          <div className='flex items-center gap-0.5'>
            <TreeAction
              label='Search'
              onClick={() => {
                setSearchOpen(open => !open);
                setQuery('');
              }}
            >
              {navIcon(Search01Icon)}
            </TreeAction>
            <TreeAction label={allExpanded ? 'Collapse all' : 'Expand all'} onClick={toggleAll} disabled={Boolean(q)}>
              {navIcon(allExpanded ? ArrowShrink01Icon : ArrowExpand01Icon)}
            </TreeAction>
          </div>
        </div>
        {searchOpen && (
          <div className='relative mt-1'>
            <Input
              ref={searchRef}
              aria-label='Search system'
              placeholder='Search system'
              value={query}
              onChange={event => setQuery(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Escape') {
                  event.stopPropagation();
                  if (query) setQuery('');
                  else setSearchOpen(false);
                }
              }}
              className='h-8 pr-8 text-[13px] shadow-none'
            />
            {query && (
              <button
                type='button'
                aria-label='Clear search'
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
                className='absolute right-1 top-0.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground'
              >
                {navIcon(Cancel01Icon)}
              </button>
            )}
          </div>
        )}
      </div>
      <NavList>
        {matches('Overview') && file(undefined, 'Overview')}
        {librariesMatch && (
          <Link
            to={`${systemPath(system)}/libraries` as never}
            activeOptions={{ includeSearch: false }}
            className={navLinkClass}
            style={navLinkStyle}
          >
            {navIcon(LibraryIcon)}Libraries
          </Link>
        )}
        {contentSections.map(({ id, section, proto }) => (
          <FileTree
            key={proto.id}
            policy={systemFileTreePolicy(proto)}
            proto={proto}
            current={page === id && params._splat ? findArtifact(proto, params._splat) : undefined}
            embedded
            contentIcon={navIcon(CONTENT_ICONS[id])}
            branch={{ label: section.title, path: source.dir + id + '/', active: page === id }}
            navigation={{
              query: matches(section.title) ? '' : q,
              searching: Boolean(q),
              expanded: groupOpen(id),
              onExpandedChange: open => changeGroup(id, open),
              folderCommand,
              onFoldersExpanded: open =>
                setFoldersExpanded(prev => (prev[id] === open ? prev : { ...prev, [id]: open })),
            }}
          />
        ))}
        {(matchingFoundations.length > 0 || matches('Theme')) && (
          <SystemBranch
            label='Theme'
            path={source.theme}
            open={groupOpen('theme')}
            onOpenChange={open => changeGroup('theme', open)}
          >
            {matchingFoundations.map(p => file(p.id, p.label))}
            {!foundations.length && !q && <p className='px-3 py-1 text-[12px] text-muted-foreground'>No tokens yet</p>}
          </SystemBranch>
        )}
        {assetPages.length > 0 && (
          <SystemBranch
            label='Assets'
            path={source.dir + 'assets/'}
            open={groupOpen('assets')}
            onOpenChange={open => changeGroup('assets', open)}
          >
            {assetPages.map(item =>
              item.id === 'icons' && SYSTEMS[system].icons ? (
                file('icons', 'Icons')
              ) : (
                <Link
                  key={item.id}
                  to={`${systemPath(system)}/${item.id}` as never}
                  activeOptions={{ includeSearch: false }}
                  className={navLinkClass}
                  style={navLinkStyle}
                >
                  {navIcon(item.icon)}
                  {item.label}
                </Link>
              ),
            )}
          </SystemBranch>
        )}
        {(matchingComponents.length > 0 || matches('Components')) && (
          <SystemBranch
            label='Components'
            path={source.components}
            open={groupOpen('components')}
            onOpenChange={open => changeGroup('components', open)}
          >
            {matchingComponents.map(c => file(c.slug, c.title, true))}
            {!components.length && <p className='px-3 py-1 text-[12px] text-muted-foreground'>Empty folder</p>}
          </SystemBranch>
        )}
        {q && !anyMatch && (
          <p role='status' className='px-3 py-1 text-[12px] text-muted-foreground'>
            No matching items.
          </p>
        )}
      </NavList>
    </SectionNav>
  );
}

// One page of a system, or null if the system doesn't have it.
function SystemPage({
  system,
  sys,
  components,
  tokens,
  origin,
  page,
  componentSlug,
  assetPath,
  pageData,
}: {
  system: SystemId;
  sys: DesignSystem;
  components: SystemComponentDoc[];
  tokens: ThemeToken[];
  origin: 'shadcn' | null;
  page?: string;
  componentSlug?: string;
  assetPath?: string;
  pageData?: { componentKey?: string; componentData?: ComponentPageData; contentData?: ContentData } | null;
}) {
  const has = (group: TokenGroup) => tokens.some(t => t.group === group);
  switch (page) {
    case undefined:
      return <SystemOverview system={system} sys={sys} components={components} tokens={tokens} />;
    case 'fonts':
      return <SystemAssets system={system} sys={sys} kind='Fonts' path={assetPath} />;
    case 'libraries':
      return assetPath ? null : <SystemLibraries system={system} label={sys.label} />;
    case 'images':
      return <SystemAssets system={system} sys={sys} kind='Images' path={assetPath} />;
    case 'colors':
      return has('colors') ? (
        <>
          <PageHeader
            title='Colors'
            description="Every color token in the theme. Values reflect this system's active mode."
          />
          <ColorTokens tokens={tokens} />
        </>
      ) : null;
    case 'typography':
      return (
        <>
          <PageHeader title='Typography' description='The fonts, sizes, and weights.' />
          <TypographyTokens tokens={tokens} />
        </>
      );
    case 'radius':
      return has('radius') ? (
        <>
          <PageHeader title='Radius' description='How rounded the corners are.' />
          <RadiusTokens tokens={tokens} />
        </>
      ) : null;
    case 'shadows':
      return has('shadows') ? (
        <>
          <PageHeader title='Shadows' description='The shadows the theme defines.' />
          <ShadowTokens tokens={tokens} />
        </>
      ) : null;
    case 'motion':
      return has('motion') ? (
        <>
          <PageHeader title='Motion' description='Animation, easing, and transition values declared by this system.' />
          <OtherTokens tokens={tokens} group='motion' />
        </>
      ) : null;
    case 'effects':
      return has('effects') ? (
        <>
          <PageHeader
            title='Effects'
            description='Blur, perspective, and aspect ratio values declared by this system.'
          />
          <OtherTokens tokens={tokens} group='effects' />
        </>
      ) : null;
    case 'spacing':
      return has('spacing') ? (
        <>
          <PageHeader title='Spacing' description='The spacing values the theme defines.' />
          <SpacingTokens tokens={tokens} />
        </>
      ) : null;
    case 'tokens':
      return has('other') ? (
        <>
          <PageHeader title='Other tokens' description='Everything else the theme defines.' />
          <OtherTokens tokens={tokens} />
        </>
      ) : null;
    case 'icons':
      return <SystemAssets system={system} sys={sys} kind='Icons' path={assetPath} />;
  }
  const found = page === 'components' ? components.find(c => c.slug === componentSlug) : undefined;
  return found && pageData?.componentData && pageData.componentKey === system + '/' + found.slug ? (
    <ComponentDocPage
      key={pageData.componentKey}
      system={system}
      sys={sys}
      component={found}
      origin={origin}
      loaded={pageData.componentData}
    />
  ) : null;
}

export default function SystemsPage() {
  // The router's types leave out the modules' routes, so say what this module's routes carry.
  const params = useRouterState({ select: state => state.matches.at(-1)?.params }) as {
    system?: string;
    page?: string;
    _splat?: string;
  };
  const system = systemKeyFromIdentity(params.system) ?? '';
  const page = params.page === 'components' ? params._splat : params.page;
  const sys = SYSTEMS[system];
  const mainRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [system, params.page, params._splat]);

  const pageData = useRouterState({ select: state => state.matches.at(-1)?.loaderData }) as
    | { componentKey?: string; componentData?: ComponentPageData; contentData?: ContentData }
    | null
    | undefined;
  const manifest = useManifest();
  const manifestSystem = manifest.systems[system];
  const selected = manifest.systemContent.find(p => p.id === contentId(system, params.page ?? '')) as
    | Prototype
    | undefined;
  const components = manifestSystem?.components ?? [];
  const tokens = manifestSystem?.tokens ?? [];
  const search = useSearch({ strict: false }) as { mode?: 'source' };
  const editing = import.meta.env.DEV && search.mode === 'source';
  const path =
    sys && !selected && (!params._splat || params.page === 'components')
      ? sourcePath(system, page, components, params.page === 'components')
      : null;
  const { toggle, rendered } = useSourceView(import.meta.env.DEV && Boolean(path), editing && !selected);
  const editable = params.page === 'components' ? components.find(c => c.slug === page) : undefined;
  const content =
    editing && path ? (
      <></>
    ) : selected ? (
      <SystemContentPage
        key={selected.id + '/' + (params._splat ?? '')}
        proto={selected}
        slug={params._splat}
        data={pageData?.contentData}
      />
    ) : sys ? (
      SystemPage({
        system,
        sys,
        components,
        tokens,
        origin: manifestSystem?.origin ?? null,
        page: params.page,
        componentSlug: params._splat,
        assetPath: params._splat,
        pageData,
      })
    ) : null;
  if (!sys || !content) return <NotFound />;
  return (
    <div className='flex min-h-0 flex-1'>
      <SystemNav
        system={system}
        components={components}
        tokens={tokens}
        page={params.page === 'components' ? 'components/' + params._splat : params.page}
        key={system}
      />
      {selected ? (
        <main className='flex min-h-0 min-w-0 flex-1 flex-col'>{content}</main>
      ) : editing && path ? (
        <main className='flex min-h-0 min-w-0 flex-1 flex-col'>
          <Suspense fallback={<p className='p-4 text-sm'>Loading editor…</p>}>
            {editable && ComponentEditor ? (
              <ComponentEditor
                key={system + '/' + editable.slug}
                system={system}
                component={editable}
                onDone={toggle}
              />
            ) : (
              SystemSourceEditor && <SystemSourceEditor path={path} onDone={toggle} />
            )}
          </Suspense>
        </main>
      ) : (
        <main ref={mainRef} className='min-w-0 flex-1 overflow-y-auto'>
          <ThemeScope
            themeClass={
              page && !['assets', 'fonts', 'icons', 'images', 'libraries'].includes(page)
                ? sys.scopeClass
                : platform.scopeClass
            }
            className='min-h-full bg-background text-foreground'
          >
            <div
              ref={rendered}
              tabIndex={-1}
              className='mx-auto w-full max-w-3xl px-8 py-10 outline-none'
              data-testid={`${system}-set`}
            >
              {content}
            </div>
          </ThemeScope>
        </main>
      )}
    </div>
  );
}
