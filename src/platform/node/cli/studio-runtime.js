import { allocateResourceIdentity, retainedResourceIds } from '../lib/resource-identity-lifecycle.js';
import { INSTALLED_FILE_TYPES } from '../lib/file-types.js';
import { planSystemLifecycle, applySystemLifecycle } from '../lib/system-lifecycle.js';
import { prototypeContext } from '../lib/prototype-context.js';
import { resourceId } from '../../core/resourceIdentity.ts';
import { moduleConsumers } from '../lib/imports.js';
// The commands behind pnpm studio; their summary is the help text in studio.js.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { knowledgeOwners, skillCatalog, syncSkillAdapters } from '../lib/agent-skills.js';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compatible, PLATFORM_VERSION } from '../../core/modules/index.ts';
import { readDeclaration } from '../../core/declarations.ts';
import { MODULES, ENABLED_MODULES, CONFIG } from '../lib/modules.js';
import {
  PLATFORM_ID,
  SYSTEM_SPECS,
  PROTOTYPE_SYSTEMS,
  DEFAULT_SYSTEM,
  SYSTEM_IDS,
} from '../../modules/systems/node/systems.js';
import { canPerform, studioRole } from '../../core/permissions.ts';
import { CONFIG_FILE, configProblems } from '../../core/config.ts';
import { parseConfigFile, serializeConfig, withModule, withSettings } from '../../core/config-file.ts';
import { applySetupChanges, editDeclaration } from '../lib/studio-setup.js';
import { planSettings } from '../lib/studio-settings.js';
import { renderAgents } from '../lib/agents-file.js';
import { resolveContributor } from './resolve-contributor.js';
import { downloadPrototype } from '../../modules/prototypes/node/download.js';
import { renamePrototype } from '../../modules/prototypes/node/create.js';
import { duplicatePrototype } from '../../modules/prototypes/node/duplicate.js';
import { ownedPrototype } from '../build/files/policy.js';
import { loadContributors } from '../lib/contributors.js';
import {
  SUPPLIED_MODULES_ROOT,
  SUPPLIED_SYSTEMS_ROOT,
  TEAM_MODULES_ROOT,
  TEAM_SYSTEMS_ROOT,
} from '../../core/roots.ts';
import { detachOf, moduleDirOf, moduleFolderTaken, newModuleDir } from '../lib/module-folders.js';
import { newSystemDir, systemDirOf, systemFolderTaken } from '../lib/system-folders.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const rel = (...parts) => path.join(ROOT, ...parts);
const say = (line = '') => console.log(line);
const fail = message => {
  console.error(message);
  process.exit(1);
};
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

// ---- arguments
const [command, ...rest] = process.argv.slice(2);
const flags = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a === '--') continue;
  if (
    [
      '--yes',
      '--content',
      '--force',
      '--json',
      '--check',
      '--restore-prototypes',
      '--recovery',
      '--no-system',
    ].includes(a)
  )
    flags[a.slice(2)] = true;
  else if (
    ['--label', '--name', '--tagline', '--usage', '--system', '--admins', '--maintainers', '--out', '--title'].includes(
      a,
    )
  ) {
    flags[a.slice(2)] = rest[++i];
    if (flags[a.slice(2)] === undefined) fail(`${a} needs a value.`);
  } else if (a.startsWith('--')) fail(`Unknown option ${a}.`);
  else positional.push(a);
}
const ID = /^[a-z][a-z0-9-]*$/;
if (flags.check && command !== 'sync') fail('--check is supported only with sync.');
const titleOf = id =>
  id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
const slug = text =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[^a-z]+/, '');

