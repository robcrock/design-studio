import { contributorPreferenceProblems } from '../../core/modules/preferences.ts';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readDeclaration as readSystemDeclaration } from '../../core/declarations.ts';
import { configProblems, studioRole } from '../../core/config.ts';
import { compatible } from '../../core/modules/index.ts';
import { renderAgents } from './agents-file.js';
import { applySetupChanges } from './studio-setup.js';
import { serializeConfig, withSettings } from '../../core/config-file.ts';
import { readPersistedStudioConfig } from './persisted-studio-config.js';
import { persistStudioReferences } from '../../core/resourceReferences.ts';
import { systemDirOf } from './system-folders.js';
import { moduleConsumers } from './imports.js';
import { offLibraryOf } from './module-folders.js';

export class SettingsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Read current configuration on each request; imported config can be stale until Vite restarts.
export function readSettings(root, contributors) {
  let current;
  try {
    current = readPersistedStudioConfig(root);
  } catch (error) {
    throw new SettingsError(`Open studio.config.json in your editor: ${error.message}`);
  }
  const version = createHash('sha256')
    .update(current.source)
    .update(JSON.stringify(contributors))
    .update(JSON.stringify(current.directory))
    .digest('hex');
  return { ...current, version };
}

// One plan for the CLI and browser: validate, preserve implicit assignments, and sync agent routes.
export function planSettings({
  root,
  modules,
  systems,
  platformId,
  contributors,
  changes,
  base,
  actor,
  requireAdmin = false,
}) {
  const current = readSettings(root, contributors);
  if (requireAdmin && studioRole(current.config, actor, Object.keys(contributors)) !== 'admin') {
    throw new SettingsError('Only an Admin can change studio settings.', 403);
  }
  if (base !== undefined && base !== current.version)
    throw new SettingsError('Settings or contributors changed. Reload settings before saving.', 409);
  if (!changes || typeof changes !== 'object' || Array.isArray(changes))
    throw new SettingsError('Settings changes must be an object.');
  const allowed = [
    'name',
    'tagline',
    'usage',
    'defaultSystem',
    'admins',
    'systemMaintainers',
    'modules',
    'assetLimitKB',
  ];
  if (Object.keys(changes).some(key => !allowed.includes(key)))
    throw new SettingsError('Only basic settings, module states, and permission assignments can be changed here.');
  const next = { ...current.config, ...changes };
  if (Object.hasOwn(changes, 'modules')) {
    if (!changes.modules || typeof changes.modules !== 'object' || Array.isArray(changes.modules))
      throw new SettingsError('Module states must be an object.');
    next.modules = { ...current.config.modules, ...changes.modules };
  }
  const systemFile = path.join(root, systemDirOf(root, next.defaultSystem ?? ''), 'system.ts');
  if (fs.existsSync(systemFile)) {
    const spec = readSystemDeclaration(fs.readFileSync(systemFile, 'utf8'));
    if (!('error' in spec) && spec.value.status === 'archived')
      throw new SettingsError('Restore the system before selecting it as the default.');
  }
  const problems = configProblems(next, modules, systems, platformId, Object.keys(contributors));
  for (const module of modules) {
    if (next.modules?.[module.id] === true && current.config.modules?.[module.id] !== true && !compatible(module))
      problems.push(`${module.label} is incompatible with this platform version.`);
    // Code that imports a module keeps building while it is off only through the module's lib/off entry; without
    // one, turning it off waits until nothing imports it.
    const users =
      next.modules?.[module.id] === false &&
      current.config.modules?.[module.id] === true &&
      !offLibraryOf(root, module.id)
        ? moduleConsumers(root, module.id)
        : [];
    if (users.length)
      problems.push(
        `${module.label} is still used by ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}. Take it out of ${users.length === 1 ? 'that file' : 'those files'} before turning it off.`,
      );
  }
  problems.push(
    ...contributorPreferenceProblems(
      contributors,
      modules.filter(module => next.modules?.[module.id] === true && current.config.modules?.[module.id] !== true),
    ),
  );
  if (problems.length) throw new SettingsError(problems.join('\n'));
  const changed = Object.fromEntries(
    Object.entries(changes).filter(
      ([key]) => key !== 'modules' && JSON.stringify(next[key]) !== JSON.stringify(current.config[key]),
    ),
  );
  const moduleChanges = Object.fromEntries(
    Object.entries(changes.modules ?? {}).filter(([id, on]) => current.config.modules?.[id] !== on),
  );
  if (Object.keys(moduleChanges).length) changed.modules = moduleChanges;
  const persisted = persistStudioReferences(next, current.directory);
  const serializedChanges = Object.fromEntries(
    Object.entries(changed).map(([key, value]) => [key, key === 'modules' ? value : persisted[key]]),
  );
  // Read-modify-write of the parsed file: only the changed settings differ from what was read.
  const { modules: moduleStates, ...settings } = serializedChanges;
  const source = Object.keys(changed).length
    ? serializeConfig(
        withSettings(current.persisted, {
          ...settings,
          ...(moduleStates && { modules: { ...current.persisted.modules, ...moduleStates } }),
        }),
      )
    : current.source;
  const pins = [];
  const edits = [...pins, { file: current.file, before: current.source, after: source }];
  const agents = path.join(root, 'AGENTS.md');
  if (fs.existsSync(agents))
    edits.push({
      file: agents,
      before: fs.readFileSync(agents, 'utf8'),
      after: renderAgents(
        root,
        modules.filter(m => next.modules[m.id] === true && compatible(m)),
        platformId,
      ),
    });
  return { config: next, edits: edits.filter(edit => edit.before !== edit.after), pins };
}

export function saveSettings(options) {
  if (typeof options.base !== 'string') throw new SettingsError('Reload settings before saving.', 409);
  const plan = planSettings({ ...options, requireAdmin: true });
  applySetupChanges(plan.edits);
  return plan;
}
