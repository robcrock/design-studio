// One parser/resolver for dependency checks and safe module removal.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { moduleDirOf } from './module-folders.js';

export const inside = (file, dir) => file === dir || file.startsWith(dir + path.sep);
export const realFile = file => {
  try {
    return fs.realpathSync(file);
  } catch {
    return path.resolve(file);
  }
};

export function importsOf(code, file = 'source.tsx') {
  const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
  const imports = [];
  const add = (node, typeOnly = false) =>
    imports.push({ source: ts.isStringLiteralLike(node) ? node.text : null, typeOnly });
  const visit = node => {
    if (ts.isImportDeclaration(node)) {
      const c = node.importClause;
      const named = c?.namedBindings;
      add(
        node.moduleSpecifier,
        Boolean(
          c?.isTypeOnly ||
            (c &&
              !c.name &&
              named &&
              ts.isNamedImports(named) &&
              named.elements.length &&
              named.elements.every(e => e.isTypeOnly)),
        ),
      );
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      add(
        node.moduleSpecifier,
        node.isTypeOnly ||
          Boolean(
            node.exportClause &&
              ts.isNamedExports(node.exportClause) &&
              node.exportClause.elements.length &&
              node.exportClause.elements.every(e => e.isTypeOnly),
          ),
      );
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, true);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression
    ) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0]
    ) {
      add(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return imports;
}

export function dependencyResolver(root) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.app.json'), ts.sys.readFile);
  const options = ts.parseJsonConfigFileContent(config.config ?? {}, ts.sys, root).options;
  const cache = ts.createModuleResolutionCache(root, s => s, options);
  return (source, importer) => {
    if (!source) return null;
    const clean = source.split('?')[0];
    let local;
    if (clean.startsWith('@/')) local = path.join(root, 'src', clean.slice(2));
    else if (clean.startsWith('@module/')) local = path.join(root, moduleDirOf(root, clean.slice(8)), 'lib/index');
    else if (clean.startsWith('/')) local = inside(clean, root) ? clean : path.join(root, 'src', clean.slice(1));
    else if (clean.startsWith('.')) local = path.resolve(path.dirname(importer), clean);
    if (local) {
      for (const candidate of [
        local,
        ...['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '/index.ts', '/index.tsx', '/index.js'].map(
          ext => local + ext,
        ),
      ]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return realFile(candidate);
      }
    }
    const resolved = ts.resolveModuleName(clean, importer, options, ts.sys, cache).resolvedModule?.resolvedFileName;
    return resolved ? realFile(resolved) : local ? path.resolve(local) : null;
  };
}

export function* sourceFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(file);
    else if (/\.(?:[cm]?[jt]sx?)$/.test(entry.name)) yield file;
  }
}

export function moduleConsumers(studioRoot, id) {
  // Resolved imports are real paths, so the folders they are compared with must be too.
  const root = realFile(studioRoot);
  const dir = path.join(root, moduleDirOf(root, id));
  const resolve = dependencyResolver(root);
  return [...sourceFiles(path.join(root, 'src')), path.join(root, 'vite.config.ts')]
    .filter(
      file =>
        !inside(file, dir) &&
        fs.existsSync(file) &&
        importsOf(fs.readFileSync(file, 'utf8'), file).some(({ source }) => {
          const target = resolve(source, file);
          return target && inside(target, dir);
        }),
    )
    .map(file => path.relative(root, file));
}
