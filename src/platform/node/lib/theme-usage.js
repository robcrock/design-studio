// Check literal utility use against a system's declared inventory. Dynamic class construction
// remains subject to the same CSS boundary even when static inspection cannot resolve it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { compile } from 'tailwindcss';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { utilityTokens, inventoryLiterals } from './tailwind-theme.js';
const require = createRequire(import.meta.url);
const defaults = fs.readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
const defaultTokens = new Map();
postcss.parse(defaults).walkDecls(d => {
  if (d.prop.startsWith('--')) defaultTokens.set(d.prop, { ref: d.prop, value: d.value });
});
export function literalCandidates(code, file) {
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const candidates = new Set();
  const collect = node => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      for (const word of node.text.split(/\s+/)) if (word) candidates.add(word);
    ts.forEachChild(node, collect);
  };
  const visit = node => {
    if (
      (ts.isJsxAttribute(node) && node.name.getText(ast) === 'className') ||
      (ts.isPropertyAssignment(node) && node.name.getText(ast) === 'className') ||
      (ts.isCallExpression(node) && /^(?:cn|cva|clsx|classNames|twMerge)$/.test(node.expression.getText(ast)))
    ) {
      collect(node);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...candidates];
}
export async function themeUsageProblems(systems, filesBySystem) {
  const tokens = new Map(defaultTokens);
  for (const s of systems) for (const [n, e] of utilityTokens(s.inventory.base)) tokens.set(n, e);
  const inline = [...tokens]
    .filter(([n]) => !/^--(?:breakpoint|container)-/.test(n))
    .map(([n, e]) => `  ${n}: var(${e.ref});`)
    .join('\n');
  // The default catalog is used only to recognize unsupported named utility requests.
  // It never reaches application CSS or any system's theme pages.
  const compiler = await compile(defaults + `\n@theme inline {\n${inline}\n}\n@tailwind utilities;`);
  const dependencies = new Map();
  const requests = systems
    .filter(s => s.styling === 'tailwind')
    .flatMap(system =>
      filesBySystem(system).map(file => ({
        system,
        file,
        candidates: literalCandidates(fs.readFileSync(file, 'utf8'), file),
      })),
    );
  const candidates = [...new Set(requests.flatMap(r => r.candidates))];
  const known = new Set(['--radius-full', ...[...tokens.values()].map(e => e.ref)]);
  const css = postcss.parse(compiler.build(candidates));
  css.walkRules(rule => {
    inventoryLiterals(rule);
    const refs = new Set();
    rule.walkDecls(d => {
      for (const m of d.value.matchAll(/var\(\s*(--[\w-]+)/g))
        if (known.has(m[1]) && !m[1].startsWith('--tw-')) refs.add(m[1]);
    });
    selectorParser(tree =>
      tree.walkClasses(c => {
        // Group/peer markers occur in another utility's selector. They do not
        // request that utility's tokens where the marker itself is used.
        if (!candidates.includes(c.value) || /^(?:group|peer)(?:\/|$)/.test(c.value)) return;
        const existing = dependencies.get(c.value) ?? new Set();
        for (const ref of refs) existing.add(ref);
        dependencies.set(c.value, existing);
      }),
    ).processSync(rule.selector);
  });
  const problems = [];
  const gaps = new Map();
  for (const { system, file, candidates } of requests)
    for (const candidate of candidates) {
      const refs = new Set(dependencies.get(candidate));
      for (const part of candidate.split(':').slice(0, -1))
        if (tokens.has('--breakpoint-' + part)) refs.add('--breakpoint-' + part);
      const missing = [...refs].filter(n => !system.inventory.base.has(n));
      for (const n of missing) gaps.set(system, (gaps.get(system) ?? new Set()).add(n));
      if (missing.length)
        problems.push(
          path.relative(process.cwd(), file) +
            ': ' +
            candidate +
            ' requires ' +
            missing.join(', ') +
            ', outside ' +
            system.themeClass +
            "'s declared inventory.",
        );
    }
  // One list per system, so a port decides its whole token gap at once instead of check by check.
  for (const [system, missing] of gaps)
    problems.push(
      `${system.themeClass} is missing ${missing.size} token(s) in all: ` +
        [...missing]
          .sort()
          .map(n => (defaultTokens.has(n) ? `${n} (Tailwind default ${defaultTokens.get(n).value})` : n))
          .join(', ') +
        '.',
    );
  return problems;
}
