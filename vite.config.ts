import artifactRevisions from './src/platform/node/build/vite-artifact-revisions-plugin.js';
import moduleEntries from './src/platform/node/build/vite-module-entries-plugin.js';
import resourceDirectoryPlugin from './src/platform/node/build/vite-resource-directory-plugin.js';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import remarkFrontmatter from 'remark-frontmatter';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkHtmlAsText from './src/platform/node/build/remark-html-as-text.js';
import remarkTitleFromHeading from './src/platform/node/build/remark-title-from-heading.js';
import rehypeSlug from 'rehype-slug';
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeMermaid from './src/platform/node/build/rehype-mermaid.js';
import rehypeFileEmbeds from './src/platform/node/build/rehype-file-embeds.js';
import { documentCodeTheme } from './src/platform/systems/studio/styles/contentPalette.js';
import tailwindcss from '@tailwindcss/vite';
import importGuard from './src/platform/node/build/vite-import-guard-plugin.js';
import publicApi from './src/platform/node/build/vite-public-api-plugin.js';
import manifestWatch from './src/platform/node/build/vite-manifest-watch-plugin.js';
import spa404 from './src/platform/node/build/vite-spa-404-plugin.js';
import socialMetadata from './src/platform/node/build/vite-social-metadata-plugin.js';
import deploymentRecovery from './src/platform/node/build/vite-deployment-recovery-plugin.js';
import previewTheme from './src/platform/node/build/vite-preview-theme-plugin.js';
import files from './src/platform/node/build/vite-files-plugin.js';
import settings from './src/platform/node/build/vite-settings-plugin.js';
import markdownRefresh from './src/platform/node/build/vite-markdown-refresh-plugin.js';
import buildAssets from './src/platform/node/build/vite-build-assets-plugin.js';
import globs from './src/platform/node/build/vite-globs-plugin.js';
import css, { scopedUtilities } from './src/platform/node/build/vite-css-plugin.js';
import { optimizedDependencies } from './src/platform/core/modules/index.ts';
import { SYSTEM_GLOB_ROOTS } from './src/platform/core/roots.ts';
import { ENABLED_MODULES, LIBRARY_MODULES, MODULE_DIRS } from './src/platform/node/lib/modules.js';

// References use the same plain-Markdown pipeline, without hiding any document sections.
function markdown(reference = false) {
  const plugin = mdx({
    format: 'md',
    providerImportSource: '@mdx-js/react',
    remarkPlugins: [remarkFrontmatter, remarkTitleFromHeading, remarkMdxFrontmatter, remarkGfm, remarkHtmlAsText],
    rehypePlugins: [
      rehypeSlug,
      rehypeMermaid,
      rehypeFileEmbeds,
      [
        rehypePrettyCode,
        { theme: { light: documentCodeTheme('light'), dark: documentCodeTheme('dark') }, keepBackground: false },
      ],
    ],
  });
  const transform = plugin.transform;
  return {
    ...plugin,
    name: reference ? 'studio-reference-markdown' : 'studio-markdown',
    enforce: 'pre' as const,
    transform(code: string, id: string) {
      if (id.includes('?reference') !== reference) return null;
      return transform.call(this, code, id);
    },
  };
}

// A module with `lib: true` gives prototypes one door in: `import ... from '@module/<id>'` is its lib/index, or
// its lib/off while the module is off.
const moduleLibs = LIBRARY_MODULES.map((m: { id: string; off?: boolean }) => ({
  find: `@module/${m.id}`,
  replacement: fileURLToPath(new URL(`./${MODULE_DIRS[m.id]}lib/${m.off ? 'off' : 'index'}`, import.meta.url)),
}));

export default defineConfig({
  root: 'src',
  // Pages supplies a path without a trailing slash; data URLs append relative paths.
  base: `${(process.env.STUDIO_BASE_PATH || '/').replace(/\/+$/, '')}/`,
  publicDir: '../public',
  // A Codespace serves the dev server from its forwarded host (.devcontainer/devcontainer.json).
  server: process.env.CODESPACES
    ? { allowedHosts: [`.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev'}`] }
    : undefined,
  css: { postcss: { plugins: [scopedUtilities()] } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    manifest: true,
    rolldownOptions: {
      output: {
        // Keep heavy feature libraries lazy while consolidating shared shell code.
        codeSplitting: {
          groups: [
            {
              name: 'studio-ui',
              test: /[\\/]node_modules[\\/](?:@base-ui[\\/]react|@tanstack[\\/](?:react-router|router-core|history)|react(?:-dom)?|use-sync-external-store|scheduler|cmdk)[\\/]/,
            },
          ],
        },
      },
    },
  },
  // The Source view's editor (SourcePane.tsx) loads its languages on demand, so Vite would find these packages
  // only when you first open it, re-bundle them, and end up with two copies of @codemirror/state: the editor
  // then fails with "Unrecognized extension value". Listing them bundles them together at start.
  optimizeDeps: {
    // Systems' libraries are where prototype views get their packages (Lucide, Base UI, ...). Scanning them
    // at start bundles those packages up front instead of reloading the page once a view first needs them.
    entries: ['index.html', ...SYSTEM_GLOB_ROOTS.map(root => `.${root}/*/libraries/**/*.{ts,tsx}`)],
    include: [
      // Prepare the renderer's lazy entry without pulling every diagram type into the shell.
      'pele/lazy',
      // A module that is off still loads its packages through lib/off when code imports it.
      ...optimizedDependencies([...ENABLED_MODULES, ...LIBRARY_MODULES]),
      // Embedded prototype views discover these deep imports after the canvas first paints.
      '@base-ui/react/**',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/autocomplete',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/lang-javascript',
      '@codemirror/lang-markdown',
      '@codemirror/lang-yaml',
      '@codemirror/lang-css',
      'codemirror-lang-mermaid',
      '@lezer/common',
      '@lezer/highlight',
      '@lezer/markdown',
    ],
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
  },
  plugins: [
    ...artifactRevisions(),
    // Markdown pages (Manual pages in src/platform/modules/documentation/pages/, and prototype documents), as plain
    // Markdown (no JSX or expressions, so any .md file compiles; raw HTML shows as text): frontmatter (a first heading is the title when there's no `title`), GitHub-style Markdown, heading ids, and code highlighting with Shiki in both color modes.
    markdown(),
    markdown(true),
    // Markdown readers refresh through src/platform/node/build/vite-markdown-refresh-plugin.js instead.
    react({ include: /\.[jt]sx$/ }),
    markdownRefresh(),
    importGuard(),
    publicApi(),
    // Resolve public libraries after the guard sees the original @module import.
    // Vite aliases run earlier and would hide that explicit public entrypoint.
    {
      name: 'studio-module-library',
      resolveId(source) {
        const library = moduleLibs.find(entry => entry.find === source);
        return library
          ? (['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']
              .map(extension => library.replacement + extension)
              .find(existsSync) ?? null)
          : null;
      },
    },
    css(),
    tailwindcss(),
    globs(),
    moduleEntries(),
    resourceDirectoryPlugin(),
    manifestWatch(),
    settings(),
    files(),
    buildAssets(),
    spa404(),
    socialMetadata(),
    deploymentRecovery(),
    previewTheme(),
  ],
});
