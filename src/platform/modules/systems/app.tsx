import { Suspense } from 'react';
// Systems in the app: its rail button, its routes (/systems, /systems/<system>, /systems/<system>/<page>),
// and prototype systems in the ⌘K palette. The pages are in src/platform/modules/systems/pages/.
import { createRoute, Outlet, notFound, redirect, useRouterState, lazyRouteComponent } from '@tanstack/react-router';
import { Shapes01Icon } from '@hugeicons/core-free-icons';
import { CommandGroup, CommandItem, CommandSeparator } from '@/platform/systems/studio/components/command';
import { HomeSection } from '@/platform/app/items/HomeSection';
import { ItemRow } from '@/platform/app/items/ItemRow';
import { getSystem, getSystems, systemKeyFromIdentity, systemPath } from '#studio/systems';
const PROTOTYPE_SYSTEMS = getSystems({ role: 'prototype' });
const SYSTEM_SPECS = getSystems();
import { APP_NAME } from '@/platform/app/data/config';
import { artifactLabel, loadManifest } from '@/platform/app/data/manifest';
import { contentId } from '@/platform/core/roots';
import { prepareContent } from './content/SystemContentPage';
import type { ModuleApp, PaletteContext } from '#studio/ui';

// Loaded on first visit, so it isn't in the main bundle:
// https://tanstack.com/router/latest/docs/framework/react/guide/code-splitting
const SystemsPage = lazyRouteComponent(() => import('@/platform/modules/systems/pages/SystemsPage'));
const SystemsIndex = lazyRouteComponent(() => import('./pages/SystemsIndex'));
function SystemsLayout() {
  const system = useRouterState({ select: state => (state.matches.at(-1)?.params as { system?: string })?.system });
  return <Suspense fallback={null}>{system ? <SystemsPage /> : <Outlet />}</Suspense>;
}
const systemsTitle = (...parts: (string | undefined)[]) =>
  [
    ...parts
      .filter(Boolean)
      .map((p, index, names) =>
        index === names.length - 1 && SYSTEM_SPECS[systemKeyFromIdentity(p) ?? '']
          ? SYSTEM_SPECS[systemKeyFromIdentity(p)!].label
          : artifactLabel(p!),
      ),
    'Systems',
    APP_NAME,
  ].join(' — ');

async function loadSystemPage(params: { system: string; page?: string; _splat?: string }, mode?: 'source') {
  const system = systemKeyFromIdentity(params.system);
  if (!system) {
    // A folder name is how people think of a system: send it to the permanent address.
    if (getSystem(params.system))
      throw redirect({
        href: [systemPath(params.system), params.page, params._splat].filter(Boolean).join('/'),
        replace: true,
      });
    throw notFound();
  }
  // Preload the layout too, so its initial Suspense boundary does not flash blank.
  await SystemsPage.preload?.();
  const manifest = await loadManifest();
  const proto = manifest.systemContent.find(p => p.id === contentId(system, params.page ?? ''));
  if (proto) {
    const contentData = await prepareContent(proto, params._splat, mode);
    return { contentData, filePath: contentData.filePath };
  }
  if (mode === 'source') {
    await (await import('./pages/SystemsPage')).prepareSystemSource();
    return null;
  }
  if (params.page !== 'components' || !params._splat) return null;
  const component = manifest.systems[system]?.components.find(item => item.slug === params._splat);
  if (!component) return null;
  const { loadComponentPage } = await import('./data/loadDocs');
  return { componentKey: system + '/' + component.slug, componentData: await loadComponentPage(system, component) };
}

function SystemsPlaces({ go }: PaletteContext) {
  const pathname = useRouterState({ select: s => s.location.pathname });
  const on = (system: string) => pathname === systemPath(system) || pathname.startsWith(systemPath(system) + '/');
  // The team's own design systems, one entry each. The platform's own system is how the app itself is built, so the
  // palette, which searches the team's content, leaves it out.
  return (
    <>
      {Object.entries(PROTOTYPE_SYSTEMS).map(([id, system]) => (
        <CommandItem
          key={id}
          value={`${system.label} system components`}
          disabled={on(id)}
          onSelect={() => go({ to: systemPath(id) } as never)}
        >
          {system.label} system
        </CommandItem>
      ))}
    </>
  );
}

function SystemsPalette(context: PaletteContext) {
  if (!Object.keys(PROTOTYPE_SYSTEMS).length) return null;
  return (
    <>
      <CommandSeparator />
      <CommandGroup heading='Systems'>
        <SystemsPlaces {...context} />
      </CommandGroup>
    </>
  );
}

// On the front page: a link to the team's design systems, three at most. The platform's own is how the app itself is
// built, so it isn't offered here.
function Overview() {
  const systems = Object.entries(PROTOTYPE_SYSTEMS).slice(0, 3);
  if (!systems.length) return null;
  return (
    <HomeSection title='Systems' to='/systems'>
      <ul>
        {systems.map(([id, s]) => (
          <ItemRow key={id} link={{ to: systemPath(id) }} icon={Shapes01Icon} title={s.label} />
        ))}
      </ul>
    </HomeSection>
  );
}

export default {
  icon: Shapes01Icon,
  rail: 'top',
  order: 20,
  routes: root => {
    const systemsRoute = createRoute({
      getParentRoute: () => root,
      path: 'systems',
      component: SystemsLayout,
      validateSearch: (search: Record<string, unknown>): { mode?: 'source'; q?: string } => ({
        mode: search.mode === 'source' ? 'source' : undefined,
        q: typeof search.q === 'string' && search.q ? search.q : undefined,
      }),
    });
    return [
      systemsRoute.addChildren([
        createRoute({
          getParentRoute: () => systemsRoute,
          path: '/',
          head: () => ({ meta: [{ title: `Systems — ${APP_NAME}` }] }),
          loader: () => SystemsIndex.preload?.(),
          component: () => (
            <Suspense fallback={null}>
              <SystemsIndex />
            </Suspense>
          ),
        }),
        createRoute({
          getParentRoute: () => systemsRoute,
          path: '$system',
          head: ({ params }) => ({ meta: [{ title: systemsTitle(params.system) }] }),
          loaderDeps: ({ search }) => ({ mode: search.mode }),
          loader: ({ params, deps }) => loadSystemPage(params, deps.mode),
        }),
        createRoute({
          getParentRoute: () => systemsRoute,
          path: '$system/$page',
          head: ({ params }) => ({ meta: [{ title: systemsTitle(params.page, params.system) }] }),
          loaderDeps: ({ search }) => ({ mode: search.mode }),
          loader: ({ params, deps }) => loadSystemPage(params, deps.mode),
        }),
        createRoute({
          getParentRoute: () => systemsRoute,
          path: '$system/$page/$',
          head: ({ params }) => ({
            meta: [{ title: systemsTitle(params._splat?.split('/').pop(), params.page, params.system) }],
          }),
          loaderDeps: ({ search }) => ({ mode: search.mode }),
          loader: ({ params, deps }) => loadSystemPage(params, deps.mode),
        }),
      ]),
    ];
  },
  overview: Overview,
  palette: SystemsPalette,
} satisfies ModuleApp;
