// The form for creating or editing one piece of feedback. The same fields serve the "New feedback"
// panel on the feedback inbox and the "Edit" dialog on the detail screen.
import { useState } from 'react';
import { Button } from '@/systems/product/components/button';
import { Input } from '@/systems/product/components/input';
import { Label } from '@/systems/product/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/systems/product/components/select';
import { Textarea } from '@/systems/product/components/textarea';
import { PRIORITIES, SOURCES, type FeedbackInput, type Priority, type Source } from './store';

const EMPTY: FeedbackInput = { title: '', body: '', customer: '', source: 'Email', priority: 'medium' };

export default function FeedbackForm({ initial = EMPTY, showErrors = false, submitLabel, onSubmit, onCancel }: {
  initial?: FeedbackInput;
  // Starts with the errors showing, as if Add had already been pressed (for the validation state).
  showErrors?: boolean;
  submitLabel: string;
  onSubmit: (input: FeedbackInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [tried, setTried] = useState(showErrors);
  const set = <K extends keyof FeedbackInput>(key: K, value: FeedbackInput[K]) => setValues((v) => ({ ...v, [key]: value }));
  const titleMissing = tried && !values.title.trim();

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (values.title.trim()) onSubmit({ ...values, title: values.title.trim(), customer: values.customer.trim() || 'Unknown' });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="fb-title">Title</Label>
        <Input id="fb-title" value={values.title} aria-invalid={titleMissing} placeholder="What did they say, in a line?" onChange={(e) => set('title', e.target.value)} />
        {titleMissing && <p className="text-xs text-destructive">Give it a title.</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fb-customer">Customer</Label>
        <Input id="fb-customer" value={values.customer} placeholder="Name" onChange={(e) => set('customer', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Source</Label>
          <Select items={SOURCES} value={values.source} onValueChange={(v) => v && set('source', v as Source)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Priority</Label>
          <Select items={PRIORITIES} value={values.priority} onValueChange={(v) => v && set('priority', v as Priority)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="fb-body">Details</Label>
        <Textarea id="fb-body" value={values.body} rows={5} placeholder="Their words, as close as you can." onChange={(e) => set('body', e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
