// Builds one prototype into a single HTML file a client can open without this studio running.
// The dev server calls it from the prototype menu (vite-files-plugin.js). A separate Vite build
// renders that prototype's views with its design system, then the JS, CSS, and fonts are inlined
// so the file stands alone.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOTYPE_SYSTEMS } from '../../modules/systems/node/systems.js';

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
// Helpers live in a file or folder whose name starts with _.
function isView(file) {
  if (!/\.(tsx|jsx)$/.test(file)) return false;
  const source = fs.readFileSync(file, 'utf8');
  return /export\s+default\b|export\s*\{[^}]*\bas\s+default\b/.test(source);
}

function viewFiles(dir) {
  const found = [];
  const walk = folder => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isView(full)) found.push(full);
    }
  };
  walk(dir);
  return found.sort();
}

function themeClass(meta) {
  if (meta.systemId == null) return 'prototype-unstyled';
  const system = Object.values(PROTOTYPE_SYSTEMS).find(spec => spec.studioId === meta.systemId);
  return system?.themeClass && /^[a-z0-9-]+$/.test(system.themeClass) ? system.themeClass : 'prototype-unstyled';
}

function screenName(file, title, only) {
  if (only || path.basename(file, path.extname(file)) === 'prototype') return title;
  return path
    .basename(file, path.extname(file))
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function entrySource({ title, theme, views }) {
  const only = views.length === 1;
  const imports = views.map((file, index) => `import View${index} from ${JSON.stringify(file)};`).join('\n');
  const screens = views
    .map((file, index) => `{ name: ${JSON.stringify(screenName(file, title, only))}, View: View${index} }`)
    .join(', ');
  return `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ${JSON.stringify(STYLES)};
${imports}

const screens = [${screens}];
const dark = matchMedia('(prefers-color-scheme: dark)').matches;
if (dark) document.documentElement.classList.add('dark');

function Share() {
  const [current, setCurrent] = useState(0);
  const Selected = screens[current].View;
  return (
    <div className="${theme} min-h-dvh bg-background text-foreground" data-color-mode={dark ? 'dark' : 'light'}>
      {screens.length > 1 ? (
        <div className="sticky top-0 z-10 flex flex-wrap gap-2 border-b border-border bg-background px-4 py-2">
          {screens.map((screen, index) => (
            <button
              key={screen.name}
              type="button"
              className={"rounded-md px-2.5 py-1 text-sm " + (index === current ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
              onClick={() => setCurrent(index)}
            >
              {screen.name}
            </button>
          ))}
        </div>
      ) : null}
      <Selected />
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Share />);
`;
}

function pageHtml(title) {
  const safe = title.replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
  // The studio stylesheet clips the document because the shell scrolls inside the app. This file is the page.
  html = html.replace(
    '</head>',
    () => `<style>
      html, body { height: auto; min-height: 100%; overflow: auto; }
      #root { position: static; inset: auto; height: auto; min-height: 100%; overflow: visible; }
    </style></head>`,
  );
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
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const title = typeof meta.title === 'string' && meta.title.trim() ? meta.title.trim() : 'Prototype';
  const views = viewFiles(dir);
  if (!views.length) throw new Error('This prototype has no screen to download.');
  if (current) throw new Error('A download is already in progress.');
  // Inside the Vite root (`src`) so the built page name stays a normal path. One download at a time.
  const shareRoot = path.join(ROOT, 'src', 'studio-share');
  fs.mkdirSync(shareRoot, { recursive: true });
  const work = fs.mkdtempSync(path.join(shareRoot, 'share-'));
  const htmlPath = path.join(work, 'index.html');
  const outDir = path.join(work, 'out');
  fs.writeFileSync(htmlPath, pageHtml(title));
  fs.writeFileSync(path.join(work, 'entry.tsx'), entrySource({ title, theme: themeClass(meta), views }));
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
