// Checks that links in Markdown guidance resolve: files, heading anchors, and Studio browser pages
// (src/platform/node/lib/markdown-links.js).
// Usage: node src/platform/node/check/check-links.js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { markdownFiles, markdownLinkProblems } from '../lib/markdown-links.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const files = markdownFiles(root);
const problems = markdownLinkProblems(root, files);
if (problems.length) {
  console.error(`[links] ${problems.length} broken Markdown links:\n${problems.join('\n')}`);
  process.exitCode = 1;
} else console.log(`[links] All links resolve in ${files.length} Markdown files.`);