// ---- places that must never be deleted, whatever a command or a flag says
const PROTECTED = new Set([
  'src',
  'src/platform',
  SUPPLIED_MODULES_ROOT,
  TEAM_MODULES_ROOT,
  'src/prototypes',
  'src/lib',
  SUPPLIED_SYSTEMS_ROOT,
  systemDirOf(ROOT, PLATFORM_ID),
  `${systemDirOf(ROOT, PLATFORM_ID)}/context`,
  `${systemDirOf(ROOT, PLATFORM_ID)}/skills`,
  TEAM_SYSTEMS_ROOT,
  'src/types',
]);
function removable(relative) {
  const clean = path.posix.normalize(relative.replace(/\/$/, ''));
  if (!relative || clean.startsWith('..') || clean.startsWith('/') || !clean.startsWith('src/') || PROTECTED.has(clean))
    throw new Error(`Refusing to delete ${relative}.`);
  const abs = rel(clean);
  if (!abs.startsWith(rel('src') + path.sep)) throw new Error(`Refusing to delete ${relative}.`);
  return abs;
}
function removeEmptyParents(abs) {
  for (
    let dir = path.dirname(abs);
    dir.startsWith(rel('src') + path.sep) && !PROTECTED.has(path.relative(ROOT, dir));
    dir = path.dirname(dir)
  ) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    else break;
  }
}

// ---- AGENTS.md
function syncAgents() {
  const file = rel('AGENTS.md');
  const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  const next = renderAgents(ROOT, ENABLED_MODULES, PLATFORM_ID);
  if (next === text) return false;
  if (flags.check) throw new Error('AGENTS.md is stale. Run pnpm studio sync.');
  fs.writeFileSync(file, next);
  return true;
}
const syncSkills = () => {
  const result = syncSkillAdapters(ROOT, skillCatalog(ROOT, knowledgeOwners(ENABLED_MODULES, SYSTEM_SPECS)), {
    check: Boolean(flags.check),
  });
  for (const warning of result.warnings) say(warning);
  if (flags.check && (result.changed || result.warnings.length))
    throw new Error('Project skill adapters need review or synchronization. Run pnpm studio sync.');
  say(`Project skills synchronized (Codex, Cursor, Claude Code; ${result.changed} changes).`);
};
const syncInFreshProcess = () => run('node', ['src/platform/node/cli/studio.js', 'sync']);
const checkInFreshProcess = (onSuccess = () => {}) => {
  try {
    onSuccess(run('node', ['src/platform/node/check/check-modules.js']).trim());
    return null;
  } catch (e) {
    return `${e.stderr ?? ''}${e.stdout ?? ''}`.trim();
  }
};

// ---- commands
function list() {
  say(`Platform ${PLATFORM_VERSION}`);
  say();
  say('Modules');
  for (const [id, m] of Object.entries(MODULES)) {
    if (!m || typeof m !== 'object') continue;
    const state =
      CONFIG.modules?.[id] !== true
        ? CONFIG.modules?.[id] === false
          ? 'off'
          : 'unregistered'
        : !compatible(m)
          ? `off (needs platform ${m.requires})`
          : 'on';
    say(`  ${id.padEnd(12)} ${state.padEnd(8)} ${m.optional ? 'can be turned off' : 'required         '}`);
    if (m.description) say(`               ${m.description}`);
  }
  say();
  say('Systems');
  for (const id of [PLATFORM_ID, ...(CONFIG.systems ?? [])]) {
    say(`  ${id.padEnd(12)} ${id === DEFAULT_SYSTEM ? 'default ' : '        '}`);
  }
}

function setEnabled(id, on) {
  const spec = MODULES[id];
  if (!id || !spec) fail(`No module has the id "${id ?? ''}". Installed: ${Object.keys(MODULES).join(', ')}.`);
  if (!on && !spec.optional) fail(`The ${id} module can't be turned off yet; other parts of the app still use it.`);
  if (on && !compatible(spec))
    fail(`The ${id} module needs platform ${spec.requires} or newer, and this is ${PLATFORM_VERSION}.`);
  const plan = planSettings({
    root: ROOT,
    modules: Object.values(MODULES),
    systems: SYSTEM_IDS,
    platformId: PLATFORM_ID,
    contributors: loadContributors(),
    changes: { modules: { [id]: on } },
  });
  applySetupChanges(plan.edits);
  syncInFreshProcess();
  say(`${spec.label} is ${on ? 'on' : 'off'}.${on ? '' : ' Its files are still there; turn it on again any time.'}`);
}

