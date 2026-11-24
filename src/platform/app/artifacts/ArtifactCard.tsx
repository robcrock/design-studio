// How an item appears where it can't be shown itself (on a canvas, for a type with no embed):
// its icon, name and type, and a link that opens it. `missing` is for a link that points at
// nothing, and `elsewhere` for one into another prototype.
import { Link } from '@tanstack/react-router';
import { HugeiconsIcon } from '@hugeicons/react';
import { FileNotFoundIcon } from '@hugeicons/core-free-icons';
import { FILE_TYPES, fileTypeModules } from '@/platform/app/data/fileTypes';
import { artifactLabel, artifactLink } from '@/platform/app/data/manifest';
import type { Artifact, Prototype } from '@/platform/app/data/types';
import { cn } from '#studio/runtime';

export const ITEM_CARD_HEIGHT = 88;

export default function ArtifactCard({
  proto,
  item,
  elsewhere = false,
  className,
  message,
}: {
  proto?: Prototype;
  item?: Artifact;
  elsewhere?: boolean;
  className?: string;
  message?: string;
}) {
  const icon = item && fileTypeModules[item.fileType]?.icon;
  const found = proto && item;
  const reason = message;
  return (
    // A frame like EmbedFrame's, so on a canvas its Open link takes the click (canvas.css) and the rest moves the canvas.
    <div
      data-canvas-frame=''
      style={{ minHeight: ITEM_CARD_HEIGHT }}
      className={cn(
        'flex h-full w-full items-center gap-3 overflow-hidden rounded-xl border border-border bg-background px-4 text-left',
        className,
        message,
      )}
    >
      <span className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground'>
        <HugeiconsIcon icon={found && icon ? icon : FileNotFoundIcon} size={20} />
      </span>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-semibold text-foreground'>
          {found ? artifactLabel(item.path) : elsewhere ? 'Another prototype' : 'Not found'}
        </div>
        <div
          className='truncate text-xs text-muted-foreground'
          title={
            elsewhere
              ? 'A canvas shows only its own prototype. Copy the view into this prototype, then link that.'
              : reason
          }
        >
          {found
            ? (reason ?? FILE_TYPES[item.fileType]?.label ?? 'File')
            : reason
              ? reason
              : elsewhere
                ? 'A canvas shows only its own prototype. Copy the view here.'
                : // On the deployed site a missing file may be archived work, which it leaves out (src/platform/core/archive.ts).
                  import.meta.env.DEV
                  ? 'This file was moved or deleted. Ask your agent to fix the link.'
                  : 'Not on this site. It may be archived. Run the sandbox locally to see it.'}
        </div>
      </div>
      {found && (
        <Link
          {...artifactLink(proto, item)}
          data-open
          className='shrink-0 rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted'
        >
          Open
        </Link>
      )}
    </div>
  );
}
