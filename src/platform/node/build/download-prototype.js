// Builds one prototype into a single HTML file a client can open without this studio running.
// The dev server calls it from the prototype menu (vite-files-plugin.js). A separate Vite build
// bundles the prototype's navigation sidebar and all of its artifacts (views, documents, diagrams,
// canvases) with its design system, then the JS, CSS, and fonts are inlined so the file stands alone.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE_SYSTEMS } from '../../modules/systems/node/systems.js';
import { isHelper } from '../../core/fileTypes.ts';
import { byOrder, parseOrder } from '../../core/order.ts';
import { jsonIdentity } from '../../core/resourceIdentity.ts';
import { FILE_TYPES, fileTypeOf } from '../lib/file-types.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const STYLES = path.join(ROOT, 'src', 'platform', 'app', 'styles.css');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');

const shareFileName = title => {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug || 'prototype'}.html`;
};

// A view is a .tsx or .jsx file with a default export (src/platform/modules/view/type.ts).
function isView(file) {
  if (!/\.(tsx|jsx)$/.test(file)) return false;
  const source = fs.readFileSync(file, 'utf8');
  return /export\s+default\b|export\s*\{[^}]*\bas\s+default\b/.test(source);
}

// Discovers all enabled artifacts in navigation order (meta.json "order", then files before folders).
export function prototypeArtifacts(dir, order) {
  const walk = (folder, base = '') => {
    const entries = fs.readdirSync(folder, { withFileTypes: true }).filter(e => !e.name.startsWith('.'));
    const files = entries
      .filter(e => e.isFile())
      .flatMap(e => {
        if (isHelper(e.name)) return [];
        const full = path.join(folder, e.name);
        const fileType = fileTypeOf(e.name);
        if (!fileType) return [];
        if (fileType === 'view' && !isView(full)) return [];
        const source = fs.readFileSync(full, 'utf8');
        const spec = FILE_TYPES[fileType];
        const studioId = spec?.identity?.read(source) ?? undefined;
        const lofi = Boolean(spec?.fidelity?.isLofi(source));
        const hasMermaidFence = fileType === 'document' && /^[ \t]*`{3,}\s*mermaid\b/m.test(source);
        return [
          {
            name: e.name,
            path: base + e.name,
            full,
            dir: false,
            fileType,
            ...(studioId && { studioId }),
            ...(lofi && { lofi: true }),
            ...(hasMermaidFence && { hasMermaidFence: true }),
            ...(fileType === 'diagrams' || fileType === 'canvas' ? { source } : {}),
          },
        ];
      });
    const folders = entries
      .filter(e => e.isDirectory() && !isHelper(e.name))
      .map(e => ({ name: e.name, path: base + e.name, dir: true }));
    return byOrder([...files, ...folders], order).flatMap(entry =>
      entry.dir ? walk(path.join(folder, entry.name), `${entry.path}/`) : [entry],
    );
  };
  return walk(dir);
}

function resolveSystem(meta) {
  if (meta.systemId == null) return { theme: 'prototype-unstyled', label: null };
  const system = Object.values(PROTOTYPE_SYSTEMS).find(spec => spec.studioId === meta.systemId);
  const theme = system?.themeClass && /^[a-z0-9-]+$/.test(system.themeClass) ? system.themeClass : 'prototype-unstyled';
  return { theme, label: system?.label ?? null };
}

