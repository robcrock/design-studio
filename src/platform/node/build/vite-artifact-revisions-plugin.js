// Development-only evidence of the local inputs used by compiled browser modules.
// Authored files, component exports, and production bundles remain untouched.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { canonicalDirectory } from '../lib/safe-paths.js';
import { ROOT, prototypeDir, itemFile } from './files/paths.js';
import { PLATFORM_ID, PROTOTYPE_SYSTEMS, SYSTEM_SPECS } from '../../modules/systems/node/systems.js';
import { sameOrigin, send } from './files/http.js';

export const digest = value => crypto.createHash('sha256').update(value).digest('hex');
export const inputDigest = inputs => digest(JSON.stringify(inputs));
const SRC = path.join(ROOT, 'src');
const STYLES = path.join(SRC, 'platform/app/styles.css');
const local = file => file.startsWith(SRC + path.sep);
const supported = file => local(file) && /\.(?:[cm]?[jt]sx?|md|css|json)$/.test(file);
const keyOf = file => '/' + path.relative(SRC, file).split(path.sep).join('/');
const themeFiles = () =>
  [...new Set([PLATFORM_ID, ...Object.keys(PROTOTYPE_SYSTEMS)])].map(id =>
    path.join(ROOT, SYSTEM_SPECS[id].dir, 'styles/theme.css'),
  );
function pairOf(file) {
  if (!local(file) || !canonicalDirectory(path.dirname(file), ROOT) || fs.lstatSync(file).isSymbolicLink())
    throw new Error('Preview dependency is unavailable.');
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('Preview dependency is too large to verify.');
  return [keyOf(file), digest(fs.readFileSync(file))];
}
function cssInputs(file, source, visited = new Set()) {
  if (visited.has(file)) return visited;
  visited.add(file);
  if (visited.size > 512) throw new Error('Preview styles are too large to verify.');
  postcss.parse(source).walkAtRules('import', rule => {
    const match = /^(?:url\(\s*)?(?:"([^"]+)"|'([^']+)'|([^\s;)]+))/.exec(rule.params);
    const target = match && (match[1] ?? match[2] ?? match[3]);
    if (!target?.startsWith('.')) return;
    const child = path.resolve(path.dirname(file), target);
    pairOf(child); // Apply the same containment, symlink and size limits before reading.
    cssInputs(child, fs.readFileSync(child, 'utf8'), visited);
  });
  return visited;
}
export function sourceInputs(graph, entry) {
  const files = new Set([entry, STYLES, ...themeFiles()]);
  const visited = new Set();
  const visit = module => {
    if (visited.has(module)) return;
    visited.add(module);
    // Imported local assets are inputs too; the browser records their bytes as evidence.
    if (module.file && local(module.file)) files.add(module.file);
    if (visited.size > 4096) throw new Error('Preview dependency graph is too large to verify.');
    for (const child of module.importedModules ?? []) visit(child);
  };
  for (const module of graph.getModulesByFile(entry) ?? []) visit(module);
  for (const file of files)
    if (file.endsWith('.css')) {
      pairOf(file);
      for (const input of cssInputs(file, fs.readFileSync(file, 'utf8'))) files.add(input);
    }
  if (files.size > 512) throw new Error('Preview dependency graph is too large to verify.');
  return [...files].sort().map(pairOf);
}
export default function artifactRevisions() {
  const inputs = new Map();
  return [
    {
      name: 'studio-capture-artifact-input',
      enforce: 'pre',
      apply: 'serve',
      transform: {
        order: 'pre',
        handler(code, id) {
          const file = id.split('?')[0];
          if (local(file) && !supported(file)) {
            // An imported asset compiles to a URL, so its evidence is the file on disk. One too large
            // or unsafe to read stays unrecorded, and so unverified, exactly as the server reports it.
            try {
              inputs.set(id, [pairOf(file)]);
            } catch {}
            return null;
          }
          if (!supported(file) || /[?&](?:raw|url)(?:&|$)/.test(id)) return null;
          const extra = file.endsWith('.css') ? [...cssInputs(file, code)].filter(input => input !== file) : [];
          if (file === STYLES)
            for (const theme of themeFiles()) {
              pairOf(theme);
              extra.push(...cssInputs(theme, fs.readFileSync(theme, 'utf8')));
            }
          inputs.set(id, [[keyOf(file), digest(code)], ...[...new Set(extra)].map(pairOf)]);
          return null;
        },
      },
    },
    {
      name: 'studio-record-artifact-input',
      enforce: 'post',
      apply: 'serve',
      transform: {
        order: 'post',
        handler(code, id) {
          const versions = inputs.get(id);
          if (!versions) return null;
          inputs.delete(id);
          return {
            code:
              code +
              `\n;{const records=globalThis[Symbol.for('studio.compiled-inputs')]??=new Map();for(const [path,hash] of ${JSON.stringify(versions)})records.set(path,hash); }\n`,
            map: null,
          };
        },
      },
      configureServer(server) {
        server.middlewares.use('/__studio/revision', (req, res) => {
          if (req.method !== 'GET' || !sameOrigin(req))
            return send(res, 403, { error: 'Only the app can read preview revisions.' });
          res.setHeader('Cache-Control', 'no-store');
          try {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const contributor = url.searchParams.get('contributor');
            const dir = prototypeDir(contributor, url.searchParams.get('prototype'));
            const entry = dir && itemFile(dir, url.searchParams.get('path'), contributor);
            if (!entry) return send(res, 404, { error: 'This artifact is unavailable.' });
            const sources = sourceInputs(server.environments.client.moduleGraph, entry);
            return send(res, 200, {
              source: sources.find(([file]) => file === keyOf(entry))[1],
              inputs: inputDigest(sources),
              sources,
            });
          } catch {
            return send(res, 409, {
              error: 'Preview inputs could not be verified. Try again after repairing the files.',
            });
          }
        });
      },
    },
  ];
}
