// Usage:
//   node src/platform/node/check/check-asset-size.js --staged              (pre-commit, blocks the commit)
//   node src/platform/node/check/check-asset-size.js --ci <before> <after> (CI, fails the check)
//
// Blocks files over the limit from entering the repo. Git keeps every version of every
// file forever, so one big image makes every future clone slower. Only added or modified
// files are checked, so a large file already in the repo is flagged only if you change it.
// The limit is studio.config.json's assetLimitKB, read from the same commit (or staged copy) as the files.
// Files tracked by Git LFS pass: Git stores a small pointer for them, and that is what this measures.
// The message points to one guide for the team's options (a higher limit, Git LFS, or media hosting).
import { changedFiles, git } from './changed-files.js';
import { ASSET_LIMIT_KB, CONFIG_FILE, assetLimitProblems } from '../../core/config.ts';
import { parseConfigFile } from '../../core/config-file.ts';

const GUIDE = 'src/platform/context/assets.md#large-files';

const [mode, before, after] = process.argv.slice(2);
let changed;
try {
  changed = changedFiles(mode, before, after, { filter: 'AM' });
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
if (!changed || mode === '--push') {
  console.error('Usage: check-asset-size.js --staged | --ci <before> <after>');
  process.exit(2);
}

// The limit from the version of studio.config.json being checked. A repository with no studio.config.json (not a
// studio) gets the default.
const at = file => (mode === '--staged' ? `:${file}` : `${after}:${file}`);
let limitKB;
try {
  const text = git('show', at(CONFIG_FILE));
  const parsed = parseConfigFile(text);
  if ('error' in parsed) throw new Error(parsed.error);
  const problems = assetLimitProblems(parsed.value.assetLimitKB);
  if (problems.length) throw new Error(problems.join('\n'));
  limitKB = parsed.value.assetLimitKB;
} catch (e) {
  if (e.status === undefined) {
    console.error(`Asset size check: ${e.message}`);
    process.exit(2);
  }
  limitKB = ASSET_LIMIT_KB; // git show failed: this tree has no studio.config.json.
}

// The size Git will store: the staged version, or the version in the pushed commit.
const sizeKB = file => Number(git('cat-file', '-s', at(file))) / 1024;

const oversized = changed.files.map(f => ({ file: f, kb: sizeKB(f) })).filter(({ kb }) => kb > limitKB);

if (oversized.length) {
  console.error(`Asset size check: ${oversized.length} file(s) over ${limitKB} KB.`);
  for (const { file, kb } of oversized) console.error(`  ${file}: ${Math.round(kb)} KB`);
  console.error('Make it smaller: export images as WebP (or compressed JPEG) at the size they are shown.');
  console.error('A full-screen image is usually 100-300 KB as WebP.');
  console.error(`If it needs to stay this size, see how to support large files: ${GUIDE}`);
  process.exit(1);
}
