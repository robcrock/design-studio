// The sample data, kept in memory so the three screens share it. Creating, editing, and deleting
// feedback in one screen shows up in the others, and reloading the page resets everything. This is
// plain React (useSyncExternalStore), no libraries: a prototype only needs enough "backend" to feel real.
import { createContext, useContext, useSyncExternalStore } from 'react';

export type Status = 'new' | 'triaged' | 'planned' | 'resolved';
export type Priority = 'low' | 'medium' | 'high';
export type Source = 'Email' | 'Chat' | 'Interview' | 'Survey';

export const STATUSES: { value: Status; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'planned', label: 'Planned' },
  { value: 'resolved', label: 'Resolved' },
];
export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
export const SOURCES: { value: Source; label: string }[] = [
  { value: 'Email', label: 'Email' },
  { value: 'Chat', label: 'Chat' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Survey', label: 'Survey' },
];

export type Note = { id: string; text: string; at: string };
export type Feedback = {
  id: string;
  title: string;
  body: string;
  customer: string;
  company: string;  // the customer's account; empty when unknown
  mrr: number;      // the account's monthly revenue in dollars, 0 when unknown or free
  plan: string;
  source: Source;
  priority: Priority;
  status: Status;
  tags: string[];
  createdAt: string;
  notes: Note[];
};

const seed = (): Feedback[] => [
  { id: 'f1', title: 'Export to CSV is missing columns', body: 'When I export the table, the owner and last-updated columns are not included. I rebuild them by hand every week for my report.', customer: 'Maya Chen', company: 'Northwind Labs', mrr: 4200, plan: 'Team', source: 'Email', priority: 'high', status: 'new', tags: ['export', 'tables'], createdAt: '2026-09-28T09:12:00Z', notes: [] },
  { id: 'f2', title: 'Dark mode makes the status badges hard to read', body: 'The yellow and green badges blur together at night. I can tell them apart only by their labels.', customer: 'Luis Ortega', company: 'Brightline', mrr: 1850, plan: 'Business', source: 'Chat', priority: 'medium', status: 'triaged', tags: ['dark mode', 'accessibility'], createdAt: '2026-09-27T16:40:00Z', notes: [{ id: 'n1', text: 'Checked contrast: both badges fail AA in dark mode.', at: '2026-09-28T10:05:00Z' }] },
  { id: 'f3', title: 'Let me bulk-assign items to a teammate', body: 'After a research sprint I have thirty items to hand off. Assigning them one at a time takes a while.', customer: 'Priya Nair', company: 'Kestrel Health', mrr: 12400, plan: 'Business', source: 'Interview', priority: 'high', status: 'planned', tags: ['bulk actions'], createdAt: '2026-09-25T11:03:00Z', notes: [] },
  { id: 'f4', title: 'Search should look inside the description', body: 'I remember a phrase from a customer quote but search only matches titles.', customer: 'Tom Becker', company: 'Fieldnote', mrr: 860, plan: 'Team', source: 'Survey', priority: 'medium', status: 'new', tags: ['search'], createdAt: '2026-09-26T08:30:00Z', notes: [] },
  { id: 'f5', title: 'Notification emails link to the wrong page', body: 'The link in the weekly digest opens the dashboard, not the item it mentions.', customer: 'Aiko Tanaka', company: 'Parcel & Co', mrr: 0, plan: 'Free', source: 'Email', priority: 'low', status: 'resolved', tags: ['email'], createdAt: '2026-09-20T13:20:00Z', notes: [{ id: 'n2', text: 'Fixed in the 2.4 release. Replied to the customer.', at: '2026-09-24T15:00:00Z' }] },
  { id: 'f6', title: 'I cannot tell which items are mine', body: 'The list shows everyone’s items. A "mine" filter would save me a lot of scrolling.', customer: 'Dana Whitfield', company: 'Orbit Freight', mrr: 6300, plan: 'Business', source: 'Chat', priority: 'medium', status: 'triaged', tags: ['filters'], createdAt: '2026-09-24T09:45:00Z', notes: [] },
  { id: 'f7', title: 'Keyboard shortcut for creating a new item', body: 'I live in the keyboard. A shortcut like N to create would be great.', customer: 'Omar Haddad', company: 'Tandem', mrr: 1200, plan: 'Team', source: 'Survey', priority: 'low', status: 'new', tags: ['keyboard'], createdAt: '2026-09-23T17:10:00Z', notes: [] },
  { id: 'f8', title: 'Import from a spreadsheet drops line breaks', body: 'Multi-line descriptions come in as one long line after an import.', customer: 'Sofia Rossi', company: 'Arcadia Bank', mrr: 18900, plan: 'Enterprise', source: 'Email', priority: 'high', status: 'planned', tags: ['import'], createdAt: '2026-09-22T10:00:00Z', notes: [] },
  { id: 'f9', title: 'Weekly digest should group by account', body: 'The digest lists items one by one. I want to see which accounts asked for what, so I can brief their CSMs.', customer: 'Hannah Weiss', company: 'Kestrel Health', mrr: 12400, plan: 'Enterprise', source: 'Email', priority: 'medium', status: 'triaged', tags: ['email', 'accounts'], createdAt: '2026-09-21T14:10:00Z', notes: [] },
  { id: 'f10', title: 'Slack alerts for high-value accounts', body: 'When a big account reports something, we want to know in Slack right away, not in tomorrow’s digest.', customer: 'Marcus Bell', company: 'Arcadia Bank', mrr: 18900, plan: 'Enterprise', source: 'Chat', priority: 'high', status: 'new', tags: ['integrations'], createdAt: '2026-09-29T08:20:00Z', notes: [] },
  { id: 'f11', title: 'Let customers vote on planned items', body: 'Our customers keep asking whether their request is on the roadmap. A public vote would answer that for them.', customer: 'Elena Park', company: 'Brightline', mrr: 1850, plan: 'Business', source: 'Interview', priority: 'medium', status: 'planned', tags: ['portal'], createdAt: '2026-09-19T12:45:00Z', notes: [] },
  { id: 'f12', title: 'SSO with Okta for the whole workspace', body: 'Security review requires SSO before we can roll Echo out to the rest of the company.', customer: 'Jonas Berg', company: 'Northwind Labs', mrr: 4200, plan: 'Business', source: 'Email', priority: 'high', status: 'triaged', tags: ['security'], createdAt: '2026-09-18T09:30:00Z', notes: [] },
  { id: 'f13', title: 'SSO for contractor accounts', body: 'Our contractors sign in with their own company accounts. We need them in SSO too before they can see customer feedback.', customer: 'Marcus Bell', company: 'Arcadia Bank', mrr: 18900, plan: 'Enterprise', source: 'Interview', priority: 'medium', status: 'triaged', tags: ['security'], createdAt: '2026-09-17T15:20:00Z', notes: [] },
  { id: 'f14', title: 'Export an audit log of changes', body: 'Compliance asks who changed a request’s status and when. A CSV export of the history would cover it.', customer: 'Sofia Rossi', company: 'Arcadia Bank', mrr: 18900, plan: 'Enterprise', source: 'Email', priority: 'medium', status: 'resolved', tags: ['export', 'security'], createdAt: '2026-09-12T10:05:00Z', notes: [] },
];

// What the feedback table is showing: a status ("open" is everything not resolved) and, optionally, a priority.
export type Filter = { status: Status | 'open' | 'all'; priority: Priority | null };
export const NO_FILTER: Filter = { status: 'all', priority: null };
export const matchesFilter = (f: Feedback, filter: Filter) =>
  (filter.status === 'all' || (filter.status === 'open' ? f.status !== 'resolved' : f.status === filter.status)) &&
  (!filter.priority || f.priority === filter.priority);

// `filter` is what the overview asked the table to show: the table starts with it when it opens.
type State = { items: Feedback[]; selectedId: string | null; filter: Filter };
let state: State = { items: seed(), selectedId: null, filter: NO_FILTER };
const listeners = new Set<() => void>();
const set = (next: State) => { state = next; listeners.forEach((l) => l()); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

// A screen can be shown with data of its own (an empty table, say) by wrapping it in StaticItems. The
// screens in states/ do this, so each state can sit on a canvas without touching the live data.
const Override = createContext<Feedback[] | null>(null);
export const StaticItems = Override.Provider;
export const useStore = () => {
  const live = useSyncExternalStore(subscribe, () => state);
  const override = useContext(Override);
  return override ? { ...live, items: override } : live;
};
export const useFeedback = (id: string | null) => useStore().items.find((f) => f.id === id);

let counter = 100;
const nextId = () => `f${++counter}`;

export type FeedbackInput = Pick<Feedback, 'title' | 'body' | 'customer' | 'source' | 'priority'>;

export function addFeedback(input: FeedbackInput): Feedback {
  const item: Feedback = { ...input, id: nextId(), company: '', mrr: 0, plan: 'Team', status: 'new', tags: [], createdAt: new Date().toISOString(), notes: [] };
  set({ ...state, items: [item, ...state.items] });
  return item;
}
export function updateFeedback(id: string, patch: Partial<Omit<Feedback, 'id'>>) {
  set({ ...state, items: state.items.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
}
export function addNote(id: string, text: string) {
  const note: Note = { id: nextId(), text, at: new Date().toISOString() };
  set({ ...state, items: state.items.map((f) => (f.id === id ? { ...f, notes: [...f.notes, note] } : f)) });
}
export function removeFeedback(id: string) {
  set({ ...state, items: state.items.filter((f) => f.id !== id), selectedId: state.selectedId === id ? null : state.selectedId });
}
export const select = (id: string | null) => set({ ...state, selectedId: id });
export const resetData = () => set({ items: seed(), selectedId: null, filter: NO_FILTER });
// The overview's metrics send you to the table already filtered; the top bar's link clears it.
export const showFiltered = (filter: Filter) => set({ ...state, filter });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const formatMrr = (mrr: number) => (mrr >= 1000 ? `$${(mrr / 1000).toFixed(1).replace(/\.0$/, '')}k` : `$${mrr}`);
