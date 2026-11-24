import { artifactAvailability } from '@/platform/core/fileTypes';
// Permanent prototype and artifact addresses use source IDs. System routes are
// contributed by Systems; their named surfaces remain relative to the system ID.
// Module-owned sections retain their own declared routing contract.
// https://tanstack.com/router/latest/docs/framework/react/routing/code-based-routing
import { Suspense, useRef } from 'react';
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  redirect,
  useRouter,
  lazyRouteComponent,
} from '@tanstack/react-router';
import { useSourceView } from '@/platform/core/source/useSourceView';
import { shortcutLabel } from '@/platform/app/shell/artifactShortcuts';
import { Button } from '@/platform/systems/studio/components/button';
import App from '@/platform/app/shell/App';
import { NotFound } from '@/platform/app/shell/NotFound';
import Home from '@/platform/app/pages/home/Home';
import PrototypeLayout from '@/platform/modules/prototypes/viewer/PrototypeLayout';
import { isSectionKey, rootOf, SYSTEM_CONTENT_KEY } from '@/platform/core/roots';
import { resourceId } from '@/platform/core/resourceIdentity';
import {
  findArtifact,
  findArtifactByIdentity,
  firstArtifact,
  artifactLabel,
  prototypeLink,
  loadManifest,
  loadPrototype,
  loadPrototypeByIdentity,
  setManifest,
} from '@/platform/app/data/manifest';
import { prepareFile } from '@/platform/app/data/fileTypeModule';
import { FILE_TYPES, fileTypeModules } from '@/platform/app/data/fileTypes';
import type { Artifact, Manifest, Prototype } from '@/platform/app/data/types';
import { createRefreshQueue } from '@/platform/app/data/refreshQueue';
import { TAB_ID } from '@/platform/app/data/files';
import { onMutation } from '@/platform/app/data/mutations';
import { moduleApps } from '@/platform/app/modules';
import { downloaded } from '@/platform/app/data/downloaded';
import { APP_NAME } from '@/platform/app/data/config';
import { loadReference } from '@/platform/app/docs/loadReference';
import MarkdownPage from '@/platform/app/docs/MarkdownPage';
import { contentId } from '@/platform/core/roots';
import { prepareContent } from '@/platform/modules/systems/content/SystemContentPage';
import { AboutReference } from '@/platform/app/docs/References';

function LoadError({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  return (
    <div role='alert' className='space-y-3 p-8'>
      <p className='text-sm font-medium'>This page couldn't load.</p>
      <p className='text-sm text-muted-foreground'>{error instanceof Error ? error.message : String(error)}</p>
      <Button
        variant='outline'
        onClick={() => {
          void router.invalidate().then(reset);
        }}
      >
        Try again
      </Button>
    </div>
  );
}

const rootRoute = createRootRoute({
  loader: () => loadManifest(),
  staleTime: Infinity,
  head: () => ({ meta: [{ title: APP_NAME }] }),
  component: App,
  notFoundComponent: NotFound,
  errorComponent: LoadError,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  // A downloaded prototype is the only thing in its page, so it opens there.
  beforeLoad: async () => {
    const only = downloaded && (await loadManifest()).prototypes[0];
    if (only) throw redirect({ ...prototypeLink(only), replace: true });
  },
  head: () => ({ meta: [{ title: APP_NAME }] }),
  component: Home,
});

const Settings = import.meta.env.DEV
  ? lazyRouteComponent(() => import('@/platform/app/pages/settings/Settings'))
  : null;
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  loader: () => Settings?.preload?.(),
  head: () => ({ meta: [{ title: 'Studio settings — ' + APP_NAME }] }),
  component: () =>
    Settings && (
      <Suspense fallback={null}>
        <Settings />
      </Suspense>
    ),
});

const documentationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'documentation',
  beforeLoad: async () => {
    const manifest = await loadManifest();
    const landing = moduleApps.map(({ app }) => app.landing?.(manifest)).find(Boolean);
    throw redirect({
      to: (landing ?? '/documentation/context/platform.core') as never,
      replace: true,
    });
  },
});

// Owner guidance and local file actions remain available without the optional Manual.
const DocumentationEditor = import.meta.env.DEV
  ? lazyRouteComponent(() => import('@/platform/app/docs/DocumentationEditor'))
  : null;
const KnowledgePage = lazyRouteComponent(() => import('@/platform/app/docs/KnowledgePage'));
const KnowledgeDocument = lazyRouteComponent(() =>
  import('@/platform/app/docs/KnowledgePage').then(mod => ({ default: mod.KnowledgeDocument })),
);
// Keep the reading navigation mounted while child routes replace the open document.
const contextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'documentation/context',
  loader: () => Promise.all([KnowledgePage.preload?.(), KnowledgeDocument.preload?.()]),
  validateSearch: (search: Record<string, unknown>): { mode?: 'source' } => ({
    mode: search.mode === 'source' ? 'source' : undefined,
  }),
  component: () => (
    <Suspense fallback={null}>
      <KnowledgePage />
    </Suspense>
  ),
});
const contextIndexRoute = createRoute({
  getParentRoute: () => contextRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/documentation/context/platform.core' as never, replace: true });
  },
});
async function ownerDocument(ownerId: string, file: string, mode?: 'source') {
  if (ownerId !== 'platform.core' && !ownerId.startsWith('module.')) throw notFound();
  const manifest = await loadManifest();
  const owner = manifest.systemContent.find(p => p.owner?.id === ownerId)?.owner;
  if (!owner) throw notFound();
  const source = '/' + owner.root.slice(4) + '/' + file;
  const group = manifest.platformReferences.find(g => g.references.some(r => r.source === source));
  if (!group) {
    if (file === 'README.md') return null;
    throw notFound();
  }
  if (import.meta.env.DEV && mode === 'source') {
    await DocumentationEditor?.preload?.();
    return { editing: true as const, path: source, filePath: source, title: 'Source' };
  }
  const mod = await loadReference(source);
  if (!mod) throw notFound();
  const title = group.references.find(r => r.source === source)?.title ?? mod.frontmatter?.title;
  return {
    editing: false as const,
    Component: mod.default,
    frontmatter: { ...mod.frontmatter, title },
    path: source,
    filePath: source,
    group,
    title,
  };
}
function OwnerDocument({ data }: { data: Awaited<ReturnType<typeof ownerDocument>> }) {
  const { rendered } = useSourceView(import.meta.env.DEV && Boolean(data), Boolean(data?.editing));
  if (!data) return null;
  if (data.editing)
    return (
      DocumentationEditor && (
        <Suspense fallback={null}>
          <DocumentationEditor path={'src' + data.path} />
        </Suspense>
      )
    );
  return (
    <div ref={rendered} tabIndex={-1} className='flex min-h-0 flex-1 flex-col outline-none'>
      <MarkdownPage
        Component={data.Component}
        frontmatter={data.frontmatter}
        docKey={data.path}
        base={data.path.slice(0, data.path.lastIndexOf('/'))}
        footer={<AboutReference source={data.path} group={data.group} />}
      />
    </div>
  );
}
const ownerRoute = createRoute({
  getParentRoute: () => contextRoute,
  path: '$owner',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => ownerDocument(params.owner, 'README.md', deps.mode),
  component: () => {
    const data = ownerRoute.useLoaderData();
    return <Suspense fallback={null}>{data ? <OwnerDocument data={data} /> : <KnowledgeDocument />}</Suspense>;
  },
});
const ownerReferenceRoute = createRoute({
  getParentRoute: () => contextRoute,
  path: '$owner/reference/$',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => ownerDocument(params.owner, params._splat ?? '', deps.mode),
  component: () => <OwnerDocument data={ownerReferenceRoute.useLoaderData()} />,
});
async function knowledgeLoader(params: { owner: string; page: string; _splat?: string }, mode?: 'source') {
  if (params.owner !== 'platform.core' && !params.owner.startsWith('module.')) throw notFound();
  const manifest = await loadManifest();
  const proto = manifest.systemContent.find(p => p.id === contentId(params.owner, params.page));
  if (!proto) throw notFound();
  const contentData = await prepareContent(proto, params._splat, mode);
  return { contentData, filePath: contentData.filePath };
}
const contextPageRoute = createRoute({
  getParentRoute: () => contextRoute,
  path: '$owner/$page',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => knowledgeLoader(params, deps.mode),
  component: () => (
    <Suspense fallback={null}>
      <KnowledgeDocument />
    </Suspense>
  ),
});
const contextItemRoute = createRoute({
  getParentRoute: () => contextRoute,
  path: '$owner/$page/$',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => knowledgeLoader(params, deps.mode),
  component: () => (
    <Suspense fallback={null}>
      <KnowledgeDocument />
    </Suspense>
  ),
});

