// The files a hook or CI run should check, shared by check-scope.js and check-asset-size.js.
//   --staged                 files staged for the next commit
//   --push                   files in commits not yet on the remote
//   --ci <before> <after>    files in a pushed range (only the latest commit on a branch's first push)
// filter: a git --diff-filter, like 'AM' for added or modified files only.
// Returns { files, baseRef }: baseRef is the "before" side, or null if there isn't one.
import { execFileSync } from 'node:child_process';

const run = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
export const git = (...args) => run(args).trim();
// The paths a git command lists. -z keeps them as written: without it git quotes names with accents, symbols or newlines.
export const gitPaths = (command, ...args) =>
  run([command, '-z', ...args])
    .split('\0')
    .filter(Boolean);
const ZERO = /^0+$/;

export function changedFiles(mode, before, after, { filter } = {}) {
  const f = filter ? [`--diff-filter=${filter}`] : [];
  if (mode === '--staged') return { files: gitPaths('diff', '--cached', '--name-only', ...f), baseRef: 'HEAD' };
  if (mode === '--push') {
    let upstream = null;
    try {
      upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
    } catch {
      /* no upstream yet */
    }
    // No upstream yet: everything not on any remote.
    const files = upstream
      ? gitPaths('diff', '--name-only', ...f, `${upstream}..HEAD`)
      : gitPaths('log', '--name-only', '--pretty=format:', ...f, 'HEAD', '--not', '--remotes');
    return { files: [...new Set(files)], baseRef: upstream };
  }
  if (mode === '--ci') {
    if (!after) throw new Error('--ci needs <before> <after>');
    if (!before || ZERO.test(before)) {
      // First push of a branch: check only the latest commit.
      let baseline = 'empty-tree';
      try {
        baseline = git('rev-parse', '--verify', `${after}^`);
      } catch {
        /* Initial repository commit has no before-side authority. */
      }
      return {
        files: gitPaths('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', ...f, after),
        baseRef: baseline,
      };
    }
    return { files: gitPaths('diff', '--name-only', ...f, `${before}..${after}`), baseRef: before };
  }
  return null;
}