// Installation and registration are one operation. Rollback restores both.
function registerCapability(kind, id, present, remember = () => {}) {
  const file = rel(CONFIG_FILE);
  const parsed = parseConfigFile(fs.readFileSync(file, 'utf8'));
  if ('error' in parsed) throw new Error(parsed.error);
  const config = parsed.value;
  let next;
  if (kind === 'module') {
    if (!config.modules || typeof config.modules !== 'object' || Array.isArray(config.modules))
      throw new Error(`Declare modules as explicit true/false entries in ${CONFIG_FILE}.`);
    next = withModule(config, id, present ? true : null);
  } else {
    if (!Array.isArray(config.systems)) throw new Error(`Declare systems as an explicit array in ${CONFIG_FILE}.`);
    const systems = config.systems.filter(value => value !== id);
    if (present) systems.push(id);
    const systemMaintainers = { ...config.systemMaintainers };
    const spec = present
      ? readDeclaration(fs.readFileSync(rel(systemDirOf(ROOT, id), 'system.ts'), 'utf8'))
      : { value: SYSTEM_SPECS[id] };
    if ('error' in spec) throw new Error(spec.error);
    const permanentId = resourceId(spec.value.studioId);
    if (present) systemMaintainers[permanentId] = [];
    else delete systemMaintainers[permanentId];
    next = withSettings(config, { systems, systemMaintainers });
  }
  remember(file);
  fs.writeFileSync(file, serializeConfig(next));
}

function lifecycle(action) {
  if (
    flags.yes &&
    !canPerform(
      CONFIG,
      resolveContributor(),
      Object.keys(loadContributors()),
      {
        kind: 'system',
        id: positional[0],
        role: SYSTEM_SPECS[positional[0]]?.role,
        status: SYSTEM_SPECS[positional[0]]?.status,
      },
      action === 'rename' ? 'rename' : 'manage',
    )
  )
    fail('This system operation requires an Admin or, for rename, an assigned system maintainer.');
  const plan = planSystemLifecycle(ROOT, CONFIG, action, positional[0], {
    name: flags.label,
    restorePrototypes: Boolean(flags['restore-prototypes']),
  });
  say(
    `${action} system ${positional[0]}${plan.id !== positional[0] ? ` → ${plan.id}` : ''}. ${plan.prototypes} associated prototype(s); ${plan.edits.length} file update(s).`,
  );
  if (action === 'delete')
    say(
      'Permanently deletes the system source. Associated prototypes retain their code and require a system rebuild before rendering or deployment.',
    );
  if (action === 'archive')
    say(
      'Retains source; archives associated active prototypes and excludes the system from deployment and new selections.',
    );
  if (!flags.yes) {
    say('Preview only. Apply with --yes.');
    return;
  }
  const marker = rel('.studio-system-operation');
  const markerFd = fs.openSync(marker, 'wx');
  fs.closeSync(markerFd);
  const packageLockBefore = fs.readFileSync(rel('pnpm-lock.yaml'));
  try {
    const result = applySystemLifecycle(plan, () => {
      if (plan.move || plan.remove)
        run('pnpm', ['install', '--lockfile-only', '--ignore-scripts', '--prefer-offline', '--no-frozen-lockfile']);
      const problem = checkInFreshProcess();
      if (problem) throw new Error(problem);
      syncInFreshProcess();
    });
    say(JSON.stringify(result));
  } catch (error) {
    fs.writeFileSync(rel('pnpm-lock.yaml'), packageLockBefore);
    throw error;
  } finally {
    fs.rmSync(marker, { force: true });
  }
}