function entrySource({ title, studioId, systemLabel, theme, artifacts }) {
  const hasDocs = artifacts.some(item => item.fileType === 'document');
  const hasDiagrams = artifacts.some(item => item.fileType === 'diagrams' || item.hasMermaidFence);
  const hasCanvas = artifacts.some(item => item.fileType === 'canvas');

  const imports = [
    `import { createRoot } from 'react-dom/client';`,
    `import ${JSON.stringify(STYLES)};`,
    `import { DownloadedPrototype, DownloadedEmbedFrame, artifactDisplayLabel, type DownloadedArtifact } from '@/platform/modules/prototypes/viewer/DownloadedPrototype';`,
  ];

  if (hasDocs) {
    imports.push(`import { DocLayout } from '@/platform/app/docs/DocLayout';`);
  }
  if (hasDiagrams) {
    imports.push(`import { MermaidDiagram } from '@/platform/app/diagrams/MermaidDiagram';`);
  }
  if (hasCanvas) {
    imports.push(
      `import { useMemo } from 'react';`,
      `import { Excalidraw, restoreElements, getCommonBounds, FONT_FAMILY } from '@excalidraw/excalidraw';`,
      `import '@excalidraw/excalidraw/index.css';`,
      `import '@/platform/modules/canvas/canvas.css';`,
      `import { parseCanvas } from '@/platform/modules/canvas/format';`,
      `import { EMBED_HEADER_HEIGHT } from '@/platform/app/artifacts/EmbedFrame';`,
    );
  }

  let viewIndex = 0;
  let docIndex = 0;
  const itemsCode = artifacts.map(item => {
    const baseFields = [
      `path: ${JSON.stringify(item.path)}`,
      `fileType: ${JSON.stringify(item.fileType)}`,
      ...(item.studioId ? [`studioId: ${JSON.stringify(item.studioId)}`] : []),
      ...(item.lofi ? [`lofi: true`] : []),
    ];
    if (item.fileType === 'view') {
      const id = `View${viewIndex++}`;
      imports.push(`import ${id} from ${JSON.stringify(item.full)};`);
      baseFields.push(`View: ${id}`);
    } else if (item.fileType === 'document') {
      const id = `Doc${docIndex++}`;
      imports.push(`import * as ${id} from ${JSON.stringify(item.full)};`);
      baseFields.push(
        `Document: ${id}.default`,
        `frontmatter: (${id} as { frontmatter?: Record<string, unknown> }).frontmatter ?? {}`,
      );
    } else if (item.source !== undefined) {
      baseFields.push(`source: ${JSON.stringify(item.source)}`);
    }
    return `{ ${baseFields.join(', ')} }`;
  });

  const docRenderer = hasDocs
    ? `renderDocument={({ artifact, Component }) => {
      const fm = artifact.frontmatter ?? {};
      return (
        <div data-doc-scroll className="relative min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
          <DocLayout
            Component={Component}
            title={fm.title}
            description={fm.description}
            toc={fm.toc}
            scrollKey={artifact.path}
          />
        </div>
      );
    }}`
    : '';

  const diagramRenderer = hasDiagrams
    ? `renderDiagram={({ source, compact }) => <MermaidDiagram source={source} compact={compact} fit zoomable={!compact} />}`
    : '';

  const canvasRenderer = hasCanvas
    ? `renderCanvas={({ text, dark, resolveLink, selectArtifact, renderEmbed }) => (
      <DownloadedCanvas
        key={text}
        text={text}
        dark={dark}
        resolveLink={resolveLink}
        selectArtifact={selectArtifact}
        renderEmbed={renderEmbed}
      />
    )}`
    : '';

  const canvasComponent = hasCanvas
    ? `
function DownloadedCanvas({
  text,
  dark,
  resolveLink,
  selectArtifact,
  renderEmbed,
}: {
  text: string;
  dark: boolean;
  resolveLink: (link: string | null) => DownloadedArtifact | undefined;
  selectArtifact: (artifact: DownloadedArtifact) => void;
  renderEmbed: (target: DownloadedArtifact, width: number, height: number) => React.ReactNode;
}) {
  const scene = useMemo(() => {
    try {
      const parsed = parseCanvas(text);
      const elements = restoreElements(parsed.elements as never, null, { refreshDimensions: true });
      const active = elements.filter(el => !el.isDeleted);
      let camera = { scrollX: 0, scrollY: 0 };
      if (active.length) {
        const [left, top] = getCommonBounds(active);
        camera = { scrollX: Math.round(48 - left), scrollY: Math.round(48 - top) };
      }
      return { elements, background: parsed.background, gridSize: parsed.gridSize ?? undefined, camera };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }, [text]);
  if ('error' in scene) {
    return (
      <div role="alert" className="max-w-2xl space-y-3 p-8">
        <p className="text-sm font-medium">This canvas couldn't be opened.</p>
        <pre className="overflow-auto rounded-md bg-muted p-3 text-sm whitespace-pre-wrap text-muted-foreground">{scene.error}</pre>
      </div>
    );
  }
  return (
    <div className="canvas relative min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/30" data-canvas-opening="ready">
      <div className="canvas-scene absolute inset-0">
        <Excalidraw
          initialData={{
            elements: scene.elements,
            appState: {
              ...scene.camera,
              theme: dark ? 'dark' : 'light',
              viewBackgroundColor: scene.background,
              gridSize: scene.gridSize,
              currentItemFontFamily: FONT_FAMILY.Nunito,
            } as never,
          }}
          viewModeEnabled
          theme={dark ? 'dark' : 'light'}
          validateEmbeddable={link => Boolean(resolveLink(link))}
          renderEmbeddable={element => {
            const target = resolveLink(element.type === 'embeddable' ? element.link : null);
            const width = Math.max(1, element.width - 2);
            const height = Math.max(1, element.height - EMBED_HEADER_HEIGHT - 2);
            if (!target) {
              return (
                <div className="flex h-full w-full items-center rounded-xl border border-border bg-background px-4 text-xs text-muted-foreground">
                  Not found
                </div>
              );
            }
            return (
              <div data-canvas-embed-id={element.id} className="h-full w-full">
                <DownloadedEmbedFrame target={target} label={artifactDisplayLabel(target.path)} onOpen={selectArtifact}>
                  <div inert className="min-h-0" style={{ height, flex: '1 1 auto', pointerEvents: 'none' }}>
                    {renderEmbed(target, width, height)}
                  </div>
                </DownloadedEmbedFrame>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
`
    : '';

  return `${imports.join('\n')}

const artifacts: DownloadedArtifact[] = [${itemsCode.join(', ')}];
const scheme = matchMedia('(prefers-color-scheme: dark)');
document.documentElement.classList.toggle('dark', scheme.matches);
scheme.addEventListener('change', event => {
  document.documentElement.classList.toggle('dark', event.matches);
});
${canvasComponent}
createRoot(document.getElementById('root')!).render(
  <DownloadedPrototype
    title=${JSON.stringify(title)}
    studioId=${JSON.stringify(studioId)}
    systemLabel=${JSON.stringify(systemLabel)}
    themeClass=${JSON.stringify(theme)}
    artifacts={artifacts}
    ${docRenderer}
    ${diagramRenderer}
    ${canvasRenderer}
  />
);
`;
}

