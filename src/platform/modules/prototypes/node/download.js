// Download: one prototype as a single HTML file that opens from disk, for someone who can't run Studio.
// It is the production build (pnpm build) with one prototype in it, packed into one page: the same viewer,
// views, documents, diagrams and canvases as the published site, with no second renderer to keep in step.
// The idea and its first version came from @robcrock (#81).
//
// The build runs in its own process, because the manifest and file globs read which prototype to keep from
// STUDIO_DOWNLOAD (src/platform/core/archive.ts forDeploy). The page carries the manifest itself
// (src/platform/app/data/manifest.ts), and the app switches to hash URLs when it finds it, so links work
// from a file. Anything the prototype fetches at run time, such as files in public/, isn't in it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const validId = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._-]*$/i.test(value);

// Builds the prototype and returns the page. Takes about as long as pnpm build.
export async function downloadPrototype({ key, id }) {
  if (!validId(key) || !validId(id)) throw new Error('Invalid prototype address.');
  if (!fs.existsSync(path.join(ROOT, 'src/prototypes', key, id))) throw new Error('No such prototype.');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-download-'));
  try {
    await run(out, `${key}/${id}`);
    return fs.readFileSync(path.join(out, 'download.html'), 'utf8');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
}

function run(out, only) {
  return new Promise((resolve, reject) => {
    // Started with -e, not as a script: Vite bundles its config, plugins and this file into one, so a check for
    // "run as a script" would also be true inside that build and start it again.
    const script = `import(${JSON.stringify(import.meta.url)}).then(m => m.buildDownload(${JSON.stringify(out)}))`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      cwd: ROOT,
      env: { ...process.env, STUDIO_DOWNLOAD: only, NODE_ENV: 'production' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errors = '';
    child.stderr.on('data', chunk => (errors += chunk));
    child.on('error', reject);
    child.on('close', code =>
      code === 0 ? resolve() : reject(new Error(errors.trim().split('\n').slice(-5).join('\n') || 'Build failed.')),
    );
  });
}

// In the child: build into `out` as one script and one stylesheet, then fold both and the manifest into the page.
export async function buildDownload(out) {
  const { build: viteBuild } = await import('vite');
  const { buildManifest } = await import('../../../node/build/build-manifest.js');
  const { manifest, errors } = buildManifest({ deploy: true, write: false, quiet: true });
  if (errors) throw new Error('The prototype has problems; run pnpm build to see them.');
  await viteBuild({
    configFile: path.join(ROOT, 'vite.config.ts'),
    base: '/',
    publicDir: false,
    logLevel: 'error',
    build: {
      outDir: out,
      emptyOutDir: true,
      manifest: false,
      cssCodeSplit: false,
      assetsInlineLimit: () => true,
      rolldownOptions: { output: { codeSplitting: false } },
    },
  });
  const assets = path.join(out, 'assets');
  const read = file => fs.readFileSync(path.join(assets, path.basename(file)), 'utf8');
  // Keep the text safe inside <script> and <style>, and drop links to files that aren't in the page.
  const safe = text => text.replace(/<\/(script|style)/gi, '<\\/$1');
  let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
  html = html.replace(/\s*<link rel="(?:icon|apple-touch-icon|modulepreload)"[^>]*>/g, '');
  html = html.replace(
    /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
    (_, href) => `<style>${safe(read(href))}</style>`,
  );
  html = html.replace(
    /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
    (_, src) => `<script type="module">${safe(read(src))}</script>`,
  );
  const title = manifest.prototypes[0]?.title;
  if (title) html = html.replace(/<title>[^<]*<\/title>/, `<title>${title.replace(/[<&]/g, '')}</title>`);
  const data = `<script type="application/json" id="studio-manifest">${safe(JSON.stringify(manifest))}</script>`;
  html = html.replace('<div id="root"></div>', `${data}\n    <div id="root"></div>`);
  fs.writeFileSync(path.join(out, 'download.html'), html);
}
