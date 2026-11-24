import { FileActionItems } from '@/platform/app/shell/FileActionItems';
// The prototype's files, in its navigation: a filterable tree with expand/collapse all, and a
// "Edit source" in a file's menu, which opens its text in place of its page (the shared platform SourceEditor).
//
// In `pnpm dev`, it's the prototype's real files and folders, live from the dev server
// (data/files.ts). It shows what you open and organize: items (views, at any depth; see
// src/platform/context/file-types.md) and their folders. Everything else in the folder (meta.json, which the header
// edits; _helpers; images and other files) is hidden until you choose Show all
// files (in the header's … menu), and then opens in your editor. In your own prototypes you can also create, rename (F2), move
// (drag and drop), arrange (drag, or Move up and down), and delete (to the Trash) files and folders, like a file browser, and
// arrange artifacts to determine the opening artifact. Every change
// is a plain file change, so agents see the same thing. On the deployed site, it lists the
// prototype's items, from the manifest.
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type ComponentType } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { dropTargetForElements, monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { extractInstruction } from '@atlaskit/pragmatic-drag-and-drop-hitbox/list-item';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  ArrowDown01Icon,
  Cancel01Icon,
  CodeIcon,
  Delete02Icon,
  File01Icon,
  PencilEdit02Icon,
  PaintBoardIcon,
  Search01Icon,
  UnfoldLessIcon,
  UnfoldMoreIcon,
} from '@hugeicons/core-free-icons';
import { allPrototypes, artifactLabel, artifactLink, prototypeLink } from '@/platform/app/data/manifest';
import { useManifest } from '@/platform/app/data/useManifest';
import {
  fileOp,
  openInEditor,
  repoPath,
  revealInFinder,
  setArtifactLofi,
  useFileTree,
  useMe,
  type FileNode,
  type FileOp,
} from '@/platform/app/data/files';
import type { Artifact, Manifest, Prototype } from '@/platform/app/data/types';
import { artifactAvailability, isHelper } from '@/platform/core/fileTypes';
import {
  artifactActions,
  runArtifactAction,
  type ArtifactAction,
  type ArtifactActionContext,
  type ArtifactActionTarget,
} from '@/platform/app/data/fileTypeModule';
import { navIndent, navRow, navRowState } from '@/platform/app/shell/nav';
import { artifactUrl } from '@/platform/app/artifacts/artifactLinks';
import { place } from '@/platform/core/order';
import { DRAG_KIND, DragRow, type Dropped, type Operations } from './DragRow';
import { FILE_TYPES, fileTypeModules } from '@/platform/app/data/fileTypes';
import { useShowAllFiles } from '@/platform/app/shell/appPrefs';
import { Button } from '@/platform/systems/studio/components/button';
import { Input } from '@/platform/systems/studio/components/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/platform/systems/studio/components/tooltip';
import { toast } from '@/platform/systems/studio/components/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/platform/systems/studio/components/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/platform/systems/studio/components/collapsible';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/platform/systems/studio/components/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/platform/systems/studio/components/dialog';
import { menuGroups } from '@/platform/app/shell/menuGroups';
import { cn } from '#studio/runtime';

const row = navRow;
const indent = navIndent;
const parentOf = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const within = (p: string, dir: string) => p === dir || p.startsWith(`${dir}/`);

// The deployed site has no dev server, so the tree is the prototype's items, from the
// manifest, with their folders.
function itemsAsNodes(proto: Prototype): FileNode[] {
  const root: FileNode[] = [];
  for (const item of proto.artifacts) {
    const parts = item.path.split('/');
    let level = root;
    parts.slice(0, -1).forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      let folder = level.find(n => n.dir && n.path === path);
      if (!folder) {
        folder = { name, path, dir: true, children: [] };
        level.push(folder);
      }
      level = folder.children!;
    });
    level.push({ name: parts.at(-1)!, path: item.path, dir: false });
  }
  // The manifest lists items in the prototype's order (src/platform/core/order.ts), so the tree keeps it.
  return root;
}

// The items of a prototype in a manifest.
const itemsOf = (m: Manifest, p: Prototype) =>
  allPrototypes(m).find(x => x.contributorKey === p.contributorKey && x.id === p.id)?.artifacts ?? [];

// While filtering, keep files whose name matches, and folders with a match inside.
function filterNodes(nodes: FileNode[], q: string, searchPrototype?: Prototype): FileNode[] {
  return nodes.flatMap(n => {
    // Owner search includes artifact titles and paths; matching a folder reveals its contents.
    if (
      searchPrototype &&
      (n.path.toLowerCase().includes(q) || artifactLabel(n.path, searchPrototype).toLowerCase().includes(q))
    )
      return [n];
    if (!n.dir) return n.name.toLowerCase().includes(q) || artifactLabel(n.name).toLowerCase().includes(q) ? [n] : [];
    const children = filterNodes(n.children ?? [], q, searchPrototype);
    return children.length || n.name.toLowerCase().includes(q) ? [{ ...n, children }] : [];
  });
}

