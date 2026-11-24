// Echo's mark: a dot with two widening arcs, a sound and its echo. It draws in currentColor.
export default function EchoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="7" cy="12" r="3.5" fill="currentColor" />
      <path d="M13 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M17.5 3.5a11.5 11.5 0 0 1 0 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
