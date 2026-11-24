import { useCallback, useState } from 'react';
import { HeadContent, Outlet, useRouterState } from '@tanstack/react-router';
import MainNav from '@/platform/app/shell/MainNav';
import { TooltipProvider } from '@/platform/systems/studio/components/tooltip';
import { Toaster } from '@/platform/systems/studio/components/toast';
import { CommandPaletteProvider } from '@/platform/app/shell/CommandPalette';
import { MODULES } from '@/platform/app/data/modules';
import { downloaded } from '@/platform/app/data/downloaded';
import {
  SectionNavContext,
  SectionNavPresenceContext,
  useColorMode,
  useSectionNav,
} from '@/platform/app/shell/appPrefs';

import NavigationProgress from './NavigationProgress';

// The root route's layout: the rail, the current page, and the ⌘K palette.
export default function App() {
  const { colorMode, toggleColorMode } = useColorMode();
  const sectionNav = useSectionNav();
  // How many section navigations are on the page (each SectionNav registers itself), so the rail
  // offers its hide/show toggle exactly when there is one.
  const [navs, setNavs] = useState(0);
  const registerNav = useCallback((present: boolean) => setNavs(n => n + (present ? 1 : -1)), []);
  // A standalone item (a standalone section item, /examples/<id>) on the deployed site fills the window like an app: no rail,
  // no navigation. (Locally it keeps them, so you can still edit it.)
  // A downloaded prototype has no rest of the studio to navigate to.
  const standaloneApp = useRouterState({
    select: s =>
      downloaded ||
      (!import.meta.env.DEV &&
        MODULES.some(m => m.section?.standalone && s.location.pathname.startsWith(`/${m.section.key}/`))),
  });

  return (
    <TooltipProvider>
      <HeadContent />
      <SectionNavContext.Provider value={sectionNav.open}>
        <SectionNavPresenceContext.Provider value={registerNav}>
          <CommandPaletteProvider>
            <div className='flex h-dvh overflow-hidden'>
              {!standaloneApp && (
                <MainNav
                  colorMode={colorMode}
                  onToggleColorMode={toggleColorMode}
                  sectionNav={navs > 0 ? sectionNav : null}
                />
              )}
              <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-auto overscroll-contain'>
                <Outlet />
              </div>
            </div>
          </CommandPaletteProvider>
        </SectionNavPresenceContext.Provider>
      </SectionNavContext.Provider>
      <NavigationProgress />
      <Toaster />
    </TooltipProvider>
  );
}
