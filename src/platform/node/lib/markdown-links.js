// Finds broken links in Markdown guidance: a relative link whose file is missing, a link to a heading
// that isn't there, and a Studio browser link (/documentation/...) that names no page.
// Anchors follow rehype-slug (github-slugger), which gives rendered headings their ids.
import fs from 'node:fs';
import path from 'node:path';
import { markdownPath } from '../../app/docs/referenceLinks.ts';

// Guidance, not content: prototypes and contributor files are the team's own work.
// Templates link from where they are copied to, so they resolve only after scaffolding.
const IGNORED = [
  'node_modules/**',
  'dist/**',
  'src/prototypes/**',
  'contributors/**',
  'src/platform/node/templates/**',
  'CHANGELOG.md',
];

export function markdownFiles(root) {
  return fs.globSync('**/*.md', { cwd: root, exclude: IGNORED }).sort();
}

const fences = text => text.replace(/^([ \t]*)(```|~~~)[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, '');
const prose = text => fences(text.replace(/^---\n[\s\S]*?\n---\n/, '')).replace(/`[^`\n]*`/g, '');

const plain = heading =>
  heading
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*~`]/g, '');

export function slugify(text) {
  return plain(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, '')
    .replace(/ /g, '-');
}

export function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();
  for (const [, heading] of fences(text.replace(/^---\n[\s\S]*?\n---\n/, '')).matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = slugify(heading);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count ? `${base}-${count}` : base);
  }
  for (const [, id] of text.matchAll(/<a\s+(?:name|id)=["']([^"']+)["']/g)) anchors.add(id);
  return anchors;
}

export function linksOf(text) {
  return [...prose(text).matchAll(/\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)].map(match => match[1]);
}

// Each Markdown file's browser address, from the same translation the browser applies to source links.
function browserPages(files) {
  const pages = new Map();
  for (const file of files) {
    if (!file.startsWith('src/')) continue;
    const route = markdownPath(file.slice('src'.length));
    // The modules README is also addressed as its context page; the page itself owns the address.
    if (route.startsWith('/documentation/') && !(file.endsWith('README.md') && pages.has(route)))
      pages.set(route.replace(/\.md$/, ''), file);
  }
  return pages;
}

export function markdownLinkProblems(root, files = markdownFiles(root)) {
  const texts = new Map(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
  const anchors = new Map();
  const anchorsFor = file => {
    if (!anchors.has(file)) {
      const text = texts.get(file) ?? fs.readFileSync(path.join(root, file), 'utf8');
      anchors.set(file, anchorsOf(text));
    }
    return anchors.get(file);
  };
  const pages = browserPages(files);
  const problems = [];
  for (const [file, text] of texts) {
    for (const link of linksOf(text)) {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(link)) continue;
      const hashAt = link.indexOf('#');
      const target = decodeURIComponent(hashAt < 0 ? link : link.slice(0, hashAt)).split('?')[0];
      const anchor = hashAt < 0 ? '' : decodeURIComponent(link.slice(hashAt + 1));
      let resolved;
      if (!target) resolved = file;
      else if (target.startsWith('/documentation/')) {
        resolved = pages.get(target.replace(/\/$/, ''));
        if (!resolved) {
          problems.push(`${file}: ${link} names no Studio page`);
          continue;
        }
      } else if (target.startsWith('/')) continue;
      else {
        resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
        const absolute = path.join(root, resolved);
        if (!fs.existsSync(absolute)) {
          problems.push(`${file}: ${link} points to a missing file`);
          continue;
        }
        if (fs.statSync(absolute).isDirectory()) continue;
      }
      if (anchor && resolved.endsWith('.md') && !anchorsFor(resolved).has(anchor))
        problems.push(`${file}: ${link} names no heading in ${resolved}`);
    }
  }
  return problems;
}
