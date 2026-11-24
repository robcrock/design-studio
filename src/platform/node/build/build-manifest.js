import { cssProblems } from '../lib/css-scope.js';
import { systemLibraryInventory } from '../lib/system-dependencies.js';
import { scopePolicy } from '../lib/scope.js';
import { prototypeAssignment } from '../lib/prototype-assignment.js';
import { prototypeSourceForIdentity } from '../lib/resource-directory.js';
// Usage: node src/platform/node/build/build-manifest.js [--strict] [--deploy]
//   --strict  exits 1 if any meta.json is invalid
//   --deploy  leaves archived prototypes and views out (src/platform/core/archive.ts), for the deployed site
import crypto from 'node:crypto';
import { knowledgeOwners, skillCatalog } from '../lib/agent-skills.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE_SYSTEMS, SYSTEM_SOURCES, SYSTEM_SPECS, refreshSystems } from '../../modules/systems/node/systems.js';
import { PLATFORM_ID } from '../../modules/systems/node/systems.js';
import { isHelper, artifactSlug } from '../../core/fileTypes.ts';
import { jsonIdentity } from '../../core/resourceIdentity.ts';
import { SYSTEM_CONTENT_KEY, SYSTEM_CONTENT_SECTIONS, TEAM_SYSTEMS_ROOT, rootOf, contentId } from '../../core/roots.ts';
import { STATUSES, forDeploy, linksToArchived, parseStatus } from '../../core/archive.ts';
import { byOrder, parseOrder } from '../../core/order.ts';
import { parseMaintainers } from '../../core/permissions.ts';
import { FILE_TYPES, INSTALLED_FILE_TYPES, fileTypeOf, systemContentTypeOf, isTextFile } from '../lib/file-types.js';
import { auditResourceIdentities } from '../lib/resource-identity-audit.js';
import { ENABLED_MODULES, MODULES, MODULE_DIRS, PROTOTYPE_SECTIONS, SECTION_KEYS } from '../lib/modules.js';
import { frontmatter } from '../lib/frontmatter.js';
import { moduleBuilds } from '../lib/module-builds.js';
import { contributorsSignature, loadContributors } from '../lib/contributors.js';
import { systemContentProblems } from '../../modules/systems/content/node/content-check.js';
import { systemDocs } from '../../modules/systems/node/docs.js';
import { themeTokens } from '../../modules/systems/themeTokens.ts';
import { FORMAT_VERSIONS } from '../../core/formats.ts';
import { platformReferences } from '../lib/platform-references.js';
import { systemInstructions } from '../../modules/systems/content/node/instructions.js';
import { systemContentMap } from '../../modules/systems/content/map.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PROTOS = path.join(ROOT, 'src', 'prototypes');

const OUT_DIR = path.join(ROOT, 'public', 'prototypes');
const OUT = path.join(OUT_DIR, 'manifest.json');
// Each prototype's artifacts, one file each: artifacts/<contributor>/<prototype>.json. The app fetches a
// prototype's when it opens it, so the manifest every visitor downloads stays small however many
// files prototypes hold.
const ARTIFACTS_DIR = path.join(OUT_DIR, 'artifacts');
// How many component doc gaps the build lists before summarizing the rest.
const DOC_WARNINGS = 5;

