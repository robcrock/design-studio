// The Echo app's priority bars and status circles (echo-app/app/_components/badges.tsx), copied because a prototype imports
// only its own files. They keep the website's pictures of the app in step with the app itself.
export type Status = 'New' | 'Triaged' | 'Planned' | 'Resolved';
export type Priority = 'High' | 'Medium' | 'Low';

export function PriorityIcon({ priority }: { priority: Priority }) {
  const level = { Low: 1, Medium: 2, High: 3 }[priority];
  return (
    <svg viewBox="0 0 16 16" role="img" aria-label={`${priority} priority`} width="16" height="16" style={{ flex: 'none', color: priority === 'High' ? '#e5484d' : 'var(--muted)' }}>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={2 + i * 4.5} y={10 - i * 3.5} width="3" height={4 + i * 3.5} rx="1" fill="currentColor" opacity={i < level ? 1 : 0.25} />
      ))}
    </svg>
  );
}

export function StatusIcon({ status }: { status: Status }) {
  const color = { New: 'var(--muted)', Triaged: 'var(--color-text-secondary)', Planned: 'var(--brand)', Resolved: 'var(--muted)' }[status];
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" width="16" height="16" style={{ flex: 'none', color }}>
      {status === 'New' && <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.4 2.2" />}
      {status === 'Triaged' && <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" /></>}
      {status === 'Planned' && <><circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="8" cy="8" r="3" fill="currentColor" /></>}
      {status === 'Resolved' && <><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="m5.2 8.2 1.9 1.9 3.7-3.9" fill="none" stroke="var(--surface)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>}
    </svg>
  );
}

export function StatusLabel({ status, className }: { status: Status; className?: string }) {
  return <span className={className} style={{ display: 'flex', alignItems: 'center', gap: 8 }}><StatusIcon status={status} />{status}</span>;
}
