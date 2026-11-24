import type { ModuleServer } from '../../core/modules/index.ts';
import { addDials, applyDials, removeDials, type PanelValues } from './node/source.ts';

const MAX_SOURCE = 750 * 1024;
const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));
const panelsOf = (value: unknown): PanelValues[] => {
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.length > 64 ||
    !value.every(p => record(p) && typeof p.name === 'string' && record(p.values))
  )
    throw new Error('Invalid DialKit values.');
  return value as PanelValues[];
};

// Prepares a view's new source; the caller writes it through Studio's ordinary, version-checked save, so this
// route never reads or writes files itself.
export default {
  transform: ({ body }) => {
    try {
      if (!record(body) || typeof body.source !== 'string' || body.source.length > MAX_SOURCE)
        throw new Error('Invalid DialKit request.');
      if (body.action === 'apply') {
        const { source, applied } = applyDials(body.source, panelsOf(body.panels));
        return { body: { content: source, applied } };
      }
      if (body.action === 'add') {
        if (typeof body.group !== 'string' || !body.group.trim()) throw new Error('Invalid DialKit request.');
        return { body: { content: addDials(body.source, body.group) } };
      }
      if (body.action === 'remove') return { body: { content: removeDials(body.source, panelsOf(body.panels)) } };
      throw new Error('Invalid DialKit request.');
    } catch (error) {
      return { status: 422, body: { error: error instanceof Error ? error.message : 'Couldn’t change this view.' } };
    }
  },
} satisfies ModuleServer;
