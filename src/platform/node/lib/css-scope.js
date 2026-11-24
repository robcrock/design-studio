// Validate selectors structurally, including CSS brought in through @import.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

function scoped(selector, themeClass, mode) {
  let valid = true;
  selectorParser(tree => {
    tree.each(part => {
      let global = false;
      part.walkPseudos(p => {
        if (p.value === ':global') global = true;
      });
      if (global) {
        valid = false;
        return;
      }
      part.walkPseudos(p => {
        if (p.value === ':local' && p.nodes?.length === 1) p.replaceWith(...p.nodes[0].nodes.map(n => n.clone()));
      });
      const nodes = part.nodes;
      const index = nodes.findLastIndex(n => n.type === 'class' && (mode === 'module' || n.value === themeClass));
      // Sibling combinators stay inside the scope once a descendant or child step has entered it:
      // `.theme .a + .b` is contained, while `.theme + .b` escapes.
      let inside = false;
      for (const n of nodes.slice(index + 1)) {
        if (n.type !== 'combinator') continue;
        if ([' ', '>'].includes(n.value.trim() || ' ')) inside = true;
        else if (!inside) valid = false;
      }
      if (index < 0) valid = false;
    });
  }).processSync(selector);
  return valid;
}

function expand(selector, parents) {
  if (!parents) return [selector];
  const result = [];
  selectorParser(tree => {
    tree.each(part => {
      for (const parent of parents) {
        const copy = part.clone();
        let nested = false;
        copy.walkNesting(n => {
          nested = true;
          const parentTree = selectorParser().astSync(parent);
          n.replaceWith(...parentTree.nodes[0].nodes.map(n => n.clone()));
        });
        result.push(nested ? copy.toString() : `${parent} ${copy}`);
      }
    });
  }).processSync(selector);
  return result;
}

export function cssProblems(code, { file, themeClass, mode = 'theme', seen = new Set(), packagePolicy }) {
  if (seen.has(file)) return [];
  seen.add(file);
  const problems = [];
  const fail = message => problems.push(`${file}: ${message}`);
  try {
    const tree = postcss.parse(code, { from: file });
    function walk(container, parents = null, keyframes = false) {
      for (const node of container.nodes ?? []) {
        if (node.type === 'rule') {
          if (keyframes) continue;
          const selectors = expand(node.selector, parents);
          if (!selectors.every(s => scoped(s, themeClass, mode)))
            fail(
              `"${node.selector}" escapes ${mode === 'module' ? 'its local CSS Module class' : `.${themeClass}`}. Scope the target and avoid global or sibling selectors.`,
            );
          if (
            mode === 'theme' &&
            selectors.some(selector => {
              let globalMode = false;
              selectorParser(tree =>
                tree.walkClasses(node => {
                  if (node.value === 'dark' || node.value === 'light') globalMode = true;
                }),
              ).processSync(selector);
              return globalMode;
            })
          )
            fail(
              `"${node.selector}" uses a global color-mode class. Use .${themeClass}[data-color-mode="dark"] or [data-color-mode="light"] on the system boundary.`,
            );
          walk(node, selectors);
        } else if (node.type === 'atrule') {
          const name = node.name.toLowerCase();
          if (name === 'import') {
            if (mode === 'module') {
              fail('CSS Module @import is not supported; import another CSS Module from code.');
              continue;
            }
            const match = node.params.match(/^(?:["']([^"']+)["']|url\(\s*["']?([^"')\s]+)["']?\s*\))(?:\s+.*)?$/);
            const source = match?.[1] ?? match?.[2];
            if (!source || /^(?:https?:|\/\/|data:)/i.test(source)) {
              fail('Theme @import must resolve to a local stylesheet that can be checked.');
              continue;
            }
            const packageProblem = packagePolicy?.(source, file);
            if (packageProblem) {
              fail(packageProblem);
              continue;
            }
            const target = source.startsWith('.')
              ? path.resolve(path.dirname(file), source)
              : createRequire(file).resolve(source);
            problems.push(
              ...cssProblems(fs.readFileSync(target, 'utf8'), { file: target, themeClass, mode, seen, packagePolicy }),
            );
          } else if (name === 'font-face') {
            // Font registration does not select or restyle elements. It is intentionally shared.
            if (node.nodes?.some(n => n.type !== 'decl' && n.type !== 'comment')) fail('Invalid @font-face block.');
          } else if (/^(?:-webkit-)?keyframes$/.test(name)) {
            if (mode === 'theme' && !node.params.startsWith(`${themeClass}-`))
              fail(`Keyframe names must start with ${themeClass}- to avoid collisions.`);
            walk(node, parents, true);
          } else if (['media', 'supports', 'container', 'layer', 'starting-style'].includes(name)) {
            walk(node, parents, keyframes);
          } else if (['apply'].includes(name) && parents) {
            // Tailwind applies declarations to the already validated selector.
          } else {
            fail(`@${name} is not supported in scoped styles.`);
          }
        }
      }
    }
    walk(tree);
  } catch (error) {
    fail(`Cannot validate stylesheet: ${error.message}`);
  }
  return problems;
}