// ?mode=source shows an item's text instead of the item (dev only): "Edit source" in its file menu.
type ItemSearch = { mode?: 'source' };

// Loads an item before the route renders, so the current one stays on screen until the next
// one is ready. Its file type (<module folder>/) loads the file. An unknown address, or a type
// that isn't installed, shows the not-found page.
async function itemLoader(
  {
    contributor,
    prototype,
    _splat,
    artifact,
  }: { contributor?: string; prototype: string; _splat?: string; artifact?: string },
  mode?: ItemSearch['mode'],
  retainedPath?: string,
): Promise<ItemData> {
  const proto = await (contributor ? loadPrototype(contributor, prototype) : loadPrototypeByIdentity(prototype));
  // No path in the URL: the prototype's start item, or its first.
  const item =
    proto &&
    (artifact
      ? findArtifactByIdentity(proto, artifact)
      : _splat
        ? findArtifact(proto, _splat)
        : (proto.artifacts.find(item => item.studioId === retainedPath) ??
          proto.artifacts.find(item => item.path === retainedPath) ??
          firstArtifact(proto)));
  const type = item && fileTypeModules[item.fileType];
  const title = proto && item && [proto.title, artifactLabel(item.path, proto), APP_NAME].join(' — ');
  // Source view: just the text, so a file that doesn't compile can still be read and fixed.
  if (
    import.meta.env.DEV &&
    mode === 'source' &&
    proto &&
    item &&
    title &&
    artifactAvailability(FILE_TYPES[item.fileType], {
      local: import.meta.env.DEV,
      editable: false,
      present: true,
      renderer: Boolean(type),
      scope: proto.contributorKey === SYSTEM_CONTENT_KEY ? 'systemContent' : 'prototype',
    }).source.available
  ) {
    await ArtifactSource?.preload?.();
    return {
      fileType: item.fileType,
      props: null,
      source: { proto, item },
      title,
      artifactId: item.studioId,
      artifactPath: item.path,
      filePath: '/' + rootOf(proto.contributorKey, proto.id) + '/' + item.path,
    };
  }
  const view = artifactAvailability(item && FILE_TYPES[item.fileType], {
    local: import.meta.env.DEV,
    editable: false,
    present: Boolean(item),
    renderer: Boolean(type),
    scope: proto?.contributorKey === SYSTEM_CONTENT_KEY ? 'systemContent' : 'prototype',
    systemMissing: proto?.systemMissing,
  });
  if (proto && item && title && view.view.supported && !view.view.available)
    return {
      fileType: item.fileType,
      props: null,
      title,
      artifactId: item.studioId,
      artifactPath: item.path,
      filePath: '/' + rootOf(proto.contributorKey, proto.id) + '/' + item.path,
      unavailable: view.view.reason,
    };
  const props = proto && item && type && view.view.available ? await prepareFile(type, { proto, item }) : undefined;
  if (!proto || !item || !props || !title) throw notFound();
  return {
    fileType: item.fileType,
    props,
    title,
    artifactId: item.studioId,
    artifactPath: item.path,
    filePath: '/' + rootOf(proto.contributorKey, proto.id) + '/' + item.path,
  };
}

