import fs from 'node:fs';
import path from 'node:path';
import type { ModuleBuild } from '../../core/modules/index.ts';
import { PROTOTYPE_DIRS } from '../../node/lib/modules.js';
import { LIBRARY } from './node/source.ts';
import type { DialKitContribution } from './contribution.ts';

// Which views use DialKit, as repo-relative paths, so their menus offer Remove instead of Add. The manifest
// rebuilds when a view changes (it can be lofi), so this stays current as you or an agent edit.
const IMPORT = new RegExp(`from\\s*['"]${LIBRARY}['"]`);

export default {
  manifest({ root }) {
    const views: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file);
        else if (/\.[jt]sx$/.test(entry.name) && IMPORT.test(fs.readFileSync(file, 'utf8')))
          views.push(path.relative(root, file).split(path.sep).join('/'));
      }
    };
    for (const dir of [path.join(root, 'src', 'prototypes'), ...PROTOTYPE_DIRS]) if (fs.existsSync(dir)) walk(dir);
    return { data: { views } satisfies DialKitContribution, errors: 0 };
  },
} satisfies ModuleBuild;
