// What you can do to a prototype or section item from a menu: the prototype's "…" menu in its navigation
// (PrototypeHeader.tsx) and the "…" on its card (PrototypeCardMenu.tsx) share this, so they offer the same
// things. Reaching it (copy its link; locally, open it in your editor) is open to everyone. Changing it
// (rename, duplicate, archive, delete, and whatever a module adds, like publish) is only for its owner, or the maintainers
// of an item in a module's section (ownsPrototype). That only decides what is shown: the dev server checks
// ownership again on every change.
import { useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import {
  Archive02Icon,
  ArchiveRestoreIcon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  FileEditIcon,
  Folder01Icon,
  Link01Icon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons';
import {
  downloadPrototype,
  fileOp,
  openInEditor,
  ownsPrototype,
  repoPath,
  revealInFinder,
  useMe,
} from '@/platform/app/data/files';
import { downloaded } from '@/platform/app/data/downloaded';
import { isSectionKey } from '@/platform/core/roots';
import { prototypeLink } from '@/platform/app/data/manifest';
import type { PrototypeInfo } from '@/platform/app/data/types';
import { moduleApps } from '@/platform/app/modules';
import { toast } from '@/platform/systems/studio/components/toast';
import RenamePrototypeDialog from '@/platform/modules/prototypes/viewer/RenamePrototypeDialog';
import DuplicatePrototypeDialog from '@/platform/modules/prototypes/viewer/DuplicatePrototypeDialog';
import DeletePrototypeDialog from '@/platform/modules/prototypes/viewer/DeletePrototypeDialog';
type Icon = typeof Link01Icon;

export type Action = { label: string; icon: Icon; onSelect: () => void; destructive?: boolean; shortcut?: string };

export function usePrototypeActions(proto: PrototypeInfo) {
  const router = useRouter();
  const me = useMe();
  // import.meta.env.DEV is false in the build, so editing isn't in the deployed site.
  const local = import.meta.env.DEV && me !== null;
  const editable = local && ownsPrototype(proto, me);
  const archived = proto.status === 'archived';
  // What the modules add. Their hooks run in a fixed order, because the modules that are on never change while the app runs.
  const contributed = moduleApps.flatMap(
    ({ app }) => app.useActions?.(proto, { editable: editable && !archived }) ?? [],
  );
  // How the open prototype shows: only its navigation's menu offers these (PrototypeHeader.tsx).
  const display = archived ? [] : contributed.filter(action => action.display);
  const [renaming, setRenaming] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Archiving leaves the whole prototype out of the deployed site. Here it stays, marked, so it can be opened and brought back.
  async function setArchived(archived: boolean) {
    try {
      await fileOp(proto, { op: 'meta', status: archived ? 'archived' : 'active' });
      toast.add({ title: archived ? 'Archived. The deployed site leaves it out.' : 'Restored' });
    } catch (e) {
      toast.add({ type: 'error', title: (e as Error).message });
    }
  }

  // A prototype as one HTML file for someone without Studio. The build takes a few seconds.
  const download = () =>
    void toast
      .promise(downloadPrototype(proto), {
        loading: { title: 'Downloading', type: 'loading' },
        success: { title: 'Download ready' },
        error: (e: unknown) => ({
          title: e instanceof Error ? e.message : "Couldn't download this prototype.",
          type: 'error',
        }),
      })
      .catch(() => {});

  const copyLink = () => {
    const href = router.buildLocation(prototypeLink(proto)).href;
    navigator.clipboard.writeText(new URL(href, location.origin).href);
    toast.add({ title: 'Link copied' });
  };

  // The groups of a menu, in the order they appear (see menuGroups.ts): reach it; change it; delete it, last and alone.
  const groups: (Action | false)[][] = archived
    ? [
        [],
        [editable && { label: 'Restore', icon: ArchiveRestoreIcon, onSelect: () => setArchived(false) }],
        [editable && { label: 'Delete', icon: Delete02Icon, onSelect: () => setDeleting(true), destructive: true }],
      ]
    : [
        [
          local && { label: 'Open in editor', icon: FileEditIcon, onSelect: () => openInEditor(proto, '') },
          local && { label: 'Reveal in Finder', icon: Folder01Icon, onSelect: () => revealInFinder(proto, '') },
          // A downloaded prototype has no address to share.
          !downloaded && { label: 'Copy link', icon: Link01Icon, onSelect: copyLink },
          local && {
            label: 'Copy path',
            icon: Copy01Icon,
            onSelect: () => {
              navigator.clipboard.writeText(repoPath(proto, ''));
              toast.add({ title: 'Path copied' });
            },
          },
          // Anyone running Studio can download any prototype; it needs the dev server, not ownership.
          import.meta.env.DEV &&
            !isSectionKey(proto.contributorKey) && { label: 'Download', icon: Download01Icon, onSelect: download },
        ],
        [
          editable && { label: 'Rename', icon: PencilEdit02Icon, onSelect: () => setRenaming(true) },
          editable &&
            proto.contributorKey === me && {
              label: 'Duplicate',
              icon: Copy01Icon,
              onSelect: () => setDuplicating(true),
            },
          editable && { label: 'Archive', icon: Archive02Icon, onSelect: () => setArchived(true) },
          ...contributed.filter(action => !action.display),
        ],
        [editable && { label: 'Delete', icon: Delete02Icon, onSelect: () => setDeleting(true), destructive: true }],
      ];

  // The dialogs those actions open. Render them anywhere under the menu.
  const dialogs: ReactNode = editable ? (
    <>
      <RenamePrototypeDialog proto={proto} open={renaming} onOpenChange={setRenaming} />
      <DuplicatePrototypeDialog
        key={String(duplicating)}
        proto={proto}
        open={duplicating}
        onOpenChange={setDuplicating}
      />
      <DeletePrototypeDialog proto={proto} open={deleting} onOpenChange={setDeleting} />
    </>
  ) : null;

  return { local, editable, groups, display, dialogs };
}