// What an item route loads: the item's page props, or the Source view of it.
type ItemData = {
  fileType: string;
  props: object | null;
  source?: { proto: Prototype; item: Artifact };
  unavailable?: string;
  title: string;
  artifactId?: string;
  artifactPath: string;
  filePath: string;
};

// Reordering changes the opening artifact for the next visit, not the page being viewed.
const retainedIndexPath = (routeId: string, cause: string): string | undefined =>
  cause === 'stay'
    ? (() => {
        const data = router.state.matches.find(match => match.routeId === routeId)?.loaderData as ItemData | undefined;
        return data?.artifactId ?? data?.artifactPath;
      })()
    : undefined;

// Dev only: import.meta.env.DEV is false in the build, so the editor isn't in the deployed site.
const ArtifactSource = import.meta.env.DEV
  ? lazyRouteComponent(() => import('@/platform/app/source/ArtifactSource'))
  : null;

// The open item, in its file type's page. It shows its own not-found page, inside the
// prototype's navigation, and never renders without its loader's data.
function ItemPage({ data }: { data: ItemData | undefined }) {
  const source = Boolean(data?.source);
  const retained = useRef<ItemData | null>(null);
  if (data?.fileType === 'view' && data.props && !source) retained.current = data;
  const sameArtifact =
    data &&
    retained.current &&
    (data.artifactId ? data.artifactId === retained.current.artifactId : data.filePath === retained.current.filePath);
  const preview = source ? (data?.fileType === 'view' && sameArtifact ? retained.current : null) : data;
  const { toggle, rendered } = useSourceView(
    import.meta.env.DEV && Boolean(data && FILE_TYPES[data.fileType]?.capabilities.source),
    source,
  );
  if (!data) return null;
  const done = (
    <Button size='sm' variant='outline' onClick={toggle} title={`Return to rendered view (${shortcutLabel('source')})`}>
      Done
    </Button>
  );
  const Page = preview && fileTypeModules[preview.fileType].Page;
  // Keep an already-open React runtime alive during source editing. Its module state,
  // viewport and live updates survive; hidden content receives no focus or input.
  return (
    <>
      <div
        ref={rendered}
        tabIndex={source ? undefined : -1}
        inert={source || undefined}
        className={source ? 'hidden' : 'flex min-h-0 min-w-0 flex-1 outline-none'}
      >
        {preview?.unavailable && (
          <div role='status' className='p-8 text-sm'>
            <p>{preview.unavailable}</p>
            {import.meta.env.DEV && (
              <Button className='mt-4' variant='outline' onClick={toggle}>
                Open source
              </Button>
            )}
          </div>
        )}
        {Page && preview?.props && (
          <Suspense fallback={null}>
            <Page {...preview.props} />
          </Suspense>
        )}
      </div>
      {data.source && ArtifactSource && (
        <Suspense fallback={null}>
          <ArtifactSource key={data.source.item.path} {...data.source} actions={done} />
        </Suspense>
      )}
    </>
  );
}

// The routes that open an item in the viewer: one set for a prototype (/prototypes/<person>/<id>) and one for an item
// of a section (/examples/<id>, /systems/<system>/<section>). They do the same thing and are written twice, not made by a
// function, because the router's types need each path written out to check links to it.
const loadProto = async ({ contributor, prototype }: { contributor?: string; prototype: string }) => {
  const proto = await (contributor ? loadPrototype(contributor, prototype) : loadPrototypeByIdentity(prototype));
  if (!proto) throw notFound();
  return { proto };
};
const searchOf = (search: Record<string, unknown>): ItemSearch => ({
  mode: search.mode === 'source' ? 'source' : undefined,
});
const titleOf = ({ loaderData }: { loaderData?: ItemData }) => ({ meta: [{ title: loaderData?.title ?? APP_NAME }] });

