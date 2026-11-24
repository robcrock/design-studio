import path from 'node:path';
import { isTeamCode, apiEntryOf } from '../../core/modules/boundaries.ts';
import { moduleIdOfPath } from '../../core/roots.ts';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE_SYSTEMS, DEFAULT_SYSTEM } from '../../modules/systems/node/systems.js';
import { LIBRARY_MODULES, PROTOTYPE_DIRS } from '../lib/modules.js';
import { scopePolicy } from '../lib/scope.js';
import { importsOf } from '../lib/imports.js';
import { cssProblems } from '../lib/css-scope.js';
import { packageName } from '../lib/system-dependencies.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export default function importGuard({
  root = ROOT,
  systems = PROTOTYPE_SYSTEMS,
  defaultSystem = DEFAULT_SYSTEM,
  modules = LIBRARY_MODULES,
  prototypeDirs = PROTOTYPE_DIRS,
} = {}) {
  const policy = scopePolicy({ root, systems, defaultSystem, modules, prototypeDirs });
  return {
    name: 'prototype-import-guard',
    enforce: 'pre',
    buildStart() {
      const problems = policy.apiEntryProblems();
      if (problems.length) this.error(problems.join('\n'));
    },
    async resolveId(source, importer, options) {
      if (!importer || importer.includes('\0')) return null;
      const file = importer.split('?')[0];
      const dependencyProblem = policy.packageProblem(source, file);
      if (dependencyProblem) this.error(dependencyProblem);
      // Theme imports are recursively validated by the CSS plugin before loading.
      if (/\.css$/.test(file) && !/\.module\.css$/.test(file)) return null;
      const scope = policy.scopeOf(file);
      const rel = path.relative(root, file).split(path.sep).join('/');
      if (!scope && moduleIdOfPath(rel) === undefined && !isTeamCode(rel)) return null;
      // A module library may load a package's own stylesheet (the package scopes it); repository CSS stays modular.
      const packageStylesheet = scope?.kind === 'Module library' && packageName(source);
      if (scope && /\.css($|\?)/.test(source) && !/\.module\.css($|\?)/.test(source) && !packageStylesheet)
        this.error(
          `${scope.kind} scope: ${file} imports global CSS. Use CSS Modules for runtime styles; design-system themes are loaded by the platform.`,
        );
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external || !path.isAbsolute(resolved.id)) return resolved;
      const problem = policy.problem(source, file, resolved.id.split('?')[0]);
      if (problem) this.error(problem);
      return resolved;
    },
    transform(code, id) {
      const file = id.split('?')[0];
      // Package internals are governed by package declarations, not repository source rules.
      if (file.split(/[\\/]/).includes('node_modules')) return null;
      const rel = path.relative(root, file).split(path.sep).join('/');
      const scope = policy.scopeOf(file);
      // Re-read the graph on transforms: dev edits to a transitive helper must not reuse a stale verdict.
      const apiProblems = isTeamCode(rel) || scope ? policy.apiProblems(file) : [];
      const entry = apiEntryOf(rel);
      if (entry) apiProblems.push(...policy.apiEntryProblems([entry]));
      if (apiProblems.length) this.error(apiProblems.join('\n'));
      const imports = /\.[cm]?[jt]sx?$/.test(file) ? importsOf(code, file) : [];
      for (const { source } of imports) {
        const problem = policy.packageProblem(source, file);
        if (problem) this.error(problem);
      }
      if (!scope && moduleIdOfPath(path.relative(root, file).split(path.sep).join('/')) === undefined) return null;
      if (scope && /\.module\.css$/.test(file)) {
        const problems = cssProblems(code, { file, mode: 'module' });
        if (problems.length) this.error(problems.join('\n'));
      } else if (imports.some(i => !i.typeOnly && i.source === null)) {
        const problem = policy.computedImportProblem(file);
        if (problem) this.error(problem);
      }
      return null;
    },
  };
}
