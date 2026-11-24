import { canvasIdentity } from './identity.ts';
// The canvas tools on a canvas file, from the command line, for agents that have no browser:
//
//   pnpm canvas <file.excalidraw> <tool> '<json>'     run a tool on a canvas
//   pnpm canvas help [tool]                            list the tools, or explain one
//
// These are the same tools as the live API in the open canvas (tools.ts), with the same arguments.
// Read the result on stdout; a change is written to the file, and an open canvas takes it in as it
// happens. The file is JSON in, JSON out, so nothing is run from the arguments.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { artifactSlug, type FileTypeSpec } from '../../core/fileTypes.ts';
import { prototypeAddress, artifactAddress, parsePrototypeAddress, resourceId } from '#studio/files';
import { addressOf, canonicalPath, parseAddress } from '../../core/roots.ts';
import { FORMAT_VERSION, stringifyScene } from './slim.ts';
import { help, run, ToolError, type Ctx, type El, type ArtifactInfo } from './tools.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PROTOS = path.join(ROOT, 'src', 'prototypes');

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const [first, second, third] = process.argv.slice(2);
if (!first || first === 'help' || first === '--help') {
  console.log(JSON.stringify(help(second), null, 2));
  process.exit(0);
}

// The canvas file, inside a prototype's folder and nowhere else.
const file = path.resolve(process.cwd(), first);
if (!file.endsWith('.excalidraw')) fail(`${first} isn't a canvas. Canvases are .excalidraw files in a prototype.`);
if (!fs.existsSync(file))
  fail(
    `${first} doesn't exist. Make a canvas with + → New canvas in the app, or write an empty one (src/platform/modules/canvas/skills/use-canvas/SKILL.md).`,
  );
const real = fs.realpathSync(file);
// A prototype is src/prototypes/<contributor>/<prototype>/; an artifact of a module's section of prototype-shaped
// folders (a section artifact, src/examples/<id>/) is opened under the section's key (src/platform/core/roots.ts).
const { PROTOTYPE_SECTIONS } = (await import(
  pathToFileURL(path.join(ROOT, 'src', 'platform', 'node', 'lib', 'modules.js')).href
)) as {
  PROTOTYPE_SECTIONS: { key: string; dir: string }[];
};
const inSection = PROTOTYPE_SECTIONS.map(s => ({
  key: s.key,
  rel: fs.existsSync(s.dir) ? path.relative(fs.realpathSync(s.dir), real).split(path.sep) : ['..'],
})).find(s => s.rel[0] !== '..' && !path.isAbsolute(s.rel[0]) && s.rel.length >= 2);
const inProtos = path.relative(fs.realpathSync(PROTOS), real).split(path.sep);
if (!inSection && (inProtos[0] === '..' || path.isAbsolute(path.relative(PROTOS, real)) || inProtos.length < 3))
  fail(
    `${first} isn't in a prototype. A canvas is at src/prototypes/<contributor>/<prototype>/….excalidraw or inside an installed module's prototype section.`,
  );
const [contributor, prototype] = inSection ? [inSection.key, inSection.rel[0]] : inProtos;

const tool = second ?? fail("Usage: pnpm canvas <file.excalidraw> <tool> '<json>'. Tools: pnpm canvas help");
let args: unknown = {};
try {
  args = third && third !== '-' ? JSON.parse(third) : third === '-' ? JSON.parse(fs.readFileSync(0, 'utf8')) : {};
} catch (error) {
  fail(`the arguments aren't valid JSON: ${(error as Error).message}`);
}

const text = fs.readFileSync(real, 'utf8');
let scene: {
  elements?: El[];
  appState?: { viewBackgroundColor?: string; gridSize?: number | null };
  studioVersion?: number;
};
try {
  scene = JSON.parse(text);
} catch (error) {
  fail(`${first} isn't valid JSON: ${(error as Error).message}`);
}
if (!Array.isArray(scene!.elements)) fail(`${first} isn't a canvas: it has no list of elements.`);
if ((scene!.studioVersion ?? 1) > FORMAT_VERSION)
  fail(`${first} was written by a newer copy of the app. Update before changing it.`);

// What the tools need to know about the app: the artifacts in this canvas's prototype, from the manifest. Files written
// directly get their identity first, and the manifest is built fresh, so a view or canvas made a moment ago is included
// whether or not the dev server is running.
type PrototypeRef = {
  contributorKey: string;
  id: string;
  studioId?: string;
  screens?: { name: string; width: number }[];
};
const lib = (file: string) => pathToFileURL(path.join(ROOT, 'src', 'platform', 'node', file)).href;
const [{ identifyAuthored }, { INSTALLED_FILE_TYPES }, { resolveContributor }, { buildManifest }] = (await Promise.all([
  import(lib('lib/prototype-identification.js')),
  import(lib('lib/installed-file-types.js')),
  import(lib('cli/resolve-contributor.js')),
  import(lib('build/build-manifest.js')),
])) as [
  { identifyAuthored: (...args: unknown[]) => { folder: string; error?: Error }[] },
  { INSTALLED_FILE_TYPES: unknown },
  { resolveContributor: () => string | null },
  {
    buildManifest: (options: { quiet: boolean }) => {
      manifest: { prototypes: PrototypeRef[]; sections?: Record<string, PrototypeRef[]> };
    };
  },
];
if (!inSection)
  identifyAuthored(ROOT, INSTALLED_FILE_TYPES, [`src/prototypes/${contributor}/${prototype}`], resolveContributor);
