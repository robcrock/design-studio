import { cn } from '#studio/runtime';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/systems/product/components/tooltip';
import { PRIORITIES, STATUSES, type Priority, type Status } from './store';

// Compact marks for dense lists, in the Linear manner: signal bars for priority, a circle that fills as
// feedback moves along for status. The words stay available to screen readers.
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const level = { low: 1, medium: 2, high: 3 }[priority];
  const label = PRIORITIES.find((p) => p.value === priority)?.label;
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={`${label} priority`} className={cn('size-4 shrink-0', priority === 'high' ? 'text-destructive' : 'text-muted-foreground', className)}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={10 - i * 3.5} width="3" height={4 + i * 3.5} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export function StatusIcon({ status, className }: { status: Status; className?: string }) {
  const tone = { new: 'text-muted-foreground', triaged: 'text-foreground/70', planned: 'text-primary', resolved: 'text-muted-foreground' }[status];
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn('size-4 shrink-0', tone, className)}>
      {status === 'new' && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />}
      {status === 'triaged' && <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" /></>}
      {status === 'planned' && <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></>}
      {status === 'resolved' && <><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m5.2 8.2 1.9 1.9 3.7-3.9" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

export function StatusLabel({ status }: { status: Status }) {
  return (
    <span className="flex items-center gap-2 text-sm leading-5">
      <StatusIcon status={status} />
      {STATUSES.find((s) => s.value === status)?.label}
    </span>
  );
}

// The priority bars with their word on hover, for lists where the bars stand alone.
export function PriorityTip({ priority }: { priority: Priority }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex w-fit" />}><PriorityIcon priority={priority} /></TooltipTrigger>
      <TooltipContent>{PRIORITIES.find((p) => p.value === priority)?.label} priority</TooltipContent>
    </Tooltip>
  );
}

export function PriorityLabel({ priority }: { priority: Priority }) {
  return (
    <span className="flex items-center gap-2 text-sm leading-5">
      <PriorityIcon priority={priority} />
      {PRIORITIES.find((p) => p.value === priority)?.label}
    </span>
  );
}