const dirs = p =>
  fs.existsSync(p)
    ? fs
        .readdirSync(p, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
        .sort()
    : [];

// A prototype's artifacts (see src/platform/context/file-types.md), in the order the file tree shows them: at each
// level, files first, then folders, each alphabetical, unless meta.json "order" says otherwise
// (src/platform/core/order.ts). Hidden files and helpers (names starting with an underscore) are skipped.
// `typeOf` says which type opens a file (or null for a plain file), and `skip` which folders are
// left out. Links are never followed: a symlink is neither a file nor a folder here.
const inPrototype = { typeOf: name => (isHelper(name) ? null : fileTypeOf(name)), skip: isHelper };
function artifactsIn(dir, base = '', { typeOf, skip, order } = inPrototype) {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(e => !e.name.startsWith('.'));
  const files = entries
    .filter(e => e.isFile())
    .flatMap(e => {
      const fileType = typeOf(e.name, path.join(dir, e.name));
      return fileType ? [{ name: e.name, path: base + e.name, dir: false, fileType }] : [];
    });
  const folders = entries
    .filter(e => e.isDirectory() && !skip(e.name))
    .map(e => ({ name: e.name, path: base + e.name, dir: true }));
  return byOrder([...files, ...folders], order).flatMap(e =>
    e.dir
      ? artifactsIn(path.join(dir, e.name), `${e.path}/`, { typeOf, skip, order })
      : [{ path: e.path, fileType: e.fileType }],
  );
}

// In the system content, a document opens as a document and every other text file opens as text (a
// script in a skill's folder). Binary and very large files are left out.
const inSystemContent = {
  typeOf: (name, file) => {
    const id = systemContentTypeOf(name);
    return id && (!FILE_TYPES[id].fallback || isTextFile(file)) ? id : null;
  },
  skip: name => name === 'node_modules',
};

// Problems with a folder's artifacts: two sharing a URL, or a file its type rejects (a view needs a
// default export, and so on: <module folder>/type.ts). Printed; returns how many.
function checkArtifacts(dir, artifacts, out = console, prototype) {
  let errors = 0;
  const seen = new Set();
  for (const item of artifacts) {
    const file = path.relative(ROOT, path.join(dir, item.path));
    if (seen.has(artifactSlug(item.path))) {
      out.error(`[manifest] ${file}: another file here has the same name. Rename one; they'd share a URL.`);
      errors++;
    }
    seen.add(artifactSlug(item.path));
    const { check, fidelity } = FILE_TYPES[item.fileType];
    if (!check && !fidelity) continue;
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (check) {
      for (const problem of check({ source, frontmatter: frontmatter(source), prototype })) {
        out.error(`[manifest] ${file}: ${problem}`);
        errors++;
      }
    }
    if (fidelity?.isLofi(source)) item.lofi = true;
  }
  return errors;
}

// Canvases and documents that stay on the deployed site but link to an archived prototype, which
// isn't there. `archived` is forDeploy's list of what it left out (paths in the app's file globs).
// Returns a sentence for each such file.
function archivedLinkWarnings(kept, archived) {
  const prototypes = archived.map(g =>
    g
      .replace(/^\/prototypes/, '')
      .slice(0, -3)
      .split('/')
      .map(encodeURIComponent)
      .join('/'),
  );
  const warnings = [];
  for (const proto of kept) {
    for (const item of proto.artifacts) {
      // Views are code: a link in one is the author's own business.
      if (FILE_TYPES[item.fileType].language === 'tsx') continue;
      const file = path.join(ROOT, 'src', rootOf(proto.contributorKey, proto.id), item.path);
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const linked = linksToArchived(text, prototypes);
      if (linked.length)
        warnings.push(
          `[manifest] ${path.relative(ROOT, file)} links to an archived prototype (${linked.map(p => decodeURIComponent(p).replace(/^\//, '')).join(', ')}). The deployed site shows a placeholder there.`,
        );
    }
  }
  return warnings;
}

// Reads one prototype's folder (a person's in src/prototypes/, or an item of a module's section, with one folder per item
// in src/examples/) into its manifest entry, or null when it can't be used. Problems are printed; `errors` counts
// them. A section whose policy is "maintainers" lists them in each item's meta.json.
function readPrototype(dir, contributorKey, id, out, contributors, policy = 'owner') {
  const maintained = policy === 'maintainers';
  let errors = 0;
  const metaFile = path.relative(ROOT, path.join(dir, 'meta.json'));
  const skip = why => {
    out.error(`[manifest] Skipped ${contributorKey}/${id}: ${metaFile} ${why}`);
    errors++;
    return { entry: null, errors };
  };
  if (!fs.existsSync(path.join(dir, 'meta.json'))) return skip('is missing');
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  } catch (e) {
    return skip(`is not valid JSON (${e.message})`);
  }
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return skip('must be a JSON object');
  if (meta.formatVersion !== FORMAT_VERSIONS.prototype)
    return skip(
      meta.formatVersion === undefined
        ? `needs "formatVersion": ${FORMAT_VERSIONS.prototype}`
        : `has "formatVersion": ${JSON.stringify(meta.formatVersion)}, but this studio reads version ${FORMAT_VERSIONS.prototype}`,
    );
  if (typeof meta?.title !== 'string' || !meta.title.trim()) return skip('needs a "title"');
  // "maintainers" (required where the section's policy is maintainers): the contributor keys of the people who may change it.
  let maintainers;
  if (maintained) {
    maintainers = parseMaintainers(meta.maintainers);
    if (!maintainers) return skip('needs "maintainers": a list with at least one contributor key, like ["samples"]');
    for (const key of maintainers)
      if (!(key in contributors))
        out.warn(`[manifest] ${metaFile}: maintainer "${key}" isn't registered in contributors/`);
  }
  // "order" (optional) lists paths to put first, in sequence (src/platform/core/order.ts).
  let order;
  if (meta.order !== undefined) {
    order = parseOrder(meta.order);
    if (!order) return skip('has an "order" that isn\'t a list of paths');
  }
  const artifacts = artifactsIn(dir, '', { ...inPrototype, order });
  let studioId;
  try {
    studioId = jsonIdentity(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    for (const item of artifacts) {
      const identity = FILE_TYPES[item.fileType].identity;
      if (identity) {
        const id = identity.read(fs.readFileSync(path.join(dir, item.path), 'utf8'));
        if (id) item.studioId = id;
      }
    }
  } catch (error) {
    return skip(`has invalid resource identity (${error.message})`);
  }
  // An artifact's URL is its identity, so a file still waiting for one (the identity audit names it) stays out of the
  // prototype until it has one, instead of breaking every page that links to its siblings.
  if (studioId)
    for (let i = artifacts.length - 1; i >= 0; i--)
      if (FILE_TYPES[artifacts[i].fileType].identity && !artifacts[i].studioId) artifacts.splice(i, 1);
  // Two artifacts can't share a URL (main.tsx next to main.jsx or main.md), and each file type checks its own files.
  errors += checkArtifacts(dir, artifacts, out, {
    contributor: contributorKey,
    id,
    ...(studioId && { studioId }),
    artifacts: artifacts.map(item => ({ studioId: item.studioId, systemUsage: FILE_TYPES[item.fileType].systemUsage })),
  });
  // systemId is an explicit permanent assignment; source keys are derived for runtime imports.
  const { system, systemId, rebuild, problems: assignmentProblems } = prototypeAssignment(meta, PROTOTYPE_SYSTEMS);
  if (assignmentProblems.length) return skip(assignmentProblems[0]);
  if (rebuild) {
    try {
      rebuild.sourcePath = prototypeSourceForIdentity(ROOT, rebuild.sourcePrototypeId);
    } catch (error) {
      return skip(error.message);
    }
  }
  // "status" (optional) is 'active' (the default) or 'archived'.
  let status = null;
  if (meta.status !== undefined) {
    status = parseStatus(meta.status);
    if (!status) return skip(`has "status": ${JSON.stringify(meta.status)}, which isn't one of ${STATUSES.join(', ')}`);
  }
  return {
    errors,
    entry: {
      id,
      contributorKey,
      ...(studioId && { studioId }),
      ...(meta.ownerContributorId && { ownerContributorId: meta.ownerContributorId }),
      title: meta.title,
      ...(SECTION_KEYS.has(contributorKey) && { description: meta.description ?? '' }),
      contributor: maintained
        ? maintainers.map(k => contributors[k]?.name ?? k).join(', ')
        : (contributors[contributorKey]?.name ?? ''),
      ...(!maintained && contributors[contributorKey]?.sample === true && { contributorSample: true }),
      ...(!maintained &&
        contributors[contributorKey]?.avatar && { contributorAvatar: contributors[contributorKey].avatar }),
      ...(!maintained &&
        typeof contributors[contributorKey]?.github === 'string' &&
        contributors[contributorKey].github.trim() && {
          contributorGithub: contributors[contributorKey].github.trim(),
        }),
      created: meta.created ?? null,
      system,
      systemId,
      // The screens its views are laid out at: its system's, or the app's own without one (spec.ts).
      screens: (SYSTEM_SPECS[system] ?? SYSTEM_SPECS[PLATFORM_ID]).screens,
      artifacts,
      ...(meta.systemMissing && { systemMissing: meta.systemMissing }),
      ...(rebuild !== undefined && { rebuild }),
      ...(maintained && { maintainers }),
      ...(status === 'archived' && { status }),
    },
  };
}

// Writes a file only when its text changes, so a dev server doesn't see files it already has as new. What was last
// written is remembered, so a rebuild with thousands of unchanged files checks that each exists and reads none of them.
const written = new Map();
function writeIfChanged(file, text) {
  const exists = fs.existsSync(file);
  if (exists && (written.get(file) === text || fs.readFileSync(file, 'utf8') === text)) {
    written.set(file, text);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  written.set(file, text);
}

// The dev server rebuilds the manifest on every change, and nearly all of it is unchanged prototypes. So a prototype's
// entry is kept between builds, along with what reading it printed, and reused while nothing in its folder has changed
// (each file's name, modified time and size) or any contributor has (their names are in the entries).
const cache = new Map();
let cachedFor = '';
function signatureOf(dir) {
  const parts = [];
  const visit = (abs, base) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === 'node_modules') continue;
      if (e.isDirectory()) {
        parts.push(`${base}${e.name}/`);
        visit(path.join(abs, e.name), `${base}${e.name}/`);
      } else if (e.isFile()) {
        const s = fs.statSync(path.join(abs, e.name));
        parts.push(`${base}${e.name}:${s.mtimeMs}:${s.size}`);
      }
    }
  };
  visit(dir, '');
  return parts.join('\n');
}

