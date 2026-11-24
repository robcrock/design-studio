// The ⌘K palette's dialog. It loads shortly after the app starts (CommandPalette.tsx), so cmdk
// isn't in the main bundle.
import { Fragment, type RefObject } from 'react';
import { getRouteApi, useMatches, useMatchRoute, useNavigate, type NavigateOptions } from '@tanstack/react-router';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/platform/systems/studio/components/command';
import { moduleApps, type PaletteContext } from '@/platform/app/modules';
import type { Artifact, Prototype } from '@/platform/app/data/types';

const rootApi = getRouteApi('__root__');

export default function CommandPaletteDialog({
  open,
  setOpen,
  returnFocus,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  returnFocus: RefObject<HTMLElement | null>;
}) {
  const manifest = rootApi.useLoaderData();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  const go = (to: NavigateOptions) => {
    returnFocus.current = null;
    setOpen(false);
    navigate(to);
  };

  // What's open is what the routes loaded (router.tsx), so the palette never resolves an address itself.
  const loaded = useMatches().map(
    match => match.loaderData as { proto?: Prototype; artifactId?: string; artifactPath?: string } | undefined,
  );
  const openProto = loaded.find(data => data?.proto)?.proto;
  const current =
    openProto &&
    (manifest.prototypes.find(p => p.contributorKey === openProto.contributorKey && p.id === openProto.id) as
      | Prototype
      | undefined);
  const openItem = loaded.find(data => data?.artifactPath);
  const isOpen = (item: Artifact) =>
    openItem?.artifactId ? item.studioId === openItem.artifactId : item.path === openItem?.artifactPath;
  const onHome = Boolean(matchRoute({ to: '/' }));
  const context: PaletteContext = { manifest, current, isOpen, go };

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        finalFocus={() => {
          const target = returnFocus.current;
          // Restore this opening's origin after the modal releases focus containment.
          // Never fall back to the dialog library's older focus history.
          queueMicrotask(() => {
            const active = document.activeElement;
            // A pointer dismissal that already focused another control keeps that focus.
            if (target?.isConnected && (active === document.body || active?.closest('[data-slot="dialog-content"]'))) {
              target.focus({ preventScroll: true });
            }
          });
          return false;
        }}
      >
        <Command>
          <CommandInput placeholder='Search the studio' />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>

            <CommandGroup heading='Places'>
              <CommandItem value='home overview' disabled={onHome} onSelect={() => go({ to: '/' })}>
                Home
              </CommandItem>
              {import.meta.env.DEV && (
                <CommandItem
                  value='studio settings configuration modules contributors admins'
                  onSelect={() => go({ to: '/settings' } as never)}
                >
                  Studio settings
                </CommandItem>
              )}
              {moduleApps.map(({ spec, app }) => app.places && <app.places key={spec.id} {...context} />)}
            </CommandGroup>

            {[...moduleApps]
              .sort((a, b) => (a.app.paletteOrder ?? a.app.order) - (b.app.paletteOrder ?? b.app.order))
              .map(
                ({ spec, app }) =>
                  app.palette && (
                    <Fragment key={spec.id}>
                      <app.palette {...context} />
                    </Fragment>
                  ),
              )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
