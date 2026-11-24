// The top of the prototype navigation: everything about the prototype, in one place.
// Its title and a "…" menu (also on right-click). Making new things is in the file tree below.
// In dev, the menu edits or deletes your prototypes; double-click the title to rename.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Archive02Icon, MoreHorizontalIcon, ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { useShowAllFiles } from '@/platform/app/shell/appPrefs';
import type { Prototype } from '@/platform/app/data/types';
import { Input } from '@/platform/systems/studio/components/input';
import { toast } from '@/platform/systems/studio/components/toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/platform/systems/studio/components/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@/platform/systems/studio/components/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/platform/systems/studio/components/dropdown-menu';
import { useRenamePrototype } from '@/platform/modules/prototypes/viewer/useRenamePrototype';
import { usePrototypeActions, type Action } from '@/platform/modules/prototypes/viewer/usePrototypeActions';
import { downloaded } from '@/platform/app/data/downloaded';
import { NavHeader } from '@/platform/app/shell/nav';
import { menuGroups } from '@/platform/app/shell/menuGroups';
import { Link } from '@tanstack/react-router';
import PrototypeRebuildNotice from './PrototypeRebuildNotice';
import { getSystems, systemPath } from '#studio/systems';
const PROTOTYPE_SYSTEMS = getSystems({ role: 'prototype' });

// The title, renamed in place: Enter or leaving the field saves, Escape cancels.
function TitleInput({ initial, onDone }: { initial: string; onDone: (title: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (t: string | null) => {
    if (!done.current) {
      done.current = true;
      onDone(t);
    }
  };
  useEffect(() => {
    ref.current?.select();
  }, []);
  return (
    <Input
      ref={ref}
      defaultValue={initial}
      aria-label='Prototype title'
      className='h-7 rounded-sm px-1.5 text-sm font-semibold shadow-none'
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value.trim());
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={e => finish(e.currentTarget.value.trim())}
    />
  );
}

export default function PrototypeHeader({ proto }: { proto: Prototype }) {
  const applyRename = useRenamePrototype(proto);
  const actions = usePrototypeActions(proto);
  const { local, editable } = actions;
  const [renaming, setRenaming] = useState(false);
  const [showAll, toggleShowAll] = useShowAllFiles();
  const system = proto.system === null ? undefined : PROTOTYPE_SYSTEMS[proto.system];

  async function rename(title: string | null) {
    setRenaming(false);
    if (!title || title === proto.title) return;
    try {
      await applyRename({ title });
    } catch (e) {
      toast.add({ type: 'error', title: (e as Error).message });
    }
  }

  // Groups, in this order, with a line between them (the file menu follows the same rule, FileTree.tsx):
  // how this panel looks; reach the prototype (open it elsewhere, then copy where it is); change it;
  // delete it, last and alone. A group with nothing in it leaves no line. The last three are shared
  // with the prototype's card (usePrototypeActions.ts).
  const [reach, change, remove] = actions.groups;
  const groups = menuGroups<Action>([
    [
      local &&
        proto.status !== 'archived' && {
          label: showAll ? 'Hide other files' : 'Show all files',
          icon: showAll ? ViewOffSlashIcon : ViewIcon,
          onSelect: toggleShowAll,
        },
      ...actions.display,
    ],
    reach,
    change,
    remove,
  ]);
  // Actions run after the menu has closed, so a dialog they open isn't closed by the same click.
  const menuItems = (
    Item: typeof DropdownMenuItem | typeof ContextMenuItem,
    Separator: typeof DropdownMenuSeparator,
    Shortcut: typeof DropdownMenuShortcut | typeof ContextMenuShortcut,
  ) =>
    groups.map((group, g) => (
      <Fragment key={g}>
        {g > 0 && <Separator />}
        {group.map(a => (
          <Item
            key={a.label}
            variant={a.destructive ? 'destructive' : 'default'}
            onClick={() => setTimeout(a.onSelect)}
          >
            <HugeiconsIcon icon={a.icon} /> {a.label}
            {a.shortcut && <Shortcut>{a.shortcut}</Shortcut>}
          </Item>
        ))}
      </Fragment>
    ));

  // Right-click anywhere on the header opens the same menu, in dev.
  const withContextMenu = (children: ReactNode) =>
    !local || !groups.length ? (
      children
    ) : (
      <ContextMenu>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className='min-w-44'>
          {menuItems(ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut)}
        </ContextMenuContent>
      </ContextMenu>
    );

  return (
    <NavHeader className='pb-0'>
      {withContextMenu(
        <div className='pl-3 pr-2.5'>
          <div className='-mr-2 flex min-h-8 items-center gap-0.5'>
            {renaming ? (
              <div className='min-w-0 flex-1'>
                <TitleInput initial={proto.title} onDone={rename} />
              </div>
            ) : (
              <h2
                className='min-w-0 flex-1 truncate text-sm font-semibold leading-tight'
                title={editable && proto.status !== 'archived' ? 'Double-click to rename' : proto.title}
                onDoubleClick={editable && proto.status !== 'archived' ? () => setRenaming(true) : undefined}
              >
                {proto.title}
              </h2>
            )}
            {groups.length > 0 && (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <DropdownMenuTrigger
                        aria-label='Prototype actions'
                        className='inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-accent-foreground'
                      />
                    }
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={14} />
                  </TooltipTrigger>
                  <TooltipContent side='bottom'>Prototype actions</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align='end' className='min-w-44'>
                  {menuItems(DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className='mt-1 mb-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground'>
            <span>System ·</span>
            {system && downloaded ? (
              <span>{system.label}</span>
            ) : system ? (
              <Link
                to={systemPath(proto.system!) as never}
                className='min-w-0 truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring'
                aria-label={`Open ${system.label} system`}
              >
                {system.label} ↗
              </Link>
            ) : proto.system === null ? (
              <span title='This prototype uses its own components and CSS'>None</span>
            ) : (
              <span title={`Assigned system: ${proto.system}`}>System unavailable</span>
            )}
          </div>
          <PrototypeRebuildNotice proto={proto} />
          {proto.status === 'archived' && (
            <p
              className='mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground'
              title='The deployed site leaves this prototype out'
            >
              <HugeiconsIcon icon={Archive02Icon} size={12} /> Archived
            </p>
          )}
        </div>,
      )}
      {actions.dialogs}
    </NavHeader>
  );
}