// Writes the manifest the app fetches: prototypes without their artifacts (with how many, and a hash
// of them so a changed list is fetched again), and each prototype's artifacts in its own file. The
// system content's sections are few, so theirs stay in the manifest. Files for prototypes that are gone are removed.
function writeManifest(manifest) {
  const wanted = new Set();
  const split = ({ artifacts, ...info }) => {
    const text = JSON.stringify(artifacts);
    const file = path.join(ARTIFACTS_DIR, info.contributorKey, `${info.id}.json`);
    wanted.add(file);
    writeIfChanged(file, text);
    return {
      ...info,
      artifactCount: artifacts.length,
      artifactsHash: crypto.createHash('sha1').update(text).digest('hex').slice(0, 8),
    };
  };
  const prototypes = manifest.prototypes.map(split);
  const sections = Object.fromEntries(
    Object.entries(manifest.sections).map(([key, artifacts]) => [key, artifacts.map(split)]),
  );
  for (const dir of fs.existsSync(ARTIFACTS_DIR) ? fs.readdirSync(ARTIFACTS_DIR, { withFileTypes: true }) : []) {
    if (!dir.isDirectory()) continue;
    for (const f of fs.readdirSync(path.join(ARTIFACTS_DIR, dir.name))) {
      if (!wanted.has(path.join(ARTIFACTS_DIR, dir.name, f)))
        fs.rmSync(path.join(ARTIFACTS_DIR, dir.name, f), { force: true });
    }
    if (!fs.readdirSync(path.join(ARTIFACTS_DIR, dir.name)).length) fs.rmdirSync(path.join(ARTIFACTS_DIR, dir.name));
  }
  writeIfChanged(OUT, JSON.stringify({ ...manifest, prototypes, sections }) + '\n');
}