async function remove() {
  const [id] = positional;
  if (!id) fail('Usage: pnpm studio remove <module|system> [--content] [--yes] [--force]');
  const isModule = Object.hasOwn(MODULES, id) && MODULES[id];
  if (!isModule && SYSTEM_SPECS[id]?.role === 'platform')
    fail('The Studio system serves the platform and cannot be removed.');
  const isSystem = !isModule && Object.hasOwn(PROTOTYPE_SYSTEMS, id);
  if (!isModule && !isSystem)
    fail(
      `Nothing is called "${id}". Modules: ${Object.keys(MODULES).join(', ')}. Design systems: ${SYSTEM_IDS.join(', ')}.`,
    );
  const paths = [];
  const notes = [];
  const detached = [];
  if (isModule) {
    const spec = MODULES[id];
    if (id === 'contributors' && CONFIG.usage === 'team')
      fail('Team use requires Contributors & Permissions. Switch to personal use before removing it.');
    if (!spec.optional) fail(`The ${id} module can't be removed yet; other parts of the app still use it.`);
    // The module's folder, in whichever root holds it.
    const dir = moduleDirOf(ROOT, id);
    paths.push(dir);

    if (spec.section?.folder && !spec.section.folder.startsWith(dir)) {
      if (flags.content) paths.push(spec.section.folder);
      else if (fs.existsSync(rel(spec.section.folder)))
        notes.push(`Its content in ${spec.section.folder} stays. Add --content to delete that too.`);
    }
    // Code that uses the module's library is rewritten into plain code by the module's detach.ts, all or nothing.
    const users = moduleConsumers(ROOT, id);
    const detachFile = users.length ? detachOf(ROOT, id) : null;
    if (detachFile) {
      const { default: detach } = await import(pathToFileURL(detachFile).href);
      for (const file of users) {
        const before = fs.readFileSync(rel(file), 'utf8');
        try {
          detached.push({ file, before, after: detach(before) });
        } catch (error) {
          fail(`${file} can't have ${spec.label} taken out automatically: ${error.message}`);
        }
      }
    } else if (users.length && !flags.force)
      fail(
        `${users.length} file(s) depend on ${id}, like ${users[0]}, and would stop working. Change them first, or add --force.`,
      );
    if (Object.keys(spec.dependencies ?? {}).length)
      notes.push(
        `Its npm packages stay installed: ${Object.keys(spec.dependencies).join(', ')}. Remove them with pnpm remove if nothing else uses them.`,
      );
  } else {
    paths.push(systemDirOf(ROOT, id));
    if (SYSTEM_IDS.length === 1) fail(`${id} is the only design system, and prototypes need one. Add another first.`);
    if (id === DEFAULT_SYSTEM)
      fail(`${id} is the default design system. Set defaultSystem in studio.config.json to another one first.`);
    const users = [];
    const protoRoot = rel('src', 'prototypes');
    for (const who of fs.existsSync(protoRoot)
      ? fs.readdirSync(protoRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())
      : []) {
      for (const proto of fs
        .readdirSync(path.join(protoRoot, who.name), { withFileTypes: true })
        .filter(entry => entry.isDirectory())) {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(protoRoot, who.name, proto.name, 'meta.json'), 'utf8'));
          if (meta.systemId === SYSTEM_SPECS[id].studioId || meta.rebuild?.targetSystemId === SYSTEM_SPECS[id].studioId)
            users.push(`${who.name}/${proto.name}`);
        } catch {
          /* not a prototype */
        }
      }
    }
    for (const module of Object.values(MODULES)) {
      if (module?.section?.items !== 'prototypes' || module.section.byPerson || !module.section.folder) continue;
      const folder = rel(module.section.folder);
      for (const item of fs.existsSync(folder)
        ? fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory())
        : []) {
        try {
          const meta = JSON.parse(fs.readFileSync(path.join(folder, item.name, 'meta.json'), 'utf8'));
          if (meta.systemId === SYSTEM_SPECS[id].studioId || meta.rebuild?.targetSystemId === SYSTEM_SPECS[id].studioId)
            users.push(`${module.section.key}/${item.name}`);
        } catch {
          /* not an item */
        }
      }
    }
    const references = [];
    const scan = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.name.startsWith('.') || file === rel(systemDirOf(ROOT, id))) continue;
        if (entry.isDirectory()) scan(file);
        else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name === 'AGENTS.md')) {
          const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
          if (
            [...text.matchAll(/\]\(([^)\s]+)\)/g)].some(m => {
              const href = m[1].split('#')[0];
              if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return false;
              const target = href.startsWith('/') ? rel('src' + href) : path.resolve(path.dirname(file), href);
              const root = rel(systemDirOf(ROOT, id));
              return target === root || target.startsWith(root + path.sep);
            })
          )
            references.push(path.relative(ROOT, file));
        }
      }
    };
    scan(rel('src'));
    const rootInstructions = fs.readFileSync(rel('AGENTS.md'), 'utf8');
    if (rootInstructions.includes(systemDirOf(ROOT, id) + '/')) references.push('AGENTS.md');
    if (references.length && !flags.force)
      fail(
        references.length +
          ' file(s) reference ' +
          id +
          ', like ' +
          references[0] +
          '. Update their links before removing this system.',
      );
    if (users.length && !flags.force)
      fail(`${users.length} prototype(s) use ${id}, like ${users[0]}. Change their "system" first, or add --force.`);
  }
  const abs = paths.map(p => removable(p)).filter(a => fs.existsSync(a));
  if (detached.length) {
    say(`These files use ${id} and would keep their current values as plain code:`);
    for (const { file } of detached) say(`  ${file}`);
  }
  say(`This would delete:`);
  for (const a of abs) say(`  ${path.relative(ROOT, a)}`);
  for (const n of notes) say(n);
  if (!flags.yes) {
    say();
    say('Nothing was changed. To remove it, run the same command with --yes.');
    return;
  }
  for (const { file, after } of detached) fs.writeFileSync(rel(file), after);
  const remaining = isModule ? moduleConsumers(ROOT, id) : [];
  if (remaining.length) {
    for (const { file, before } of detached) fs.writeFileSync(rel(file), before);
    fail(`${remaining[0]} still uses ${id} after it was taken out. Nothing was changed.`);
  }
  for (const a of abs) {
    fs.rmSync(a, { recursive: true, force: true });
    removeEmptyParents(a);
  }
  registerCapability(isModule ? 'module' : 'system', id, false);
  if (!isModule)
    run('pnpm', ['install', '--lockfile-only', '--ignore-scripts', '--prefer-offline', '--no-frozen-lockfile']);
  syncInFreshProcess();
  say(`Removed ${id}.`);
}