function pageHtml(title) {
  const safe = title.replace(
    /[&<>"]/g,
    character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character],
  );
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>${safe}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./entry.tsx"></script>
  </body>
</html>
`;
}

function runVite(htmlPath, outDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [VITE, 'build'], {
      cwd: ROOT,
      env: { ...process.env, STUDIO_SHARE_HTML: htmlPath, STUDIO_SHARE_OUT: outDir },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const take = chunk => {
      output = (output + chunk.toString()).slice(-12_000);
    };
    child.stdout.on('data', take);
    child.stderr.on('data', take);
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve();
      else {
        const message = output
          .split('\n')
          .filter(line => line.trim() && !line.trimStart().startsWith('at '))
          .slice(-6)
          .join('\n');
        console.error(message || `The build stopped (${code}).`);
        reject(new Error("Couldn't download this prototype."));
      }
    });
  });
}

// One HTML document: Vite's JS and CSS, with fonts already inlined into the CSS.
function standaloneHtml(outDir) {
  const htmlPath = findFile(outDir, name => name.endsWith('.html'));
  const stylesheet = findFile(outDir, name => name.endsWith('.css'));
  const script = findFile(outDir, name => name.endsWith('.js'));
  if (!htmlPath || !stylesheet || !script) {
    console.error("The build didn't produce a page.");
    throw new Error("Couldn't download this prototype.");
  }
  let html = fs.readFileSync(htmlPath, 'utf8');
  const css = fs.readFileSync(stylesheet, 'utf8').replace(/<\/style/gi, '<\\/style');
  const js = fs.readFileSync(script, 'utf8').replace(/<\/script/gi, '<\\/script');
  const link = html.match(/<link rel="stylesheet"[^>]*>/);
  // Vite emits a module script, or a plain one when the share build is a classic script (so file:// can run it).
  const scriptTag = html.match(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/);
  if (!link || !scriptTag) {
    console.error("The build didn't fold into one file.");
    throw new Error("Couldn't download this prototype.");
  }
  html = html.replace(link[0], () => `<style>${css}</style>`);
  // An inline script in the head runs before the page exists. defer applies only to scripts with a src.
  html = html.replace(scriptTag[0], '');
  html = html.replace('</body>', () => `<script>${js}</script></body>`);
  return html;
}

let current = null;

function findFile(dir, test) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findFile(full, test);
      if (found) return found;
    } else if (test(entry.name, full)) return full;
  }
  return null;
}

export async function downloadPrototype(dir) {
  dir = path.resolve(dir);
  const rawMeta = fs.readFileSync(path.join(dir, 'meta.json'), 'utf8');
  const meta = JSON.parse(rawMeta);
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : 'Prototype';
  let studioId;
  try {
    studioId = jsonIdentity(rawMeta) ?? undefined;
  } catch {
    studioId = undefined;
  }
  const order = meta.order !== undefined ? (parseOrder(meta.order) ?? undefined) : undefined;
  const artifacts = prototypeArtifacts(dir, order);
  if (!artifacts.length) throw new Error('This prototype has no screen to download.');
  if (current) throw new Error('A download is already in progress.');
  const { theme, label: systemLabel } = resolveSystem(meta);
  // Inside the Vite root (`src`) so the built page name stays a normal path. One download at a time.
  const shareRoot = path.join(ROOT, 'src', 'studio-share');
  fs.mkdirSync(shareRoot, { recursive: true });
  const work = fs.mkdtempSync(path.join(shareRoot, 'share-'));
  const htmlPath = path.join(work, 'index.html');
  const outDir = path.join(work, 'out');
  fs.writeFileSync(htmlPath, pageHtml(title));
  fs.writeFileSync(path.join(work, 'entry.tsx'), entrySource({ title, studioId, systemLabel, theme, artifacts }));
  current = (async () => {
    try {
      await runVite(htmlPath, outDir);
      return { name: shareFileName(title), html: standaloneHtml(outDir) };
    } finally {
      current = null;
      fs.rmSync(work, { recursive: true, force: true });
    }
  })();
  return current;
}
