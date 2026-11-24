// Each sample account's logo: a made-up mark on its brand color, so the tables read like a real CRM
// rather than a list of initials. Drawn in SVG, so nothing is fetched and it stays sharp at any size.
import type { ReactNode } from 'react';
import { cn } from '#studio/runtime';

const marks: Record<string, { color: string; mark: ReactNode }> = {
  'Arcadia Bank': { color: '#0f766e', mark: <path d="M6 17V12a6 6 0 0 1 12 0v5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" /> },
  Brightline: { color: '#d97706', mark: <path d="M6 16 18 8M6 11l7-4.5M11 17.5l7-4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /> },
  Fieldnote: { color: '#15803d', mark: <path d="M7 17c0-6 4-10 10-10 0 6-4 10-10 10Zm0 0 5-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none" /> },
  'Kestrel Health': { color: '#e11d48', mark: <path d="M12 6.5v11M6.5 12h11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /> },
  'Northwind Labs': { color: '#4338ca', mark: <path d="M12 6 18 17H6z" fill="currentColor" /> },
  'Orbit Freight': { color: '#0284c7', mark: <><circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="2.2" fill="none" /><circle cx="17" cy="8" r="2" fill="currentColor" /></> },
  'Parcel & Co': { color: '#92400e', mark: <path d="M6.5 8.5 12 6l5.5 2.5v7L12 18l-5.5-2.5zM6.5 8.5 12 11l5.5-2.5M12 11v7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" fill="none" /> },
  Tandem: { color: '#7c3aed', mark: <><circle cx="9.5" cy="12" r="4" fill="currentColor" opacity=".6" /><circle cx="14.5" cy="12" r="4" fill="currentColor" /></> },
};

export default function CompanyLogo({ company, className }: { company: string; className?: string }) {
  const brand = marks[company];
  if (!brand)
    return <span aria-hidden="true" className={cn('size-7 shrink-0 rounded-md border border-dashed border-border', className)} />;
  return (
    <span aria-hidden="true" className={cn('flex size-7 shrink-0 items-center justify-center rounded-md', className)} style={{ background: brand.color, color: '#fff' }}>
      <svg viewBox="0 0 24 24" className="size-5">{brand.mark}</svg>
    </span>
  );
}