function create(kind) {
  const [id] = positional;
  if (!id || !ID.test(id))
    fail(`Usage: pnpm studio create-${kind} <id> [--label <name>]. The id is lowercase letters, numbers, and dashes.`);
  const label = flags.label ?? titleOf(id);
  if (/[\n\r<>`$\\]/.test(label)) fail('The label should be plain text.');
  const template = rel('src', 'platform', 'node', 'templates', kind);
  // A new module requires the platform it was made with, so a release never edits the template.
  const fill = text =>
    text.replaceAll('__ID__', id).replaceAll('__LABEL__', label).replaceAll('__REQUIRES__', PLATFORM_VERSION);
  const moves = fs
    .readdirSync(template, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const from = path.relative(template, path.join(entry.parentPath, entry.name));
      const file = fill(from)
        .split(path.sep)
        .join('/')
        .replace(/^instructions\//, '');
      return { from, to: `${kind === 'module' ? newModuleDir(id) : newSystemDir(id)}/${file}` };
    });
  if (kind === 'module' ? moduleFolderTaken(ROOT, id) : systemFolderTaken(ROOT, id))
    fail(
      kind === 'module' && fs.existsSync(rel(SUPPLIED_MODULES_ROOT, id))
        ? `There's already a module called "${id}", and it ships with the starter in ${SUPPLIED_MODULES_ROOT}/. A team module can't reuse a supplied module's id.`
        : `There's already a ${kind} called "${id}".`,
    );
  if (kind === 'module' && SECTION_TAKEN(id))
    fail(`"${id}" is already the address of another module, or a contributor's folder. Choose another id.`);
  for (const move of moves) {
    if (fs.existsSync(rel(move.to))) fail(`${move.to} already exists.`);
    say(`Create ${move.to}`);
  }
  say(`Register ${kind} ${id} in studio.config.json and synchronize agent routing.`);
  if (!flags.yes) {
    say('Nothing written. Apply this scaffold with --yes.');
    return;
  }
  const installationId =
    kind === 'system' ? allocateResourceIdentity(retainedResourceIds(ROOT, INSTALLED_FILE_TYPES)) : undefined;
  const written = [];
  const backups = new Map();
  if (kind === 'system') backups.set(rel('pnpm-lock.yaml'), fs.readFileSync(rel('pnpm-lock.yaml')));
  try {
    for (const m of moves) {
      const to = rel(m.to);
      if (fs.existsSync(to)) throw new Error(`${m.to} already exists.`);
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const content = fill(fs.readFileSync(path.join(template, m.from), 'utf8'));
      let source = content;
      if (kind === 'system' && m.from === 'system.ts') source = editDeclaration(content, { studioId: installationId });
      if (kind === 'system' && m.from === 'package.json') {
        const host = JSON.parse(fs.readFileSync(rel('package.json'), 'utf8'));
        source =
          JSON.stringify(
            {
              ...JSON.parse(content),
              name: `@studio-system/${installationId}`,
              peerDependencies: Object.fromEntries(['react', 'react-dom'].map(name => [name, host.dependencies[name]])),
            },
            null,
            2,
          ) + '\n';
      }
      fs.writeFileSync(to, source);
      written.push(to);
    }
    registerCapability(kind, id, true, file => backups.set(file, fs.readFileSync(file)));
    if (kind === 'system')
      run('pnpm', ['install', '--lockfile-only', '--ignore-scripts', '--prefer-offline', '--no-frozen-lockfile']);
    const problem = checkInFreshProcess();
    if (problem) throw new Error(problem);
  } catch (e) {
    for (const f of written.reverse()) {
      fs.rmSync(f, { force: true });
      removeEmptyParents(f);
    }
    for (const [file, content] of backups) fs.writeFileSync(file, content);
    fail(`Nothing was made. ${e.message}`);
  }
  syncInFreshProcess();
  say(`Made the ${kind} "${id}" in ${kind === 'module' ? newModuleDir(id) : newSystemDir(id)}/.`);
}

function SECTION_TAKEN(id) {
  const keys = new Set(Object.values(MODULES).flatMap(m => (m?.section ? [m.section.key] : [])));
  const contributors = Object.keys(loadContributors());
  const folders = fs.existsSync(rel('src', 'prototypes')) ? fs.readdirSync(rel('src', 'prototypes')) : [];
  return keys.has(id) || contributors.includes(id) || folders.includes(id);
}

function check() {
  const problem = checkInFreshProcess(say);
  if (problem) say(problem);
  if (problem) process.exit(1);
}

function configure() {
  const changes = Object.fromEntries(
    ['name', 'tagline', 'usage'].filter(key => flags[key] !== undefined).map(key => [key, flags[key]]),
  );
  if (flags.system !== undefined) changes.defaultSystem = flags.system;
  if (flags.maintainers !== undefined) {
    const [id, members] = flags.maintainers.split('=');
    if (!id || members === undefined) fail('Use --maintainers system=key,key, or system= to clear assignments.');
    changes.systemMaintainers = {
      ...CONFIG.systemMaintainers,
      [id]: members
        .split(',')
        .map(key => key.trim())
        .filter(Boolean),
    };
  }
  if (flags.admins !== undefined)
    changes.admins = flags.admins
      .split(',')
      .map(key => key.trim())
      .filter(Boolean);
  if (!Object.keys(changes).length)
    fail(
      'Usage: pnpm studio configure [--name "My Studio"] [--usage personal|team] [--system <id>] [--tagline "..."] [--admins key,key] [--maintainers system=key,key] [--recovery] [--yes]. Pass only the settings to change; the rest are kept.',
    );
  const plan = planSettings({
    root: ROOT,
    modules: Object.values(MODULES),
    systems: SYSTEM_IDS,
    platformId: PLATFORM_ID,
    contributors: loadContributors(),
    changes,
  });
  say(JSON.stringify(changes, null, 2));
  for (const pin of plan.pins) say(`Keep ${path.relative(ROOT, pin.file)} on ${DEFAULT_SYSTEM}.`);
  if (!flags.yes) {
    say('Nothing written. Apply these choices with --yes.');
    return;
  }
  applySetupChanges(plan.edits);
  syncInFreshProcess();
  say('Updated studio.config.json.');
}

function status() {
  const systemContent = ['principles', 'personas'].map(
    name => `${systemDirOf(ROOT, DEFAULT_SYSTEM)}/context/${name}.md`,
  );
  const report = {
    config: { name: CONFIG.name, usage: CONFIG.usage, defaultSystem: DEFAULT_SYSTEM },
    contributor: resolveContributor(),
    modules: {
      enabled: ENABLED_MODULES.map(module => module.id),
      disabled: Object.keys(MODULES).filter(id => !ENABLED_MODULES.some(module => module.id === id)),
    },
    systems: [PLATFORM_ID, ...CONFIG.systems],
    systemContentPlaceholders: systemContent.filter(
      file => fs.existsSync(rel(file)) && fs.readFileSync(rel(file), 'utf8').includes('**Placeholder.**'),
    ),
    problems: configProblems(CONFIG, Object.values(MODULES), SYSTEM_IDS, PLATFORM_ID, Object.keys(loadContributors())),
  };
  if (flags.json) say(JSON.stringify(report, null, 2));
  else {
    say(`${report.config.name} (${report.config.usage})`);
    say(`Contributor: ${report.contributor ?? 'not registered'}. Default system: ${DEFAULT_SYSTEM}.`);
    say(`Enabled: ${report.modules.enabled.join(', ')}. Disabled: ${report.modules.disabled.join(', ') || 'none'}.`);
    for (const file of report.systemContentPlaceholders) say(`Team context still has starter examples: ${file}`);
    for (const problem of report.problems) say(problem);
    say('This reports current files, not setup completion. Verify with pnpm build and a first prototype.');
  }
}

function context() {
  if (positional.length !== 1) fail('Usage: pnpm studio context src/prototypes/<contributor>/<prototype> [--json]');
  try {
    const problems = configProblems(
      CONFIG,
      Object.values(MODULES),
      SYSTEM_IDS,
      PLATFORM_ID,
      Object.keys(loadContributors()),
    );
    if (problems.length) fail(problems.join('\n'));
    const report = prototypeContext({
      root: ROOT,
      folder: positional[0],
      config: CONFIG,
      systems: SYSTEM_SPECS,
      modules: ENABLED_MODULES,
      contributor: resolveContributor(),
      contributors: Object.keys(loadContributors()),
    });
    say(JSON.stringify(report, null, 2));
  } catch (error) {
    fail(error.message);
  }
}

// The prototype folder a command names, as its contributor key and folder name.
function prototypeArg(usage) {
  const match = /^src\/prototypes\/([^/]+)\/([^/]+)\/?$/.exec(positional[0] ?? '');
  if (positional.length !== 1 || !match)
    fail(`Usage: pnpm studio ${command} src/prototypes/<contributor>/<prototype>${usage}`);
  return { key: match[1], id: match[2], folder: `src/prototypes/${match[1]}/${match[2]}` };
}

// The prototype menu's Rename and Duplicate, with the same checks as the dev server's routes
// (src/platform/node/build/vite-files-plugin.js): only a prototype you own. They get commands because they
// repair links and assign identities, which hand edits get wrong; simpler actions are in the organize-prototype skill.
function organize(action) {
  const usage = action === 'rename' ? ' --title "..."' : ' [--title "..."] [--system <id> | --no-system]';
  const { key, id, folder } = prototypeArg(usage);
  const owned = ownedPrototype(key, id, resolveContributor());
  if (owned.error) fail(owned.error);
  try {
    if (action === 'rename') {
      if (flags.title === undefined) fail(`Usage: pnpm studio rename ${folder}${usage}`);
      const { id: next } = renamePrototype({ key, id, title: flags.title });
      say(
        next === id
          ? `Renamed ${folder}.`
          : `Renamed ${folder} to src/prototypes/${key}/${next}. Its links were updated.`,
      );
    } else {
      if (flags['no-system'] && flags.system !== undefined) fail('Use --system or --no-system, not both.');
      const { title } = JSON.parse(fs.readFileSync(path.join(owned.dir, 'meta.json'), 'utf8'));
      const system = flags['no-system'] ? null : flags.system;
      const { id: copy } = duplicatePrototype({ key, id, title: flags.title ?? `${title} copy`, system });
      say(`Duplicated ${folder} to src/prototypes/${key}/${copy}.`);
    }
  } catch (error) {
    fail(error.message);
  }
}

// The same Download as the prototype's menu: one HTML file that opens without Studio. Saved where a browser
// would put it, ~/Downloads, unless --out names the file.
async function download() {
  const { key, id } = prototypeArg(' [--out <file>]');
  const out = path.resolve(flags.out ?? path.join(os.homedir(), 'Downloads', `${id}.html`));
  try {
    const html = await downloadPrototype({ key, id });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html);
    say(`Downloaded ${positional[0]} to ${out} (${(Buffer.byteLength(html) / 1e6).toFixed(1)} MB).`);
  } catch (error) {
    fail(error.message);
  }
}

