import fs from 'node:fs';
import path from 'node:path';

// Copies dist/index.html to dist/404.html after a build. Static hosts that serve
// 404.html for unknown paths (GitHub Pages and others) then still load the app,
// so deep links like /prototypes/samples/hello-world work without a rewrite rule.
export default function spa404() {
  let outDir;
  let failed = false;
  return {
    name: 'spa-404',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir);
    },
    buildEnd(error) {
      failed = Boolean(error);
    },
    closeBundle() {
      if (failed || process.env.STUDIO_SHARE_HTML) return;
      fs.copyFileSync(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}