// Scans src/prototypes/, src/platform/, and src/platform/modules/documentation/pages/, writes public/prototypes/ (manifest.json, and artifacts/), and returns the whole manifest.
// Problems are printed; errors counts them. The dev server calls this on every change
// (vite-manifest-watch-plugin.js), so it's kept fast: one pass, no subprocesses.
// Options: `deploy` leaves archived prototypes and views out (see src/platform/core/archive.ts), `write: false`
// skips writing the file, and `quiet` prints nothing. `touched` is the files the dev server saw change since the last
// build: a prototype with none of them is reused without a look at its files, so a rebuild costs what changed, not
// how many prototypes there are. `archived` in the result lists what deploy
// leaves out, as paths in the app's file globs (src/platform/node/build/vite-globs-plugin.js).
export function buildManifest({ deploy = false, write = true, quiet = false, touched: touchedPaths } = {}) {
  refreshSystems();
  // Only trusted if every path is inside this repo as this script sees it. A path spelled another way (a linked folder)
  // could look unrelated to a prototype that did change, so then nothing is assumed unchanged.
  const touched = touchedPaths?.every(f => path.resolve(f).startsWith(ROOT + path.sep))
    ? touchedPaths.map(f => path.resolve(f))
    : undefined;
  const out = quiet ? { log() {}, warn() {}, error() {} } : console;
  // Display names come from the contributors/<key>.json profiles, so they live in one place.
  const contributors = loadContributors();

  const prototypes = [];
  // Items of the modules' sections of prototype-shaped folders, by section key.
  const sections = Object.fromEntries(PROTOTYPE_SECTIONS.map(s => [s.key, []]));
  let errors = 0;
  const identityAudit = auditResourceIdentities(ROOT, INSTALLED_FILE_TYPES);
  for (const missing of identityAudit.missing) {
    out.error(
      `[identity] ${missing}: permanent identity is missing. The dev server assigns it in prototypes you can edit; otherwise run pnpm studio identify <prototype-folder> --yes.`,
    );
    errors++;
  }
  for (const problem of identityAudit.problems) {
    out.error(`[identity] ${problem}`);
    errors++;
  }
  for (const resource of identityAudit.resources.filter(
    resource => resource.kind === 'prototype' && resource.studioId,
  )) {
    if (JSON.parse(fs.readFileSync(path.join(ROOT, resource.path), 'utf8')).ownerContributorId === undefined) {
      out.error(
        `[identity] ${resource.path}: declare the permanent contributor ownerContributorId. Run pnpm studio identify ${path.posix.dirname(resource.path)} --yes.`,
      );
      errors++;
    }
  }
  const people = contributorsSignature();
  if (people !== cachedFor) {
    cache.clear();
    cachedFor = people;
  }
  const seen = new Set();
  const read = (dir, contributorKey, id, policy) => {
    const key = `${contributorKey}/${id}`;
    seen.add(key);
    let hit = cache.get(key);
    const unchanged =
      hit && hit.policy === policy && touched && !touched.some(f => f === dir || f.startsWith(dir + path.sep));
    const signature = unchanged ? hit.signature : signatureOf(dir);
    if (!hit || hit.signature !== signature || hit.policy !== policy) {
      const messages = [];
      const sink = Object.fromEntries(
        ['log', 'warn', 'error'].map(level => [level, text => messages.push([level, text])]),
      );
      hit = { signature, policy, messages, ...readPrototype(dir, contributorKey, id, sink, contributors, policy) };
      cache.set(key, hit);
    }
    for (const [level, text] of hit.messages) out[level](text);
    errors += hit.errors;
    return hit.entry;
  };
  for (const contributorKey of dirs(PROTOS)) {
    if (SECTION_KEYS.has(contributorKey)) {
      out.error(
        `[manifest] Skipped src/prototypes/${contributorKey}/: "${contributorKey}" is an app page URL, so it can't be a contributor folder`,
      );
      errors++;
      continue;
    }
    for (const id of dirs(path.join(PROTOS, contributorKey))) {
      const entry = read(path.join(PROTOS, contributorKey, id), contributorKey, id);
      if (entry) prototypes.push(entry);
    }
  }
  // A module's section of prototype-shaped folders (src/examples/<id>/, artifacts provided by a module): shaped
  // the same, one folder per id, with maintainers where the section's policy says so.
  for (const section of PROTOTYPE_SECTIONS) {
    for (const id of dirs(section.dir)) {
      const entry = read(path.join(section.dir, id), section.key, id, section.policy);
      if (entry) sections[section.key].push(entry);
    }
  }

  for (const key of cache.keys()) if (!seen.has(key)) cache.delete(key);

  // Context and skills belong to the platform, each enabled module, or a registered system.
  const systemContent = [];
  const maps = {};
  for (const owner of knowledgeOwners(ENABLED_MODULES, SYSTEM_SOURCES)) {
    const system = owner.id;
    if (deploy && owner.kind === 'system' && SYSTEM_SPECS[system]?.status === 'archived') continue;
    const base = path.join(ROOT, owner.root);
    for (const [section, { title, description }] of Object.entries(SYSTEM_CONTENT_SECTIONS)) {
      const dir = path.join(base, section);
      const artifacts = fs.existsSync(dir) ? artifactsIn(dir, '', inSystemContent) : [];
      for (const item of artifacts) {
        if (!item.path.endsWith('.md')) continue;
        const declared = frontmatter(fs.readFileSync(path.join(dir, item.path), 'utf8'))?.title;
        if (typeof declared === 'string' && declared.trim()) item.title = declared;
      }
      if (fs.existsSync(dir)) errors += checkArtifacts(dir, artifacts, out);
      systemContent.push({
        id: contentId(system, section),
        contributorKey: SYSTEM_CONTENT_KEY,
        title,
        description,
        contributor: '',
        created: null,
        system,
        owner,
        artifacts,
      });
    }
    for (const problem of systemContentProblems(base, { scoped: true })) {
      out.error('[manifest] ' + problem);
      errors++;
    }
    const contextDir = path.join(base, 'context');
    const context = {};
    const collect = (dir, prefix = '') => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name.startsWith('.')) continue;
        if (e.isDirectory()) collect(path.join(dir, e.name), prefix + e.name + '/');
        else if (e.isFile() && e.name.endsWith('.md'))
          context[prefix + e.name] = fs.readFileSync(path.join(dir, e.name), 'utf8');
      }
    };
    if (fs.existsSync(contextDir)) collect(contextDir);
    const skillsDir = path.join(base, 'skills');
    const skills = fs.existsSync(skillsDir)
      ? fs
          .readdirSync(skillsDir, { withFileTypes: true })
          .filter(
            e => e.isDirectory() && !e.name.startsWith('.') && fs.existsSync(path.join(skillsDir, e.name, 'SKILL.md')),
          )
          .map(e => {
            const fm = frontmatter(fs.readFileSync(path.join(skillsDir, e.name, 'SKILL.md'), 'utf8')) ?? {};
            return { folder: e.name, name: String(fm.name ?? e.name), description: String(fm.description ?? '') };
          })
      : [];
    const instructions = systemInstructions({
      root: ROOT,
      systemRoot: owner.root,
      platform: owner.kind !== 'system',
      moduleDirs: Object.values(MODULE_DIRS),
    });
    maps[system] = systemContentMap({
      agents: instructions.agents,
      context,
      skills,
      root: owner.root,
    });
    maps[system].missing = [...new Set([...maps[system].missing, ...instructions.missing])];
    for (const file of maps[system].missing) {
      out.error('[manifest] Agent instructions link to ' + file + ', which is missing.');
      errors++;
    }
  }
  // Each prototype system's theme.css may only set values under its own class, like
  // .product-theme, so it can't leak into the app UI or another system.
  for (const [id, sys] of Object.entries(PROTOTYPE_SYSTEMS)) {
    const file = path.join(ROOT, sys.dir, 'styles', 'theme.css');
    if (!fs.existsSync(file)) {
      out.error(`[manifest] ${path.relative(ROOT, file)} is missing (the ${id} system's theme)`);
      errors++;
      continue;
    }
    for (const problem of cssProblems(fs.readFileSync(file, 'utf8'), {
      file,
      themeClass: sys.themeClass,
      packagePolicy: scopePolicy({ root: ROOT, systems: PROTOTYPE_SYSTEMS, modules: ENABLED_MODULES }).packageProblem,
    })) {
      out.error(`[manifest] ${problem}`);
      errors++;
    }
  }

  // Each system's components and tokens, for the Systems pages, and what its component pages lack
  // (src/platform/modules/systems/docs.ts, themeTokens.ts). The app's own system (Platform) is one of them. By
  // default a gap is a warning, and the first few are listed; docs: 'strict' fails the build and
  // 'off' says nothing.
  if (PLATFORM_ID in PROTOTYPE_SYSTEMS) {
    out.error(
      `[manifest] ${TEAM_SYSTEMS_ROOT}/${PLATFORM_ID}/: "${PLATFORM_ID}" is the app's own system, so a prototype system can't use that name`,
    );
    errors++;
  }
  const systems = {};
  for (const [id, sys] of Object.entries(SYSTEM_SOURCES)) {
    const dir = path.join(ROOT, sys.components);
    if (deploy && SYSTEM_SPECS[id]?.status === 'archived') continue;
    const { components, problems } = systemDocs(dir);
    const themeFile = path.join(ROOT, sys.theme);
    const tokens = fs.existsSync(themeFile) ? themeTokens(fs.readFileSync(themeFile, 'utf8'), sys.scope) : [];
    systems[id] = {
      docs: sys.docs,
      origin: sys.origin,
      components,
      tokens,
      libraries: systemLibraryInventory(ROOT, id, SYSTEM_SPECS[id]),
    };
    if (sys.docs === 'off') continue;
    const lines = problems.map(p => `${path.relative(ROOT, path.join(dir, p.file))}: ${p.message}`);
    if (sys.docs === 'strict') {
      for (const line of lines) out.error(`[manifest] ${line}`);
      errors += lines.length;
    } else {
      for (const line of lines.slice(0, DOC_WARNINGS)) out.warn(`[manifest] ${line}`);
      if (lines.length > DOC_WARNINGS)
        out.warn(
          `[manifest] ${id}: and ${lines.length - DOC_WARNINGS} more component doc gap(s). Set docs: 'strict' in the system's system.ts to fail the build on them.`,
        );
    }
  }

  // What the enabled modules contribute through their build.ts (src/platform/core/modules/index.ts, ModuleBuild),
  // such as the Documentation module's Manual.
  const contributions = {};
  for (const [id, build] of moduleBuilds()) {
    if (!build.manifest) continue;
    const result = build.manifest({ root: ROOT, enabled: ENABLED_MODULES.map(m => m.id), out });
    contributions[id] = result.data;
    errors += result.errors;
  }

  // What the deployed site leaves out (src/platform/core/archive.ts). A download build
  // (src/platform/modules/prototypes/node/download.js) keeps only its prototype.
  const { kept, archived } = forDeploy(
    [...prototypes, ...Object.values(sections).flat()],
    process.env.STUDIO_DOWNLOAD || undefined,
  );
  const keptPrototypes = kept.filter(p => !(p.contributorKey in sections));
  const keptSections = Object.fromEntries(
    Object.keys(sections).map(key => [key, kept.filter(p => p.contributorKey === key)]),
  );

  // A canvas or document that stays on the deployed site but links to an archived prototype would show
  // a placeholder there: say which, so the link can be fixed or the prototype unarchived. Never an error.
  if (deploy && archived.length) {
    const links = archivedLinkWarnings(kept, archived);
    for (const line of links.slice(0, DOC_WARNINGS)) out.warn(line);
    if (links.length > DOC_WARNINGS)
      out.warn(`[manifest] and ${links.length - DOC_WARNINGS} more file(s) that link to an archived prototype.`);
  }

  const manifest = {
    prototypes: deploy ? keptPrototypes : prototypes,
    sections: deploy ? keptSections : sections,
    contributions,
    systemContent,
    systemContentMaps: maps,
    platformReferences: platformReferences({
      root: ROOT,
      modules: Object.values(MODULES).filter(Boolean),
      enabled: ENABLED_MODULES.map(m => m.id),
      systemContent,
      systemIdentities: Object.fromEntries(Object.entries(SYSTEM_SPECS).map(([key, spec]) => [key, spec.studioId])),
    }),
    systems,
    skillCatalog: skillCatalog(ROOT, knowledgeOwners(ENABLED_MODULES, SYSTEM_SOURCES)),
  };
  if (write) writeManifest(manifest);
  out.log(
    `[manifest] ${manifest.prototypes.length} prototype(s), ${
      Object.entries(manifest.sections)
        .map(([key, artifacts]) => `${artifacts.length} in ${key}`)
        .join(', ') || 'no sections'
    }, ${systemContent.length} systemContent section(s)${errors ? `, ${errors} problem(s) above` : ''}`,
  );
  if (deploy && archived.length)
    out.log(`[manifest] Left out of the deployed site: ${archived.length} archived prototype(s)`);
  return { manifest, errors, archived: deploy ? archived : [] };
}

// Run as a script: node src/platform/node/build/build-manifest.js [--strict] [--deploy] [--identify]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // pnpm dev passes --identify: like the dev server, it first gives files written while it was stopped their identity.
  if (process.argv.includes('--identify')) {
    const { identifyAuthored, prototypeFolderOf } = await import('../lib/prototype-identification.js');
    const { resolveContributor } = await import('../cli/resolve-contributor.js');
    const folders = auditResourceIdentities(ROOT, INSTALLED_FILE_TYPES).missing.map(prototypeFolderOf);
    for (const result of identifyAuthored(ROOT, INSTALLED_FILE_TYPES, folders, resolveContributor))
      if (!result.error)
        console.log(
          `[identity] Assigned ${result.changed} missing identit${result.changed === 1 ? 'y' : 'ies'} in ${result.folder}.`,
        );
  }
  const { errors } = buildManifest({ deploy: process.argv.includes('--deploy') });
  // pnpm build passes --strict, so a broken meta.json or Manual page fails the build. In dev it's only a warning.
  if (errors && process.argv.includes('--strict')) process.exit(1);
}
