// Archiving: a prototype can be set aside. Everything shows while you work locally; the deployed
// site leaves an archived prototype out entirely (src/platform/node/build/build-manifest.js --deploy, and
// src/platform/node/build/vite-globs-plugin.js), so it isn't built, listed, or shipped.
//
// A prototype's status is meta.json "status": "archived". Active is the default and is never
// written. Imports only roots.ts, which has none, so Node scripts and the app can both load it.
import { rootOf } from './roots.ts';

export const STATUSES = ['active', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

export const parseStatus = (value: unknown): Status | null =>
  typeof value === 'string' && (STATUSES as readonly string[]).includes(value) ? (value as Status) : null;

// What the deployed site keeps: every prototype that isn't archived. `archived` lists what was left
// out as paths in the app's file globs ("/prototypes/samples/checkout/**"), for
// src/platform/node/build/vite-globs-plugin.js.
// `only` ("<contributor>/<id>") keeps that one prototype and leaves out the rest, for a download.
type Proto = { id: string; contributorKey: string; status?: Status; systemMissing?: unknown };
export function forDeploy<P extends Proto>(prototypes: P[], only?: string) {
  const keep = (p: P) => (only ? `${p.contributorKey}/${p.id}` === only : p.status !== 'archived' && !p.systemMissing);
  const kept = prototypes.filter(keep);
  const archived = prototypes.filter(p => !keep(p)).map(p => `/${rootOf(p.contributorKey, p.id)}/**`);
  return { kept, archived };
}

// Links to archived prototypes, in the text of a canvas or document that stays on the deployed site.
// The site has nothing to open there, so it shows a placeholder, and the build names the file so it
// can be fixed. `prototypes` are archived prototypes' addresses without /prototypes ("/samples/checkout"), which also finds the full address
// ("/prototypes/samples/checkout") and the older one. Returns the
// ones the text links to. Reads text and changes nothing.
const slugChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9_%\-/]/.test(c);
export function linksToArchived(text: string, prototypes: string[]): string[] {
  return prototypes.filter(path => {
    for (let i = text.indexOf(path); i !== -1; i = text.indexOf(path, i + 1)) {
      const next = text[i + path.length];
      if (next === '/' || !slugChar(next)) return true;
    }
    return false;
  });
}