const { manifest } = buildManifest({ quiet: true });
const everything = [...manifest.prototypes, ...Object.values(manifest.sections ?? {}).flat()];
// A prototype's artifacts are in a file of their own (src/platform/node/build/build-manifest.js).
const itemsOf = (x: PrototypeRef): { path: string; fileType: string; studioId?: string }[] => {
  const file = path.join(ROOT, 'public', 'prototypes', 'artifacts', x.contributorKey, `${x.id}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
};
const { FILE_TYPES } = (await import(
  pathToFileURL(path.join(ROOT, 'src', 'platform', 'node', 'lib', 'file-types.js')).href
)) as {
  FILE_TYPES: Record<string, FileTypeSpec>;
};

const title = (p: string) =>
  artifactSlug(p)
    .split('/')
    .pop()!
    .split(/[-_]/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
const current =
  everything.find(x => x.contributorKey === contributor && x.id === prototype) ??
  fail('This canvas prototype is missing from the manifest. Check its meta.json.');
// Identity was assigned above when this contributor may edit the prototype; otherwise its owner or an Admin has to.
const identified = (id: string | undefined, what: string) =>
  id
    ? resourceId(id)
    : fail(`${what} has no identity yet. Its owner or an Admin can assign it with pnpm studio identify.`);
const base = inSection
  ? addressOf(contributor, prototype)
  : prototypeAddress(identified(current.studioId, 'This canvas prototype'));
const linkOf = (x: PrototypeRef, item: { path: string; studioId?: string }) =>
  inSection
    ? `${addressOf(x.contributorKey, x.id)}/${artifactSlug(item.path)}`
    : artifactAddress(identified(x.studioId, `Prototype ${x.id}`), identified(item.studioId, item.path));
const ctx: Ctx = {
  base,
  artifact(appPath) {
    // A canvas shows only its own prototype's artifacts.
    if (!appPath.startsWith(`${base}/`)) return null;
    const identityAddress = !inSection && parsePrototypeAddress(appPath);
    const address = inSection && parseAddress(appPath.split('/').map(decodeURIComponent).join('/'));
    const proto = identityAddress
      ? everything.find(x => x.studioId === identityAddress.prototypeId)
      : address
        ? everything.find(x => x.contributorKey === address.contributor && x.id === address.id)
        : undefined;
    const artifact =
      proto &&
      itemsOf(proto).find(i =>
        identityAddress
          ? i.studioId === identityAddress.artifactId
          : address && artifactSlug(i.path) === address.rest.join('/'),
      );
    if (!artifact) return null;
    const type = FILE_TYPES[artifact.fileType];
    const preview = Boolean(type?.capabilities.embeds.includes('canvas'));
    return {
      path: appPath,
      sourcePath: artifact.path,
      title: title(artifact.path),
      type: artifact.fileType,
      typeLabel: type?.label ?? 'File',
      preview,
      // The same rule as the app's resolveArtifact.ts: a live preview of a type that uses a system shows its screens.
      ...(preview && type?.systemUsage === 'assigned' && { screens: proto.screens }),
    };
  },
  artifacts: () =>
    everything
      .filter(x => x.contributorKey === contributor && x.id === prototype)
      .flatMap(x => itemsOf(x).map(i => linkOf(x, i)))
      .map(p => ctx.artifact(p))
      .filter((i): i is ArtifactInfo => i !== null),
  linkPath: link =>
    inSection
      ? link.startsWith('/') && !link.startsWith('//')
        ? canonicalPath(link)
        : null
      : parsePrototypeAddress(link)?.artifactId
        ? link
        : null,
};

try {
  if (tool === 'mermaid') {
    // The Mermaid converter reads SVG with a browser's DOM; linkedom is one in Node.
    const { DOMParser, parseHTML } = await import('linkedom');
    Object.assign(globalThis, { DOMParser, document: parseHTML('<html><body></body></html>').document });
    const { layoutMermaid } = await import('./mermaid.ts');
    args = { ...(args as object), diagram: await layoutMermaid((args as { source?: unknown }).source) };
  }
  const result = run(scene!.elements!, tool, args, ctx);
  if (!['describe', 'help', 'artifacts'].includes(tool)) {
    const { resolveContributor } = await import(
      pathToFileURL(path.join(ROOT, 'src/platform/node/cli/resolve-contributor.js')).href
    );
    const { canChange } = await import(pathToFileURL(path.join(ROOT, 'src/platform/node/build/files/policy.js')).href);
    const prototypeRoot = inSection
      ? path.join(PROTOTYPE_SECTIONS.find(section => section.key === contributor)!.dir, prototype)
      : path.join(PROTOS, contributor, prototype);
    if (!canChange(contributor, resolveContributor(), prototypeRoot))
      fail('Only the prototype owner or an Admin can change this canvas.');
    const metadata = JSON.parse(fs.readFileSync(path.join(prototypeRoot, 'meta.json'), 'utf8'));
    if (metadata.status !== undefined && metadata.status !== 'active')
      fail('Restore this prototype before changing its canvas.');
    resourceId(canvasIdentity.read(text));
    if (fs.readFileSync(real, 'utf8') !== text)
      fail('The canvas changed. Read it again before applying this operation.');
    const next = stringifyScene(result.elements, scene!.appState, undefined, canvasIdentity.read(text));
    const tmp = `${real}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, next);
    fs.renameSync(tmp, real);
  }
  console.log(JSON.stringify(result.result, null, 2));
} catch (error) {
  if (error instanceof ToolError) fail(error.message);
  throw error;
}