// A prototype's, with its navigation around whichever item is open.
const prototypeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'prototypes/$prototype',
  validateSearch: searchOf,
  loader: ({ params }) => loadProto(params),
  component: () => <PrototypeLayout proto={prototypeRoute.useLoaderData().proto} />,
  notFoundComponent: NotFound,
});
const prototypeIndexRoute = createRoute({
  getParentRoute: () => prototypeRoute,
  path: '/',
  beforeLoad: async ({ params, search, location }) => {
    const { proto } = await loadProto(params);
    const item = firstArtifact(proto);
    // Keep the prototype URL as an entry point; copied browser URLs identify
    // the actual artifact. Replace the entry so Back does not redirect again.
    if (item)
      throw redirect({
        to: '/prototypes/$prototype/artifacts/$artifact',
        params: { prototype: params.prototype, artifact: resourceId(item.studioId) },
        search,
        hash: location.hash,
        replace: true,
      });
  },
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }): Promise<ItemData> => itemLoader(params, deps.mode),
  head: titleOf,
  component: () => <ItemPage data={prototypeIndexRoute.useLoaderData()} />,
  notFoundComponent: NotFound,
});
// Resolve an artifact only within its identified parent prototype.
const itemRoute = createRoute({
  getParentRoute: () => prototypeRoute,
  path: 'artifacts/$artifact',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => itemLoader(params, deps.mode),
  head: titleOf,
  component: () => <ItemPage data={itemRoute.useLoaderData()} />,
  notFoundComponent: NotFound,
});

// Only registered module sections use these routes. Old contributor routes fail.
const sectionItemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '$contributor/$prototype',
  beforeLoad: ({ params }) => {
    if (!isSectionKey(params.contributor)) throw notFound();
  },
  validateSearch: searchOf,
  loader: ({ params }) => loadProto(params),
  component: () => <PrototypeLayout proto={sectionItemRoute.useLoaderData().proto} />,
  notFoundComponent: NotFound,
});
const sectionItemIndexRoute = createRoute({
  getParentRoute: () => sectionItemRoute,
  path: '/',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps, cause }): Promise<ItemData> =>
    itemLoader(params, deps.mode, retainedIndexPath(sectionItemIndexRoute.id, cause)),
  head: titleOf,
  component: () => <ItemPage data={sectionItemIndexRoute.useLoaderData()} />,
  notFoundComponent: NotFound,
});
const sectionItemSplatRoute = createRoute({
  getParentRoute: () => sectionItemRoute,
  path: '$',
  loaderDeps: ({ search }) => ({ mode: search.mode }),
  loader: ({ params, deps }) => itemLoader(params, deps.mode),
  head: titleOf,
  component: () => <ItemPage data={sectionItemSplatRoute.useLoaderData()} />,
  notFoundComponent: NotFound,
});

// The app's own routes are typed, so links to them are checked. The modules' routes (Systems, the
// system content, the Manual, in <module folder>/app.tsx) are added at run time, and the types leave
// them out: a link to one is written loosely.
const coreRoutes = [
  homeRoute,
  documentationRoute,
  contextRoute.addChildren([contextIndexRoute, ownerRoute, ownerReferenceRoute, contextPageRoute, contextItemRoute]),
  prototypeRoute.addChildren([prototypeIndexRoute, itemRoute]),
  sectionItemRoute.addChildren([sectionItemIndexRoute, sectionItemSplatRoute]),
] as const;
const routeTree = rootRoute.addChildren([
  ...coreRoutes,
  ...(import.meta.env.DEV ? [settingsRoute] : []),
  ...moduleApps.flatMap(({ app }) => app.routes?.(rootRoute) ?? []),
] as unknown as typeof coreRoutes);