const commands = {
  configure,
  status,
  context,
  download,
  rename: () => organize('rename'),
  duplicate: () => organize('duplicate'),
  list,
  check,
  sync: () => {
    say(syncAgents() ? 'Updated AGENTS.md.' : 'AGENTS.md is up to date.');
    syncSkills();
  },
  enable: () => setEnabled(positional[0], true),
  disable: () => setEnabled(positional[0], false),
  'rename-system': () => lifecycle('rename'),
  'archive-system': () => lifecycle('archive'),
  'restore-system': () => lifecycle('restore'),
  'delete-system': () => lifecycle('delete'),
  remove,
  'create-module': () => create('module'),
  'create-system': () => create('system'),
};
if (!command || !Object.hasOwn(commands, command)) {
  console.error(
    `Usage: pnpm studio <command>\n  ${[...Object.keys(commands), 'identity-audit', 'identify'].join(', ')}\nRun pnpm studio --help for what each does.`,
  );
  process.exit(command ? 1 : 0);
}
if (flags.recovery && command !== 'configure') fail('--recovery is only for explicit configuration setup or recovery.');
const applies = flags.yes || ['enable', 'disable'].includes(command);
const sharedChange = ['configure', 'enable', 'disable', 'remove', 'create-module', 'create-system'].includes(command);
if (
  applies &&
  sharedChange &&
  !(command === 'configure' && flags.recovery) &&
  studioRole(CONFIG, resolveContributor(), Object.keys(loadContributors())) !== 'admin'
)
  fail(
    'Only an Admin can apply shared configuration changes. Use a pull request for a proposal. Initial setup or recovery uses configure --recovery.',
  );
if (applies && flags.recovery)
  say('Explicit configuration recovery: repository access is being used to restore local permissions.');
await commands[command]();