// What the nav shows by default: items, folders with an item inside, and empty folders (you
// made those to organize, so they stay). Helpers, meta.json, and assets are hidden.
function visibleNodes(nodes: FileNode[], items: Map<string, Artifact>): FileNode[] {
  return nodes.flatMap(n => {
    if (!n.dir) return items.has(n.path) ? [n] : [];
    if (isHelper(n.name)) return [];
    const children = visibleNodes(n.children ?? [], items);
    return children.length || !n.children?.length ? [{ ...n, children }] : [];
  });
}

// The files inside a folder the nav isn't showing, for the delete confirmation.
function hiddenInside(node: FileNode, items: Map<string, Artifact>): string[] {
  const all = (n: FileNode): string[] => (n.dir ? (n.children ?? []).flatMap(all) : [n.path]);
  return all(node)
    .filter(p => !items.has(p))
    .map(p => p.slice(node.path.length + 1));
}

const findNode = (nodes: FileNode[], path: string): FileNode | undefined =>
  nodes.map(n => (n.path === path ? n : n.dir ? findNode(n.children ?? [], path) : undefined)).find(Boolean);

const allDirs = (nodes: FileNode[]): string[] =>
  nodes.flatMap(n => (n.dir ? [n.path, ...allDirs(n.children ?? [])] : []));

// A file name with its extension dimmed: "main" + ".tsx".
function FileName({ name }: { name: string }) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return <span className='min-w-0 flex-1 truncate'>{name}</span>;
  return (
    <span className='min-w-0 flex-1 truncate'>
      {name.slice(0, dot)}
      <span className='text-muted-foreground/70'>{name.slice(dot)}</span>
    </span>
  );
}