export const router = createRouter({
  routeTree,
  // Browser history: clean URLs; the host must serve index.html for every path (see README, Hosting).
  // No rewrites on your host? Use hash URLs instead (/#/prototypes/<prototype-id>):
  //   import { createHashHistory } from '@tanstack/react-router';
  //   history: createHashHistory(),
  // https://tanstack.com/router/latest/docs/framework/react/manual/history-types
  // A downloaded prototype opens from disk, where only hash URLs work.
  ...(downloaded ? { history: createHashHistory() } : { basepath: import.meta.env.BASE_URL }),
  defaultErrorComponent: LoadError,
  defaultPreload: 'intent',
  // Keep the committed page mounted until all destination loaders and renderers resolve.
  // The persistent shell supplies delayed progress instead of replacing it with a pending page.
  defaultPendingMs: Infinity,
  // Repository notifications explicitly invalidate prepared pages, including cached visits.
  defaultStaleTime: Infinity,
});

// Type-safe Link, useNavigate, useParams, and useSearch everywhere.
// https://tanstack.com/router/latest/docs/framework/react/decisions-on-dx#declaring-the-router-instance-for-type-inference
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// In dev, the manifest updates live as files change (src/platform/node/build/vite-manifest-watch-plugin.js).
// invalidate() reruns the loaders, so lists and navigation update without a page reload.
// https://tanstack.com/router/latest/docs/framework/react/manual/data-loading#using-routerinvalidate
if (import.meta.hot) {
  let refreshAll = false;
  const files = new Set<string>();
  const refresh = createRefreshQueue(
    () => {
      const all = refreshAll;
      const changed = new Set(files);
      refreshAll = false;
      files.clear();
      return router.invalidate({
        filter: match => {
          const data = match.loaderData as { filePath?: string } | undefined;
          return all || Boolean(data?.filePath && changed.has(data.filePath));
        },
      });
    },
    callback => {
      setTimeout(callback, 50);
    },
  );
  const contentChanged = (event: Event) => {
    const changed = (event as CustomEvent<{ files?: string[] }>).detail?.files;
    if (changed) changed.forEach(file => files.add(file));
    else refreshAll = true;
    refresh();
  };
  const stopMutations = onMutation(() => {
    refreshAll = true;
    refresh();
  });
  import.meta.hot.on('studio:moves', (moves: { from: string; to: string; origin?: string }[]) => {
    if (moves[0]?.origin === TAB_ID) return; // FileTree follows its completed reply once.
    const current = router.state.location;
    const prefix = import.meta.env.BASE_URL.replace(/\/$/, '');
    const path = current.pathname.slice(prefix.length);
    const move = moves.find(move => path === move.from) ?? moves.find(move => path.startsWith(move.from + '/'));
    if (move)
      void router.navigate({
        to: (move.to + path.slice(move.from.length)) as never,
        search: current.search as never,
        hash: current.hash,
        replace: true,
      });
  });
  const markdownChanged = (event: Event) => {
    files.add((event as CustomEvent<{ key: string }>).detail.key);
    refresh();
  };
  window.addEventListener('studio:markdown', markdownChanged);
  window.addEventListener('studio:views', contentChanged);
  import.meta.hot.on('studio:file', (file: { contributor: string; prototype: string; path: string }) => {
    files.add('/' + rootOf(file.contributor, file.prototype) + '/' + file.path);
    refresh();
  });
  import.meta.hot.dispose(() => {
    stopMutations();
    window.removeEventListener('studio:views', contentChanged);
    window.removeEventListener('studio:markdown', markdownChanged);
  });
  import.meta.hot.on('studio:manifest', ({ manifest, origin }: { manifest: Manifest; origin?: string }) => {
    if (origin === TAB_ID) return; // this tab made the change and already applied it
    setManifest(manifest);
    refreshAll = true;
    refresh();
  });
}
