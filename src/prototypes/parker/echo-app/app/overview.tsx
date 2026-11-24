/** @studio-id 0qd3s4spbfcpbb2j */
// Screen 1 of 3: the overview, where you land. The key numbers are at the top, and each one is a link:
// click it and you're in the feedback table, already filtered to those items. Below are two small
// breakdowns and the newest feedback. Everything is computed from the same data as the table, so it
// changes when you add, edit, or delete.
import { useDialKit } from '@module/dialkit';
import { Link, useNavigate } from '@module/prototypes';
import { ArrowRight } from '@/systems/product/libraries/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/systems/product/components/card';
import AppShell from './_components/AppShell';
import { PriorityTip, StatusLabel } from './_components/badges';
import { STATUSES, formatDate, formatMrr, select, showFiltered, useStore, type Feedback, type Filter } from './_components/store';
import CompanyLogo from './_components/CompanyLogo';

type MetricStyle = { padding: number; valueSize: number };

function Metric({ label, value, hint, filter, look }: { label: string; value: number; hint: string; filter: Filter; look: MetricStyle }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => { showFiltered(filter); navigate('app/feedback-inbox'); }}
      className="group/metric rounded-xl border border-border bg-card text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
      style={{ padding: look.padding }}
    >
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        {label}
        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover/metric:text-primary group-hover/metric:opacity-100" />
      </div>
      <div className="mt-1 font-semibold tabular-nums" style={{ fontSize: look.valueSize, lineHeight: 1.2 }}>{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </button>
  );
}

// Accounts with open feedback, largest first: who is asking, and what they are worth.
function Accounts({ items }: { items: Feedback[] }) {
  const byCompany = new Map<string, { mrr: number; count: number }>();
  for (const f of items) {
    if (!f.company || f.status === 'resolved') continue;
    const a = byCompany.get(f.company) ?? { mrr: f.mrr, count: 0 };
    byCompany.set(f.company, { ...a, count: a.count + 1 });
  }
  const rows = [...byCompany].sort((a, b) => b[1].mrr - a[1].mrr).slice(0, 4);
  return (
    <ul className="space-y-3">
      {rows.map(([company, a]) => (
        <li key={company} className="flex items-center gap-3 text-sm">
          <CompanyLogo company={company} className="size-6 [&_svg]:size-4" />
          <span className="flex-1 truncate">{company}</span>
          <span className="w-16 text-muted-foreground tabular-nums">{a.count} open</span>
          <span className="w-16 tabular-nums">{formatMrr(a.mrr)}</span>
        </li>
      ))}
    </ul>
  );
}

function Bars({ rows, height }: { rows: { label: string; count: number }[]; height: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[5.5rem_1fr_1.5rem] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="rounded-full bg-muted" style={{ height }}><span className="block rounded-full bg-primary" style={{ height, width: `${(r.count / max) * 100}%` }} /></span>
          <span className="text-right tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Overview() {
  const { items } = useStore();
  const navigate = useNavigate();
  const open = items.filter((f) => f.status !== 'resolved');
  const newest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  // An example of DialKit: the metric tiles and the breakdown bars are dials. Tune them, then save them to code to keep them.
  const metrics = useDialKit('Metrics', {
    gap: [16, 0, 40, 2],
    padding: [16, 8, 32, 2],
    valueSize: [30, 20, 48, 1],
  });
  const bars = useDialKit('Bars', { height: [8, 2, 20, 1] });
  const { gap, ...look } = metrics;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-8">
        <header className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        </header>

        <div className="mb-6 grid grid-cols-2 lg:grid-cols-4" style={{ gap }}>
          <Metric label="Open issues" value={open.length} hint="Not resolved yet" filter={{ status: 'open', priority: null }} look={look} />
          <Metric label="New" value={items.filter((f) => f.status === 'new').length} hint="Waiting to be triaged" filter={{ status: 'new', priority: null }} look={look} />
          <Metric label="High priority" value={open.filter((f) => f.priority === 'high').length} hint="Open and high priority" filter={{ status: 'open', priority: 'high' }} look={look} />
          <Metric label="Resolved" value={items.filter((f) => f.status === 'resolved').length} hint="Closed out" filter={{ status: 'resolved', priority: null }} look={look} />
        </div>

        <div className="mb-6 grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>By status</CardTitle></CardHeader><CardContent><Bars height={bars.height} rows={STATUSES.map((s) => ({ label: s.label, count: items.filter((f) => f.status === s.value).length }))} /></CardContent></Card>
          <Card><CardHeader><CardTitle>Accounts asking</CardTitle></CardHeader><CardContent><Accounts items={items} /></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Newest</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {newest.map((f) => (
                <li key={f.id}>
                  <button type="button" className="grid h-11 w-full grid-cols-[1rem_minmax(0,1fr)_6.5rem_4rem] items-center gap-3 text-left text-sm hover:text-primary lg:grid-cols-[1rem_minmax(0,1fr)_6.5rem_10rem_4rem]" onClick={() => { select(f.id); navigate('app/feedback-detail'); }}>
                    <PriorityTip priority={f.priority} />
                    <span className="truncate font-medium">{f.title}</span>
                    <StatusLabel status={f.status} />
                    <span className="hidden min-w-0 items-center gap-2 text-muted-foreground lg:flex"><CompanyLogo company={f.company} className="size-5 rounded-[5px] [&_svg]:size-3.5" /><span className="truncate">{f.company}</span></span>
                    <span className="text-muted-foreground tabular-nums">{formatDate(f.createdAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
            <Link to="app/feedback-inbox" onClick={() => showFiltered({ status: 'all', priority: null })} className="mt-3 inline-block text-sm font-medium text-primary hover:underline">See all feedback</Link>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