// An inline name field, for renaming or creating. Enter or leaving the field saves; Escape cancels.
// The name is selected without its extension, like in Finder.
function NameInput({
  initial,
  depth,
  onDone,
}: {
  initial: string;
  depth: number;
  onDone: (name: string | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const finish = (name: string | null) => {
    if (!done.current) {
      done.current = true;
      onDone(name);
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);
  return (
    <div style={indent(depth)} className='mx-1 py-0.5 pr-1.5'>
      <Input
        ref={ref}
        defaultValue={initial}
        aria-label='Name'
        className='h-6 rounded-sm px-1.5 text-[12px] shadow-none'
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
    </div>
  );
}

// What "+" makes: a folder, or a file of a type (its id, like "view" or "document"). In the system content
// it can also be a plain "file" (inside a skill), or a "skill", which asks for its name first.
type NewTarget = 'folder' | string;

type Editing = { kind: 'rename'; path: string } | { kind: 'create'; parent: string; target: NewTarget } | null;

const iconButton =
  'inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 transition-colors hover:bg-sidebar-foreground/5 hover:text-sidebar-accent-foreground';

function IconButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type='button'
            aria-label={label}
            aria-pressed={pressed}
            onClick={onClick}
            className={cn(iconButton, pressed && 'bg-sidebar-foreground/10 text-sidebar-accent-foreground')}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side='bottom'>{label}</TooltipContent>
    </Tooltip>
  );
}

type TreeNavigation = {
  query: string;
  searching: boolean;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  folderCommand: { version: number; expanded: boolean };
  onFoldersExpanded: (open: boolean) => void;
};
export type NewFileOption = { target: string; label: string; icon: typeof File01Icon };
export type FileTreePolicy = {
  scope: 'prototype' | 'systemContent';
  noun: 'artifacts' | 'files';
  reorder: boolean;
  canChange(proto: Prototype, actor: string | null): boolean;
  newOptions(folder: string, context: { live: boolean; editable: boolean }): NewFileOption[];
  fixed?(node: FileNode): boolean;
  movable?(node: FileNode): boolean;
  canMoveTo?(source: { path: string; dir: boolean }, folder: string): boolean;
  hideFolderControls?: boolean;
  itemForNode?(node: FileNode, items: Map<string, Artifact>): Artifact | undefined;
  bundleItem?(node: FileNode, items: Map<string, Artifact>): Artifact | undefined;
  creationTarget?: string;
  // Actions other modules add to an item's menu; the prototype navigation passes ModuleApp.artifactActions.
  artifactActions?(context: ArtifactActionContext, manifest: Manifest): readonly ArtifactAction[];
  CreationDialog?: ComponentType<{
    proto: Prototype;
    open: boolean;
    onOpenChange(open: boolean): void;
    onCreated(receipt: { manifest: Manifest; path?: string }): void;
  }>;
};
export type FileTreeProps = {
  policy: FileTreePolicy;
  proto: Prototype;
  current: Artifact | undefined;
  embedded?: boolean;
  rememberExpansion?: boolean;
  externalFilter?: { query: string; searching: boolean };
  contentIcon?: ReactNode;
  branch?: { label: string; path: string; active: boolean; defaultExpanded?: boolean };
  navigation?: TreeNavigation;
};

const guidanceBranchState = new Map<string, boolean>();

const folderState = new Map<string, { closed: Set<string>; commandVersion: number }>();

export default function FileTree({
  proto,
  current,
  embedded = false,
  rememberExpansion = false,
  externalFilter,
  contentIcon,
  branch,
  navigation,
  policy,
}: FileTreeProps) {
  const { files, reload } = useFileTree(proto);
  const treeScope = proto.contributorKey + ':' + proto.id;
  const [expanded, setExpanded] = useState(
    () =>
      (rememberExpansion ? guidanceBranchState.get(proto.id) : undefined) ??
      branch?.defaultExpanded ??
      branch?.active ??
      true,
  );
  useEffect(() => {
    if (branch?.active) setExpanded(true);
  }, [branch?.active]);
  useEffect(() => {
    if (rememberExpansion) guidanceBranchState.set(proto.id, expanded);
  }, [rememberExpansion, proto.id, expanded]);
  const branchExpanded = externalFilter?.searching || (navigation?.expanded ?? expanded);
  const changeExpanded = navigation?.onExpandedChange ?? setExpanded;
  const me = useMe();
  const navigate = useNavigate();
  const live = import.meta.env.DEV && files !== null;
  const editable = live && policy.canChange(proto, me);
  const [creationOpen, setCreationOpen] = useState(false);
  const fixed = (node: FileNode) => policy.fixed?.(node) ?? false;
  const newOptions = (folder: string) => policy.newOptions(folder, { live, editable });
  const items = new Map(proto.artifacts.map(i => [i.path, i]));
  const manifest = useManifest();
  const actionTarget = useRef<(path: string) => ArtifactActionTarget | undefined>(() => undefined);
  useLayoutEffect(() => {
    actionTarget.current = path => {
      const item = items.get(path);
      if (!item) return undefined;
      const module = fileTypeModules[item.fileType];
      const context = {
        proto,
        item,
        environment: {
          local: live,
          editable,
          present: true,
          renderer: Boolean(module),
          scope: policy.scope,
        },
      };
      return {
        spec: FILE_TYPES[item.fileType],
        module,
        context,
        contributed: policy.artifactActions?.(context, manifest),
      };
    };
    return () => {
      actionTarget.current = () => undefined;
    };
  });
  // Switched in the header's "…" menu, and remembered for every prototype.
  const [showAll] = useShowAllFiles();
  const nodes = !files ? itemsAsNodes(proto) : showAll ? files : visibleNodes(files, items);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const savedFolders = navigation ? folderState.get(proto.id) : undefined;
  const [closed, setClosed] = useState(() => savedFolders?.closed ?? new Set<string>());
  const commandVersion = useRef(savedFolders?.commandVersion ?? -1);
  const [editing, setEditing] = useState<Editing>(null);
  const [confirmDelete, setConfirmDelete] = useState<FileNode | null>(null);
  const [overTop, setOverTop] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (filterOpen) filterRef.current?.focus();
  }, [filterOpen]);

  const q = (externalFilter?.query ?? navigation?.query ?? filter).trim().toLowerCase();
  const shown = q ? filterNodes(nodes, q, navigation || externalFilter ? proto : undefined) : nodes;
  const dirs = policy.hideFolderControls ? [] : allDirs(nodes);
  // While filtering, every folder with a match shows open.
  const isOpen = (d: string) =>
    Boolean(q) || Boolean(navigation?.searching) || Boolean(externalFilter?.searching) || !closed.has(d);
  const allOpen = dirs.every(d => !closed.has(d));
  const dirSignature = dirs.join('\0');
  useEffect(() => {
    if (navigation && commandVersion.current !== navigation.folderCommand.version) {
      commandVersion.current = navigation.folderCommand.version;
      setClosed(navigation.folderCommand.expanded ? new Set() : new Set(dirs));
    }
  }, [navigation?.folderCommand.version, dirSignature]);
  useEffect(() => {
    if (navigation) folderState.set(proto.id, { closed, commandVersion: commandVersion.current });
  }, [proto.id, closed]);
  useEffect(() => {
    navigation?.onFoldersExpanded(allOpen);
  }, [allOpen]);
  useEffect(() => {
    if (!navigation || !current) return;
    setClosed(previous => {
      const next = new Set(previous);
      const parts = current.path.split('/');
      parts.slice(0, -1).forEach((_, index) => next.delete(parts.slice(0, index + 1).join('/')));
      return next;
    });
  }, [current?.path]);
  const setOpen = (d: string, open: boolean) =>
    setClosed(prev => {
      if (navigation?.searching) return prev;
      const next = new Set(prev);
      if (open) next.delete(d);
      else next.add(d);
      return next;
    });
  // Show all files exposes helpers and assets as well as artifacts.
  const noun = showAll ? 'files' : policy.noun;

  // Runs a change, then takes the new manifest. If it moved or removed the open view, go to
  // its new place (or the prototype's first view) first, so the old address is never reloaded.
  async function run(op: FileOp) {
    // What a delete removed, named the way the tree shows it, for the message after.
    const base = 'path' in op ? (op.path.split('/').pop() ?? '') : '';
    const deleted =
      op.op === 'delete'
        ? findNode(files ?? [], op.path)?.dir || items.has(op.path)
          ? artifactLabel(base)
          : base
        : '';
    try {
      const result = await fileOp(proto, op);
      const open = current?.path;
      if (
        open &&
        (op.op === 'rename' ||
          op.op === 'move' ||
          op.op === 'delete' ||
          (op.op === 'reorder' && result.path !== op.path)) &&
        within(open, op.path)
      ) {
        const moved = result.path && `${result.path}${open.slice(op.path.length)}`;
        const next = moved && itemsOf(result.manifest, proto).find(i => i.path === moved);
        await navigate(next ? artifactLink(proto, next) : prototypeLink(proto));
      }
      reload();
      if (result.trashedTo) {
        toast.add({
          title: `Moved “${deleted}” to ${result.trashedTo === 'the Trash' ? 'the Trash' : `${result.trashedTo} (no Trash on this computer)`}`,
        });
      } else if (result.relinkedFiles?.length) {
        toast.add({ title: op.op === 'rename' ? 'Renamed. References updated.' : 'Moved. References updated.' });
      }
      return result;
    } catch (e) {
      const message = (e as Error).message;
      // The name may belong to a file the nav is hiding.
      const clash = message.match(/“(.+?)”/)?.[1];
      const named = (list: FileNode[], name: string): boolean =>
        list.some(n => n.name === name || named(n.children ?? [], name));
      const hint =
        clash && files && named(files, clash) && !named(nodes, clash)
          ? " It's hidden: choose Show all files in the … menu."
          : '';
      toast.add({ type: 'error', title: message + hint });
    }
  }

  // Switches a view to lofi or back (for a type with `fidelity`): its file carries the marker.
  async function setLofi(item: Artifact, on: boolean) {
    try {
      await setArtifactLofi(proto, item.path, on, FILE_TYPES[item.fileType].fidelity!);
    } catch (e) {
      toast.add({ type: 'error', title: (e as Error).message });
    }
  }

  const startCreate = (parent: string, target: NewTarget) => {
    setExpanded(true);
    if (target === policy.creationTarget) {
      setCreationOpen(true);
      return;
    }
    if (parent) setOpen(parent, true);
    setEditing({ kind: 'create', parent, target });
  };
  function created(receipt: { manifest: Manifest; path?: string }) {
    reload();
    setCreationOpen(false);
    const item = receipt.path && itemsOf(receipt.manifest, proto).find(item => item.path === receipt.path);
    if (item) navigate(artifactLink(proto, item));
  }

  // Drag and drop (DragRow.tsx): drag a row before or after another, or into a folder. Order is saved
  // in meta.json (src/platform/core/order.ts). The owner policy controls movement and ordering.
  const movable = (node: FileNode) =>
    editable && node.path !== 'meta.json' && !fixed(node) && (policy.movable?.(node) ?? true);
  const canMoveTo = (source: { path: string; dir: boolean }, folder: string) =>
    policy.canMoveTo?.(source, folder) ?? true;
  // What dropping `source` on a row may do. A folder that's open has its contents below it, so "after" it is inside it.
  const operationsFor =
    (target: FileNode, open: boolean) =>
    (source: { path: string; dir: boolean }): Operations => {
      const ordering = policy.reorder && !q;
      return {
        combine:
          target.dir && parentOf(source.path) !== target.path && canMoveTo(source, target.path)
            ? 'available'
            : 'not-available',
        'reorder-before': ordering ? 'available' : 'not-available',
        'reorder-after': ordering && !(target.dir && open) ? 'available' : 'not-available',
      };
    };
  const siblingsOf = (path: string) => (parentOf(path) ? findNode(nodes, parentOf(path))?.children : nodes) ?? [];
  // Puts `path` before `before` (a path in the same folder, or '' for last), in that folder or `to`.
  function arrange(path: string, to: string, before: string) {
    const sibs = to === parentOf(path) ? siblingsOf(path).map(n => n.path) : null;
    if (sibs && place(sibs, path, before).every((p, i) => p === sibs[i])) return;
    run({ op: 'reorder', path, to, before });
  }
  function drop(path: string, target: string | null, operation: Dropped) {
    if (target === null) {
      // the empty space below the tree: the top level, last
      if (!policy.reorder) run({ op: 'move', path, to: '' });
      else arrange(path, '', '');
      return;
    }
    if (operation === 'combine') {
      run({ op: 'move', path, to: target });
      return;
    }
    const parent = parentOf(target);
    const others = (parent ? (findNode(nodes, parent)?.children ?? []) : nodes)
      .map(n => n.path)
      .filter(p => p !== path);
    arrange(path, parent, operation === 'reorder-before' ? target : (others[others.indexOf(target) + 1] ?? ''));
  }
  const dropRef = useRef(drop);
  dropRef.current = drop;
  useEffect(() => {
    const list = listRef.current;
    if (!editable || !list) return;
    const dragged = (source: { data: Record<string, unknown> }) =>
      source.data.kind === DRAG_KIND && source.data.scope === treeScope;
    const stops = [
      dropTargetForElements({
        element: list,
        canDrop: ({ source }) =>
          dragged(source) && canMoveTo({ path: String(source.data.path), dir: Boolean(source.data.dir) }, ''),
        onDrag: ({ location }) => setOverTop(location.current.dropTargets[0]?.element === list),
        onDragLeave: () => setOverTop(false),
        onDrop: () => setOverTop(false),
      }),
      monitorForElements({
        canMonitor: ({ source }) => dragged(source),
        onDrop: ({ source, location }) => {
          const target = location.current.dropTargets[0];
          if (!target || (target.element !== list && target.data.scope !== treeScope)) return;
          const path = String(source.data.path);
          if (target.element === list) {
            dropRef.current(path, null, 'combine');
            return;
          }
          const instruction = extractInstruction(target.data);
          if (instruction && !instruction.blocked)
            dropRef.current(path, String(target.data.path), instruction.operation);
        },
      }),
    ];
    return () => stops.forEach(stop => stop());
  }, [editable, policy, treeScope]);

  // Move up or down: the same as dragging, from the keyboard (Option + arrow).
  const moves = (node: FileNode) => {
    const sibs = siblingsOf(node.path);
    const at = sibs.findIndex(n => n.path === node.path);
    const can = editable && policy.reorder && !q && node.path !== 'meta.json' && at >= 0;
    return {
      up: can && at > 0 ? () => arrange(node.path, parentOf(node.path), sibs[at - 1].path) : null,
      down:
        can && at < sibs.length - 1 ? () => arrange(node.path, parentOf(node.path), sibs[at + 2]?.path ?? '') : null,
    };
  };

  // F2 renames, Delete (or ⌘⌫) moves to the Trash, on the focused row.
  const keyProps = (node: FileNode) =>
    editable && node.path !== 'meta.json' && !fixed(node)
      ? {
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'F2') {
              e.preventDefault();
              setEditing({ kind: 'rename', path: node.path });
            }
            if (e.key === 'Delete' || (e.key === 'Backspace' && e.metaKey)) {
              e.preventDefault();
              setConfirmDelete(node);
            }
            if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
              const move = e.key === 'ArrowUp' ? moves(node).up : moves(node).down;
              if (move) {
                e.preventDefault();
                move();
              }
            }
          },
        }
      : {};

  // Called as functions, not rendered as components, so rows keep their identity across
  // renders (a drag in progress would be cancelled otherwise).
  // Menu actions run after the menu has closed, so a dialog or field they open isn't
  // dismissed by the same click.
  function rowMenu(key: string, node: FileNode, children: ReactNode) {
    // Authoring actions need a local studio; explicitly public module actions can also appear in a published menu.
    const local = import.meta.env.DEV && live;
    const changeable = local && editable && node.path !== 'meta.json' && !fixed(node);
    const menuItem = policy.itemForNode ? policy.itemForNode(node, items) : items.get(node.path);
    const environment = {
      local,
      editable,
      present: Boolean(menuItem),
      renderer: Boolean(menuItem && fileTypeModules[menuItem.fileType]),
      scope: policy.scope,
      systemMissing: proto.systemMissing,
    };
    const spec = menuItem && FILE_TYPES[menuItem.fileType];
    const available = artifactAvailability(spec, environment);
    const actionContext = menuItem ? { proto, item: menuItem, environment } : undefined;
    const actions = actionContext
      ? artifactActions(
          spec,
          fileTypeModules[menuItem!.fileType],
          actionContext,
          policy.artifactActions?.(actionContext, manifest),
        )
      : [];
    if (!local && !actions.some(({ action }) => !action.localOnly && !action.mutates))
      return <div key={key}>{children}</div>;
    return (
      <ContextMenu key={key}>
        <ContextMenuTrigger>{children}</ContextMenuTrigger>
        <ContextMenuContent className='min-w-44'>
          {/* Groups, in this order, with a line between them (the prototype's menu follows the same rule,
              PrototypeHeader.tsx): make something here; reach it (open it elsewhere, then copy where it is);
              change it; delete it, last and alone. A group with nothing in it leaves no line. */}
          {menuGroups<ReactNode>([
            node.dir && editable
              ? newOptions(node.path).map(o => (
                  <ContextMenuItem key={o.target} onClick={() => setTimeout(() => startCreate(node.path, o.target))}>
                    <HugeiconsIcon icon={o.icon} /> {o.label}
                  </ContextMenuItem>
                ))
              : [],
            [
              <FileActionItems
                key='file-actions'
                path={repoPath(proto, node.path)}
                href={menuItem ? artifactUrl(proto, menuItem) : undefined}
                edit={
                  menuItem && available.source.available
                    ? () => {
                        void navigate({ ...artifactLink(proto, menuItem), search: { mode: 'source' } } as never);
                      }
                    : undefined
                }
                sourceShortcut
                sourceLabel={available.editSource.available ? 'Edit source' : 'View source'}
                open={local && !node.dir ? () => openInEditor(proto, node.path) : undefined}
                reveal={local ? () => revealInFinder(proto, node.path) : undefined}
              />,
            ],
            [
              available.fidelity.available && (
                <ContextMenuItem
                  key='lofi'
                  onClick={() => setTimeout(() => setLofi(items.get(node.path)!, !items.get(node.path)!.lofi))}
                >
                  <HugeiconsIcon icon={PaintBoardIcon} /> {items.get(node.path)?.lofi ? 'Make hi-fi' : 'Make lo-fi'}
                </ContextMenuItem>
              ),
              ...actions.map(({ action, availability }) => (
                <ContextMenuItem
                  key={action.id}
                  disabled={!availability.available}
                  title={availability.available ? undefined : availability.reason}
                  onClick={() => {
                    if (!availability.available || !actionContext) return;
                    setTimeout(() => {
                      Promise.resolve()
                        .then(() =>
                          runArtifactAction(action.id, () => {
                            const latest = actionTarget.current(menuItem!.path);
                            return latest?.context.item.studioId === menuItem!.studioId &&
                              latest?.context.item.fileType === menuItem!.fileType
                              ? latest
                              : undefined;
                          }),
                        )
                        .catch(error =>
                          toast.add({
                            type: 'error',
                            title: error instanceof Error ? error.message : 'Artifact action failed.',
                          }),
                        );
                    });
                  }}
                >
                  {action.icon && <HugeiconsIcon icon={action.icon} />} {action.label}
                </ContextMenuItem>
              )),
              changeable && (
                <ContextMenuItem
                  key='rename'
                  onClick={() => setTimeout(() => setEditing({ kind: 'rename', path: node.path }))}
                >
                  <HugeiconsIcon icon={PencilEdit02Icon} /> Rename
                </ContextMenuItem>
              ),
            ],
            [
              changeable && (
                <ContextMenuItem
                  key='delete'
                  variant='destructive'
                  onClick={() => setTimeout(() => setConfirmDelete(node))}
                >
                  <HugeiconsIcon icon={Delete02Icon} /> Delete
                </ContextMenuItem>
              ),
            ],
          ]).map((group, i) => (
            <Fragment key={i}>
              {i > 0 && <ContextMenuSeparator />}
              {group}
            </Fragment>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  // The creation field accepts a name; the selected artifact type owns its extension.
  // Plain files and folders keep their names as entered.
  const createField = (parent: string, depth: number) => {
    if (editing?.kind !== 'create' || editing.parent !== parent) return null;
    const { target } = editing;
    const dir = target === 'folder';
    const extension = FILE_TYPES[target]?.extensions[0] ?? '';
    const initial = dir ? 'new-folder' : target === 'file' ? 'new-file' : 'untitled';
    return (
      <NameInput
        initial={initial}
        depth={depth}
        onDone={name => {
          setEditing(null);
          if (!name) return;
          const fileName = name + extension;
          run({ op: 'create', path: parent, name: fileName, dir }).then(r => {
            // A new item opens right away.
            const item = r?.path && itemsOf(r.manifest, proto).find(i => i.path === r.path);
            if (item) navigate(artifactLink(proto, item));
          });
        }}
      />
    );
  };

  function rows(list: FileNode[], depth: number): ReactNode {
    return list.map(node => {
      if (editing?.kind === 'rename' && editing.path === node.path) {
        return (
          <NameInput
            key={node.path}
            initial={node.name}
            depth={depth}
            onDone={name => {
              setEditing(null);
              if (name && name !== node.name) run({ op: 'rename', path: node.path, name });
            }}
          />
        );
      }
      if (node.dir) {
        const bundled = policy.bundleItem?.(node, items);
        if (bundled) {
          return (
            <Fragment key={node.path}>
              {rowMenu(
                node.path,
                node,
                <Link
                  {...artifactLink(proto, bundled)}
                  {...keyProps(node)}
                  aria-current={current && within(current.path, node.path) ? 'page' : undefined}
                  style={indent(depth)}
                  className={cn(row, navRowState(Boolean(current && within(current.path, node.path))))}
                >
                  {contentIcon ?? (
                    <HugeiconsIcon
                      icon={fileTypeModules[bundled.fileType]?.icon ?? CodeIcon}
                      size={14}
                      className='shrink-0 text-muted-foreground'
                    />
                  )}
                  <span className='min-w-0 flex-1 truncate' title={repoPath(proto, bundled.path)}>
                    {artifactLabel(bundled.path, proto)}
                  </span>
                </Link>,
              )}
              {createField(node.path, depth)}
            </Fragment>
          );
        }
        const open = isOpen(node.path);
        return (
          <Collapsible
            key={node.path}
            open={open}
            onOpenChange={o => setOpen(node.path, o)}
            className='mt-1.5 first:mt-0'
          >
            <div className='flex flex-col gap-0.5 rounded-md'>
              <DragRow
                scope={treeScope}
                path={node.path}
                dir
                canDrag={movable(node)}
                operationsFor={operationsFor(node, open)}
              >
                {rowMenu(
                  node.path,
                  node,
                  <CollapsibleTrigger
                    draggable={false}
                    {...keyProps(node)}
                    style={indent(depth)}
                    className={cn(row, 'text-left font-medium text-sidebar-foreground hover:bg-sidebar-foreground/5')}
                  >
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={14}
                      className={cn('shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
                    />
                    <span className='min-w-0 flex-1 truncate' title={live ? node.name : undefined}>
                      {artifactLabel(node.name)}
                    </span>
                  </CollapsibleTrigger>,
                )}
              </DragRow>
              <CollapsibleContent className='flex flex-col gap-0.5'>
                {createField(node.path, depth + 1)}
                {rows(node.children ?? [], depth + 1)}
              </CollapsibleContent>
            </div>
          </Collapsible>
        );
      }
      const item = items.get(node.path);
      // Items and folders show readable names ("user-settings.tsx" → "User Settings"), like the
      // rest of the app; the file name is in the tooltip and the rename field. Other files, shown
      // with Show all files (in the header's … menu), keep their real names, since they open in your editor.
      const label = item ? (
        <span className='min-w-0 flex-1 truncate' title={live ? node.name : undefined}>
          {artifactLabel(node.path, proto)}
        </span>
      ) : (
        <FileName name={node.name} />
      );
      // Items open in the app.
      if (item) {
        const active = item === current;
        return (
          <DragRow
            scope={treeScope}
            key={node.path}
            path={node.path}
            dir={false}
            canDrag={movable(node)}
            url={artifactUrl(proto, item)}
            operationsFor={operationsFor(node, false)}
          >
            {rowMenu(
              node.path,
              node,
              <Link
                {...artifactLink(proto, item)}
                draggable={false} // the row is what drags (DragRow.tsx), not the link
                {...keyProps(node)}
                aria-current={active ? 'page' : undefined}
                style={indent(depth)}
                className={cn(row, navRowState(active))}
              >
                {contentIcon ?? (
                  <HugeiconsIcon
                    icon={fileTypeModules[item.fileType]?.icon ?? CodeIcon}
                    size={14}
                    className='shrink-0 text-muted-foreground'
                  />
                )}
                {label}
              </Link>,
            )}
          </DragRow>
        );
      }
      // Everything else (meta.json, _components/, images) opens in your editor.
      return (
        <DragRow
          scope={treeScope}
          key={node.path}
          path={node.path}
          dir={false}
          canDrag={movable(node)}
          operationsFor={operationsFor(node, false)}
        >
          {rowMenu(
            node.path,
            node,
            <button
              type='button'
              title='Open in editor'
              onClick={() => openInEditor(proto, node.path)}
              draggable={false}
              {...keyProps(node)}
              style={indent(depth)}
              className={cn(
                row,
                'text-left text-muted-foreground hover:bg-sidebar-foreground/5 hover:text-sidebar-accent-foreground',
              )}
            >
              <HugeiconsIcon icon={File01Icon} size={14} className='shrink-0 opacity-70' />
              {label}
            </button>,
          )}
        </DragRow>
      );
    });
  }

  if (navigation?.query && !shown.length && !editing) return null;

  return (
    <nav
      className={cn(
        'group/tree flex min-h-0 flex-col',
        branch ? 'gap-0.5' : 'space-y-1.5 px-2 pt-3 pb-3',
        !embedded && 'flex-1 overflow-y-auto',
      )}
    >
      <div
        className={cn(
          'flex h-7 shrink-0 items-center justify-between gap-1 pr-0.5',
          branch ? 'mx-1 rounded-md pl-2 hover:bg-sidebar-foreground/5' : 'pl-2.5',
        )}
      >
        {branch ? (
          <button
            type='button'
            aria-expanded={branchExpanded}
            onClick={() => changeExpanded(!branchExpanded)}
            title={branch.path}
            className='flex h-full min-w-0 flex-1 items-center gap-1.5 text-left text-[12px] font-medium leading-tight'
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={14}
              className={cn('shrink-0 text-muted-foreground transition-transform', !branchExpanded && '-rotate-90')}
            />
            <span className='truncate'>{branch.label}</span>
          </button>
        ) : (
          <p className='min-w-0 flex-1 truncate text-[12px] font-semibold leading-none'>
            {showAll || policy.noun === 'files' ? 'Files' : 'Artifacts'}
          </p>
        )}
        {/* Shown while the pointer is over the list or focus is in it, so the heading stays quiet. */}
        {!navigation && !externalFilter && (
          <div
            className={cn(
              'flex items-center gap-0.5 transition-opacity',
              !filterOpen && 'opacity-0 group-hover/tree:opacity-100 group-focus-within/tree:opacity-100',
            )}
          >
            <IconButton
              label='Filter'
              pressed={filterOpen}
              onClick={() => {
                setExpanded(true);
                if (filterOpen) setFilter('');
                setFilterOpen(o => !o);
              }}
            >
              <HugeiconsIcon icon={Search01Icon} size={14} />
            </IconButton>
            {dirs.length > 0 && (
              <IconButton
                label={allOpen ? 'Collapse all' : 'Expand all'}
                onClick={() => setClosed(allOpen ? new Set(dirs) : new Set())}
              >
                <HugeiconsIcon icon={allOpen ? UnfoldLessIcon : UnfoldMoreIcon} size={14} />
              </IconButton>
            )}
          </div>
        )}
        {/* Making things is here, with the file actions, and offers what the open folder holds: a prototype's
            file types and folders, or what a SystemContent section allows. It's always shown, and last, so the actions
            that fade in and out sit to its left without moving it. It's the main action, and a folder can be
            empty. With one thing to make (a skill), it's made directly. */}
        {editable &&
          (() => {
            const options = newOptions('');
            if (options.length === 1) {
              return (
                <IconButton label='New' onClick={() => startCreate('', options[0].target)}>
                  <HugeiconsIcon icon={Add01Icon} size={14} />
                </IconButton>
              );
            }
            return (
              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger render={<DropdownMenuTrigger aria-label='New' className={iconButton} />}>
                    <HugeiconsIcon icon={Add01Icon} size={14} />
                  </TooltipTrigger>
                  <TooltipContent side='bottom'>New</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align='end' className='min-w-40'>
                  {options.map(o => (
                    <DropdownMenuItem key={o.target} onClick={() => setTimeout(() => startCreate('', o.target))}>
                      <HugeiconsIcon icon={o.icon} /> {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })()}
      </div>
      <div hidden={branch && !branchExpanded} className={branch ? 'pl-5' : undefined}>
        {!navigation && !externalFilter && filterOpen && (
          <div className='relative shrink-0 px-1'>
            <Input
              ref={filterRef}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              onKeyDown={e => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                if (filter) setFilter('');
                else setFilterOpen(false);
              }}
              placeholder={`Filter ${noun}`}
              aria-label={`Filter ${noun}`}
              className={cn('h-8 border-sidebar-border bg-sidebar-accent text-[13px] shadow-none', filter && 'pr-8')}
            />
            {filter && (
              <button
                type='button'
                aria-label='Clear filter'
                onClick={() => setFilter('')}
                className='absolute top-1/2 right-3 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:text-sidebar-foreground'
              >
                <HugeiconsIcon icon={Cancel01Icon} size={12} />
              </button>
            )}
          </div>
        )}
        {/* The whole list is the drop target for the top level (the end of it). */}
        <div
          ref={listRef}
          className={cn('flex min-h-0 flex-1 flex-col gap-0.5 rounded-md', overTop && 'bg-sidebar-foreground/5')}
        >
          {branch && !q && !shown.length && !editing && (
            <p className='px-3 py-1 text-[12px] text-muted-foreground'>Empty folder</p>
          )}
          {q && shown.length === 0 && (
            <p className='px-2.5 py-1 text-[12px] text-muted-foreground'>No matching {noun}.</p>
          )}
          {createField('', 0)}
          {rows(shown, 0)}
        </div>
      </div>
      {policy.CreationDialog && (
        <policy.CreationDialog proto={proto} open={creationOpen} onOpenChange={setCreationOpen} onCreated={created} />
      )}

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={o => {
          if (!o) setConfirmDelete(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              Delete “
              {confirmDelete &&
                (confirmDelete.dir || items.has(confirmDelete.path)
                  ? artifactLabel(confirmDelete.name)
                  : confirmDelete.name)}
              ”?
            </DialogTitle>
            <DialogDescription>
              {confirmDelete?.dir ? 'The folder and everything in it move' : 'It moves'} to the Trash, where you can
              restore it.
              {confirmDelete?.dir &&
                !showAll &&
                (() => {
                  const full = findNode(files ?? [], confirmDelete.path);
                  const hidden = full ? hiddenInside(full, items) : [];
                  if (!hidden.length) return null;
                  const names = [...new Set(hidden.map(p => (p.includes('/') ? `${p.split('/')[0]}/` : p)))];
                  return ` This includes ${hidden.length} ${hidden.length === 1 ? 'file' : 'files'} not shown in the nav: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''}.`;
                })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant='destructive'
              onClick={() => {
                const node = confirmDelete;
                setConfirmDelete(null);
                if (node) run({ op: 'delete', path: node.path });
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </nav>
  );
}
