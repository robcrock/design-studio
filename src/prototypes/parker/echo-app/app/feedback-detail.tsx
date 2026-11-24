/** @studio-id gjmx07ngsdvvnq3s */
// Screen 2 of 3: one piece of feedback. Change its status and priority, add notes, edit it, or delete it.
// The feedback inbox opens this screen with the item it was on. Opened directly (or shown on a canvas), it
// shows the newest item instead of an empty page. DetailScreen takes optional starting state, so the
// files in states/ can show it with the edit dialog or the delete confirmation open.
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@module/prototypes';
import { ArrowLeft, Pencil, Trash2 } from '@/systems/product/libraries/icons';
import { Badge } from '@/systems/product/components/badge';
import { Button } from '@/systems/product/components/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/systems/product/components/dialog';
import { Label } from '@/systems/product/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/systems/product/components/select';
import { Separator } from '@/systems/product/components/separator';
import { Textarea } from '@/systems/product/components/textarea';
import AppShell from './_components/AppShell';
import CompanyLogo from './_components/CompanyLogo';
import FeedbackForm from './_components/FeedbackForm';
import { PriorityLabel, StatusLabel } from './_components/badges';
import { PRIORITIES, STATUSES, addNote, formatDate, formatMrr, removeFeedback, updateFeedback, useFeedback, useStore, type Priority, type Status } from './_components/store';

// One row of the properties panel: a quiet label on the left, the value on the right, as in the table's columns.
function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-8 grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// Status and priority change in place, shown with the same marks as the table.
const quietTrigger = '-ml-2 h-8 w-[calc(100%+0.5rem)] border-transparent bg-transparent px-2 shadow-none hover:bg-muted dark:bg-transparent dark:hover:bg-muted';

export function DetailScreen({ editing: startEditing = false, deleting: startDeleting = false }: { editing?: boolean; deleting?: boolean }) {
  const { selectedId, items } = useStore();
  const item = useFeedback(selectedId) ?? items[0];
  const [editing, setEditing] = useState(startEditing);
  const [deleting, setDeleting] = useState(startDeleting);
  const [note, setNote] = useState('');
  const navigate = useNavigate();

  const back = (
    <Link to="app/feedback-inbox" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Feedback inbox</Link>
  );

  if (!item) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-8 py-8">
          {back}
          <div className="rounded-md border border-dashed border-border px-6 py-14 text-center">
            <p className="text-sm font-medium">No feedback to show</p>
            <p className="mt-1 text-sm text-muted-foreground">Add some in the feedback inbox, or reset the sample data.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-8 py-8">
        {back}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="min-w-0">
            <header className="mb-6 flex items-start justify-between gap-4">
              <h1 className="text-xl font-semibold tracking-tight">{item.title}</h1>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(true)}><Pencil /></Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(true)}><Trash2 /></Button>
              </div>
            </header>

            <section className="rounded-md border border-border bg-card">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2.5 text-sm whitespace-nowrap">
                <CompanyLogo company={item.company} className="size-5 rounded-[5px] [&_svg]:size-3.5" />
                <span className="font-medium">{item.customer}</span>
                {item.company && <span className="text-muted-foreground">at {item.company}</span>}
                <span className="ml-auto text-muted-foreground">via {item.source} · {formatDate(item.createdAt)}</span>
              </div>
              <div className="px-4 py-4">
                <p className="text-sm leading-relaxed">{item.body || 'No details were added.'}</p>
                {item.tags.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{item.tags.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}</div>}
              </div>
            </section>

            <section className="mt-8">
              <h2 className="mb-3 text-sm font-semibold">Notes</h2>
              {item.notes.length > 0 ? (
                <ul className="mb-4 space-y-4 border-l border-border pl-4">
                  {item.notes.map((n) => (
                    <li key={n.id}>
                      <p className="text-sm">{n.text}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(n.at)}</p>
                    </li>
                  ))}
                </ul>
              ) : <p className="mb-4 text-sm text-muted-foreground">No notes yet.</p>}
              <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (note.trim()) { addNote(item.id, note.trim()); setNote(''); } }}>
                <Label htmlFor="note" className="sr-only">Add a note</Label>
                <Textarea id="note" rows={3} value={note} placeholder="Add a note: what did you find out, or decide?" onChange={(e) => setNote(e.target.value)} />
                <div className="flex justify-end"><Button type="submit" size="sm" disabled={!note.trim()}>Add note</Button></div>
              </form>
            </section>
          </div>

          <aside className="self-start">
            <h2 className="mb-2 text-xs text-muted-foreground">Properties</h2>
            <div className="grid gap-1">
              <Property label="Status">
                <Select items={STATUSES} value={item.status} onValueChange={(v) => v && updateFeedback(item.id, { status: v as Status })}>
                  <SelectTrigger aria-label="Status" className={quietTrigger}><SelectValue>{(v: Status) => <StatusLabel status={v} />}</SelectValue></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s.value} value={s.value}><StatusLabel status={s.value} /></SelectItem>)}</SelectContent>
                </Select>
              </Property>
              <Property label="Priority">
                <Select items={PRIORITIES} value={item.priority} onValueChange={(v) => v && updateFeedback(item.id, { priority: v as Priority })}>
                  <SelectTrigger aria-label="Priority" className={quietTrigger}><SelectValue>{(v: Priority) => <PriorityLabel priority={v} />}</SelectValue></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}><PriorityLabel priority={p.value} /></SelectItem>)}</SelectContent>
                </Select>
              </Property>
            </div>
            <Separator className="my-4" />
            <div className="grid gap-1">
              <Property label="Customer">
                <span className="flex items-center gap-2"><CompanyLogo company={item.company} className="size-5 rounded-[5px] [&_svg]:size-3.5" /><span className={item.company ? 'truncate' : 'truncate text-muted-foreground'}>{item.company || 'No account'}</span></span>
              </Property>
              <Property label="Contact"><span className="block truncate">{item.customer}</span></Property>
              <Property label="Plan">{item.plan}</Property>
              <Property label="MRR"><span className="tabular-nums">{item.mrr > 0 ? `${formatMrr(item.mrr)} a month` : <span className="text-muted-foreground">-</span>}</span></Property>
              <Property label="Source">{item.source}</Property>
              <Property label="Received"><span className="tabular-nums">{formatDate(item.createdAt)}</span></Property>
            </div>
          </aside>
        </div>
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit feedback</DialogTitle><DialogDescription>Fix a typo or add what you learned.</DialogDescription></DialogHeader>
          <FeedbackForm
            initial={{ title: item.title, body: item.body, customer: item.customer, source: item.source, priority: item.priority }}
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            onSubmit={(input) => { updateFeedback(item.id, input); setEditing(false); }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete this feedback?</DialogTitle><DialogDescription>“{item.title}” and its notes will be removed. Reset the sample data to get it back.</DialogDescription></DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { removeFeedback(item.id); setDeleting(false); navigate('app/feedback-inbox'); }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default function Detail() {
  return <DetailScreen />;
}
