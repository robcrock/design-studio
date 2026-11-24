import fs from 'node:fs';
import path from 'node:path';
import { inside, realFile } from './imports.js';
import { moduleDirOf } from './module-folders.js';
import { apiEntryOf, apiSpecifier, isTeamCode } from '../../core/modules/boundaries.ts';
import { apiEnvironmentPolicy } from './api-environments.js';
import { prototypeAssignment } from './prototype-assignment.js';
import { packageName, systemPackage, SHARED_RUNTIME_PACKAGES, SYSTEM_RUNTIME_PACKAGES } from './system-dependencies.js';

export const systemDocumentation = (file, dir) =>
  file === path.join(dir, 'system.ts') ||
  /^intro\.[jt]sx?$/.test(path.relative(dir, file)) ||
  /\.(?:examples\.[jt]sx?|md)$/.test(file);

// Where a prototype gets what it cannot import by bare name.
const prototypeImportAdvice = (name, system) =>
  name === 'cn'
    ? "Import cn from '#studio/runtime'."
    : name === '@tanstack/react-router'
      ? "Import Link and useNavigate from '@module/prototypes'."
      : system
        ? `Import it through a declared library entry of the assigned system (${system}), such as '@/systems/${system}/libraries/<entry>' (icons come from its icons library).`
        : 'A prototype with no system can import only React and React DOM; assign a system to use its libraries.';

