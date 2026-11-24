// The frame every screen shares: a top bar and a page. A top bar, not a sidebar, because the app is shown inside Studio, which has
// its own sidebars: the page keeps the full width. Screens are separate files so each has its own address, and this keeps them
// looking like one product.
import type { ReactNode } from 'react';
import { Avatar, AvatarFallback } from '@/systems/product/components/avatar';
import { Button } from '@/systems/product/components/button';
import { TooltipProvider } from '@/systems/product/components/tooltip';
import { cn } from '#studio/runtime';
import { Link } from '@module/prototypes';
import EchoMark from './EchoMark';
import { useIsOn } from './nav';
import { NO_FILTER, resetData, showFiltered, useStore } from './store';

function NavItem({ to, count, children, onClick }: { to: string; count?: number; children: ReactNode; onClick?: () => void }) {
  const on = useIsOn(to);
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn('flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground', on && 'bg-muted text-foreground')}
    >
      {children}
      {count !== undefined && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
    </Link>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { items } = useStore();
  const open = items.filter((f) => f.status !== 'resolved');
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-8">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><EchoMark className="size-4" /></span>
            <span className="text-sm font-semibold">Echo</span>
          </div>
          <nav className="flex gap-1">
            <NavItem to="app/overview">Overview</NavItem>
            <NavItem to="app/feedback-inbox" count={open.length} onClick={() => showFiltered(NO_FILTER)}>Feedback inbox</NavItem>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={resetData}>Reset sample data</Button>
            <Avatar size="sm"><AvatarFallback>SR</AvatarFallback></Avatar>
          </div>
        </div>
      </header>
      <main className="min-w-0 flex-1"><TooltipProvider delay={300}>{children}</TooltipProvider></main>
    </div>
  );
}