export function scopePolicy({ root, systems, modules, prototypeDirs = [] }) {
  root = realFile(root);
  const src = path.join(root, 'src');
  const protos = path.join(src, 'prototypes');
  const shared = path.join(src, 'lib');
  const entries = Object.entries(systems).map(([id, spec]) => ({ id, dir: path.resolve(root, spec.dir) }));
  const libraries = modules
    .filter(m => m.lib)
    .map(m => ({ ...m, dir: path.join(root, moduleDirOf(root, m.id), 'lib') }));
  const prototypeRoot = file => {
    for (const dir of [protos, ...prototypeDirs.map(realFile)]) {
      if (!inside(file, dir)) continue;
      const parts = path.relative(dir, file).split(path.sep);
      const depth = dir === protos ? 2 : 1;
      if (parts.length <= depth || parts.slice(0, depth).some(p => !/^[a-z0-9][a-z0-9._-]*$/i.test(p))) return null;
      return path.join(dir, ...parts.slice(0, depth));
    }
    return null;
  };
  const runtimeSystem = file => entries.find(s => inside(file, s.dir) && !systemDocumentation(file, s.dir));
  const publicLibrary = (source, target) =>
    libraries.find(
      m => source === `@module/${m.id}` && /^(?:index|off)\.(?:[cm]?[jt]sx?)$/.test(path.relative(m.dir, target)),
    );
  const scopeOf = file => {
    const proto = prototypeRoot(file);
    if (proto) {
      let system = null;
      let missing = false;
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(proto, 'meta.json'), 'utf8'));
        const prototypeSystems = Object.fromEntries(
          Object.entries(systems).filter(([, spec]) => spec.role === 'prototype'),
        );
        const assignment = prototypeAssignment(meta, prototypeSystems);
        if (!assignment.problems.length) {
          system = assignment.system;
          missing = meta.systemMissing !== undefined;
        }
      } catch {
        /* Invalid metadata grants no system boundary; manifest reports it. */
      }
      return { kind: 'Prototype', dir: proto, system, missing };
    }
    const system = runtimeSystem(file);
    if (system) return { kind: 'Design system', ...system };
    if (inside(file, shared)) return { kind: 'Shared utility', dir: shared };
    const lib = libraries.find(m => inside(file, m.dir));
    return lib ? { kind: 'Module library', ...lib } : null;
  };
  const packageProblem = (source, importer) => {
    const name = packageName(source);
    if (!name) return null;
    const scope = scopeOf(realFile(importer));
    // Documentation examples also belong to their system's package workspace.
    const owner = entries.find(s => inside(realFile(importer), s.dir));
    if (owner) {
      if (systemDocumentation(realFile(importer), owner.dir) && !/\.examples\.[jt]sx?$/.test(importer)) return null;
      if (SYSTEM_RUNTIME_PACKAGES.includes(name)) return null;
      let pkg;
      try {
        pkg = systemPackage(owner.dir);
      } catch (error) {
        return error.message;
      }
      if (Object.hasOwn(pkg.dependencies ?? {}, name))
        return fs.existsSync(path.join(owner.dir, 'node_modules', name))
          ? null
          : `Design system scope: ${name} is declared but not installed for ${path.relative(root, owner.dir)}. Run pnpm install --ignore-scripts.`;
      return `Design system scope: ${source} is not declared in ${path.relative(root, owner.dir)}/package.json. Add it to this system's dependencies.`;
    }
    if (scope?.kind === 'Prototype' && /\.[cm]?[jt]sx?$/.test(importer) && !SHARED_RUNTIME_PACKAGES.includes(name))
      return `Prototype scope: ${source} is not shared runtime. ${prototypeImportAdvice(name, scope.system)}`;
    if (scope?.kind === 'Shared utility' && ![...SHARED_RUNTIME_PACKAGES, 'cn'].includes(name))
      return `Shared utility scope: ${source} belongs in a system, not a shared utility.`;
    return null;
  };
  const api = apiEnvironmentPolicy({ root, scopeOf });
  return {
    scopeOf,
    packageProblem,
    apiEntryProblems: api.entryProblems,
    computedImportProblem: api.computedImportProblem,
    apiProblems(file) {
      // Follow helpers in the caller's environment, even when their own filename has no environment marker.
      return isTeamCode(path.relative(root, file).split(path.sep).join('/')) || scopeOf(file) ? api.problems(file) : [];
    },
    problem(source, importer, target, { typeOnly = false } = {}) {
      importer = realFile(importer);
      target = realFile(target);
      const environmentProblem = api.edgeProblem(source, importer, target, { typeOnly });
      if (environmentProblem) {
        const scope = scopeOf(importer);
        return scope ? `${scope.kind} scope: ${environmentProblem}` : environmentProblem;
      }
      // The inventory grants public API access; runtime entries need no second allowlist here.
      // Type-only imports are erased. Private-import and executable environment rules applied above.
      const publicEntry = apiEntryOf(path.relative(root, target).split(path.sep).join('/'));
      if (publicEntry && source === apiSpecifier(publicEntry)) return null;
      const dependencyProblem = packageProblem(source, importer);
      if (dependencyProblem) return dependencyProblem;
      const scope = scopeOf(importer);
      if (!scope) return null;
      if (target.split(path.sep).includes('node_modules'))
        return packageName(source)
          ? null
          : `${scope.kind} scope: import packages by their declared name, not a node_modules file path.`;
      const system = runtimeSystem(target);
      if (
        scope.kind === 'Prototype' &&
        system &&
        inside(target, path.join(system.dir, 'libraries')) &&
        !(systems[system.id].libraries ?? []).some(
          library => library.entry && realFile(path.join(system.dir, library.entry)) === target,
        )
      )
        return 'Prototype scope: use a declared public library entry from the assigned system.';
      const lib = publicLibrary(source, target);
      const own =
        inside(target, scope.dir) && (scope.kind !== 'Design system' || !systemDocumentation(target, scope.dir));
      const allowed =
        own ||
        (scope.kind !== 'Shared utility' && inside(target, shared)) ||
        (scope.kind === 'Prototype' && system?.id === scope.system) ||
        (lib &&
          (scope.kind === 'Prototype' ||
            scope.kind === 'Design system' ||
            (scope.kind === 'Module library' && !lib.optional)));
      return allowed
        ? null
        : `${scope.kind} scope: ${path.relative(src, importer)} imports ${path.relative(src, target)} outside its runtime boundary. Use #studio/runtime, its own files, permitted shared utilities, assigned system components, or an enabled module's public @module/<id> entry.`;
    },
  };
}
