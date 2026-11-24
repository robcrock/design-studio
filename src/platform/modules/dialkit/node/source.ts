// Source changes for a view's dials: Add, Save to code (the `apply` action), and Remove (README.md). Each takes a
// view's source text and returns the new text; nothing here reads or writes files. Edits are surgical, so formatting
// and comments stay.
import ts from 'typescript';

export const LIBRARY = '@module/dialkit';
const HOOK = 'useDialKit';

// One registered panel: its group name and its values as DialKit reports them, keyed by dotted path.
export type PanelValues = { name: string; values: Record<string, unknown> };
type Edit = { start: number; end: number; text: string };

const parse = (source: string) =>
  ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function apply(source: string, edits: Edit[]) {
  for (const edit of edits.sort((a, b) => b.start - a.start))
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  return source;
}

function syntaxCheck(file: ts.SourceFile) {
  const diagnostics = (file as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }).parseDiagnostics;
  if (diagnostics.length) throw new Error('Fix the syntax errors in this view first.');
}

// The library's import and the local names `useDialKit` is bound to in this file.
function libraryImports(file: ts.SourceFile) {
  const imports = file.statements.filter(
    (s): s is ts.ImportDeclaration =>
      ts.isImportDeclaration(s) && ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === LIBRARY,
  );
  const hooks = new Set<string>();
  for (const declaration of imports) {
    const bindings = declaration.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const element of bindings.elements)
        if ((element.propertyName ?? element.name).text === HOOK) hooks.add(element.name.text);
  }
  return { imports, hooks };
}

export const hasDials = (source: string) => libraryImports(parse(source)).imports.length > 0;

// Every `useDialKit('Name', config, options?)` call, with its config's object literal.
function dialCalls(file: ts.SourceFile, hooks: Set<string>) {
  const constants = new Map<string, ts.VariableDeclaration>();
  const calls: {
    call: ts.CallExpression;
    name: string;
    config: ts.ObjectLiteralExpression;
    constant?: ts.VariableDeclaration;
  }[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer)
      constants.set(node.name.text, node);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && hooks.has(node.expression.text)) {
      const [name, config] = node.arguments;
      if (!name || !(ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)))
        throw new Error("Give each DialKit group a literal name, like useDialKit('Card', { … }).");
      if (calls.some(c => c.name === name.text))
        throw new Error(`Two DialKit groups are named "${name.text}". Give each group its own name.`);
      calls.push({ call: node, name: name.text, ...configOf(config, constants, name.text) });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return calls;
}

const unwrap = (node: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)
    ? unwrap(node.expression)
    : node;

function configOf(node: ts.Expression | undefined, constants: Map<string, ts.VariableDeclaration>, group: string) {
  const expression = node && unwrap(node);
  if (expression && ts.isObjectLiteralExpression(expression)) return { config: expression };
  const constant = expression && ts.isIdentifier(expression) ? constants.get(expression.text) : undefined;
  const initializer = constant?.initializer && unwrap(constant.initializer);
  if (constant && initializer && ts.isObjectLiteralExpression(initializer)) return { config: initializer, constant };
  throw new Error(`Write the "${group}" dials as an object in this file, so their values can be written back.`);
}

const keyOf = (property: ts.ObjectLiteralElementLike, file: ts.SourceFile) => {
  if (!ts.isPropertyAssignment(property)) return undefined;
  const name = property.name;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  throw new Error(`Use a plain key instead of ${name.getText(file)} in DialKit dials.`);
};

const typeOf = (node: ts.ObjectLiteralExpression) => {
  for (const property of node.properties)
    if (ts.isPropertyAssignment(property) && keyOf(property, node.getSourceFile()) === 'type') {
      const value = unwrap(property.initializer);
      if (ts.isStringLiteral(value)) return value.text;
    }
  return undefined;
};

// Literal source for a value, in the file's quote style.
function literal(value: unknown, quote: string, indent = ''): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('A dial has a value that is not a finite number.');
    return String(Number(value.toPrecision(12)));
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'string')
    return quote + JSON.stringify(value).slice(1, -1).replaceAll('\\"', '"').replaceAll(quote, `\\${quote}`) + quote;
  if (Array.isArray(value)) return `[${value.map(v => literal(v, quote, indent)).join(', ')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (!entries.length) return '{}';
    const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : literal(k, quote));
    const inline = `{ ${entries.map(([k, v]) => `${key(k)}: ${literal(v, quote, indent)}`).join(', ')} }`;
    if (inline.length + indent.length <= 100 && !inline.includes('\n')) return inline;
    const inner = indent + '  ';
    return `{\n${entries.map(([k, v]) => `${inner}${key(k)}: ${literal(v, quote, inner)},`).join('\n')}\n${indent}}`;
  }
  throw new Error('A dial has a value that cannot be written to code.');
}

const quoteOf = (file: ts.SourceFile) => {
  let quote: string | undefined;
  const visit = (node: ts.Node) => {
    if (!quote && ts.isStringLiteral(node)) quote = node.getText(file)[0];
    if (!quote) ts.forEachChild(node, visit);
  };
  visit(file);
  return quote === '"' ? '"' : "'";
};

const indentOf = (node: ts.Node, file: ts.SourceFile) => {
  const line = file.text.lastIndexOf('\n', node.getStart(file)) + 1;
  return /^[ \t]*/.exec(file.text.slice(line))![0];
};

const isLiteral = (node: ts.Expression) =>
  ts.isNumericLiteral(node) ||
  ts.isStringLiteral(node) ||
  ts.isNoSubstitutionTemplateLiteral(node) ||
  node.kind === ts.SyntaxKind.TrueKeyword ||
  node.kind === ts.SyntaxKind.FalseKeyword ||
  (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand));

const unsafeImage = (value: unknown) => typeof value === 'string' && /^(?:data|blob):/.test(value);

// The edits that make each dial's default in `config` the matching value. Dials without a value are left alone.
function defaultEdits(
  config: ts.ObjectLiteralExpression,
  values: Record<string, unknown>,
  file: ts.SourceFile,
  quote: string,
  prefix = '',
) {
  const edits: Edit[] = [];
  const replace = (node: ts.Node, value: unknown) =>
    edits.push({ start: node.getStart(file), end: node.end, text: literal(value, quote, indentOf(node, file)) });
  // Set an object's `default` (or another key), adding the property when it is missing.
  const setProperty = (object: ts.ObjectLiteralExpression, key: string, value: unknown) => {
    const existing = object.properties.find(p => keyOf(p, file) === key) as ts.PropertyAssignment | undefined;
    if (existing) return replace(existing.initializer, value);
    const last = object.properties[object.properties.length - 1];
    const at = last ? last.end : object.getStart(file) + 1;
    edits.push({ start: at, end: at, text: `${last ? ',' : ''} ${key}: ${literal(value, quote)}` });
  };
  for (const property of config.properties) {
    const key = keyOf(property, file);
    if (key === undefined) throw new Error(`Write the dials in ${prefix || 'this group'} as plain properties.`);
    if (key === '_collapsed') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const node = unwrap((property as ts.PropertyAssignment).initializer);
    const value = values[path];
    if (ts.isObjectLiteralExpression(node)) {
      const type = typeOf(node);
      if (type === undefined) {
        edits.push(...defaultEdits(node, values, file, quote, path));
        continue;
      }
      if (type === 'action' || !(path in values)) continue;
      if (type === 'spring' || type === 'easing') replace(node, value);
      else if (type === 'pad') {
        const pad = value as { x: number; y: number };
        for (const axis of ['x', 'y'] as const) {
          const current = node.properties.find(p => keyOf(p, file) === axis) as ts.PropertyAssignment | undefined;
          const axisNode = current && unwrap(current.initializer);
          if (axisNode && ts.isArrayLiteralExpression(axisNode) && axisNode.elements[0])
            replace(axisNode.elements[0], pad[axis]);
          else if (axisNode && ts.isObjectLiteralExpression(axisNode)) setProperty(axisNode, 'default', pad[axis]);
          else if (!axisNode) setProperty(node, axis, [pad[axis], -1, 1, 0.01]);
          else throw new Error(`Write the "${path}" pad's ${axis} axis as [default, min, max, step].`);
        }
      } else {
        if (type === 'image' && unsafeImage(value))
          throw new Error(
            `"${path}" holds an uploaded image, which can't be written to code. Pick one of its options instead.`,
          );
        setProperty(node, 'default', value);
      }
      continue;
    }
    if (!(path in values)) continue;
    if (ts.isArrayLiteralExpression(node)) {
      const first = node.elements[0] && unwrap(node.elements[0] as ts.Expression);
      if (!first || !isLiteral(first)) throw new Error(`Write the default of "${path}" as a number.`);
      replace(first, value);
    } else if (isLiteral(node)) replace(node, value);
    else throw new Error(`Write the default of "${path}" as a literal value, so it can be written back.`);
  }
  return edits;
}

// The values a group's hook returns, built from its dials' defaults (after `values`, if given): what Remove writes.
function resolvedValues(
  config: ts.ObjectLiteralExpression,
  values: Record<string, unknown> | undefined,
  prefix = '',
): Record<string, unknown> {
  const file = config.getSourceFile();
  const result: Record<string, unknown> = {};
  const evaluate = (node: ts.Expression): unknown => {
    node = unwrap(node);
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isPrefixUnaryExpression(node)) return -Number((node.operand as ts.NumericLiteral).text);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(e => evaluate(e as ts.Expression));
    if (ts.isObjectLiteralExpression(node))
      return Object.fromEntries(
        node.properties.map(p => [keyOf(p, file), evaluate((p as ts.PropertyAssignment).initializer)]),
      );
    throw new Error(`Write the default of "${node.getText(file)}" as a literal value before removing DialKit.`);
  };
  for (const property of config.properties) {
    const key = keyOf(property, file)!;
    if (key === '_collapsed') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const node = unwrap((property as ts.PropertyAssignment).initializer);
    const type = ts.isObjectLiteralExpression(node) ? typeOf(node) : undefined;
    if (type === 'action') continue;
    if (ts.isObjectLiteralExpression(node) && type === undefined) {
      result[key] = resolvedValues(node, values, path);
      continue;
    }
    if (values && path in values) {
      if (type === 'image' && unsafeImage(values[path]))
        throw new Error(
          `"${path}" holds an uploaded image, which can't be written to code. Pick one of its options instead.`,
        );
      result[key] = values[path];
      continue;
    }
    const value = evaluate(node) as Record<string, unknown> | unknown[] | number | string | boolean;
    if (Array.isArray(value)) result[key] = value[0];
    else if (type === 'pad') {
      const axis = (a: unknown) =>
        Array.isArray(a) ? a[0] : a && typeof a === 'object' ? (a as { default: number }).default : 0;
      result[key] = { x: axis((value as Record<string, unknown>).x), y: axis((value as Record<string, unknown>).y) };
    } else if (type === 'spring' || type === 'easing') result[key] = value;
    else if (type) result[key] = (value as { default?: unknown; options?: unknown[] }).default ?? firstOption(value);
    else result[key] = value;
  }
  return result;
}

const firstOption = (config: unknown) => {
  const option = (config as { options?: unknown[] }).options?.[0];
  return option && typeof option === 'object' ? (option as { value: unknown }).value : (option ?? '');
};

// Save to code (the `apply` action): make every matching group's current values its new defaults. Returns the new
// source and the groups it found.
export function applyDials(source: string, panels: PanelValues[]) {
  const file = parse(source);
  syntaxCheck(file);
  const { hooks } = libraryImports(file);
  const calls = dialCalls(file, hooks);
  const quote = quoteOf(file);
  const edits: Edit[] = [];
  const applied: string[] = [];
  for (const panel of panels) {
    const call = calls.find(c => c.name === panel.name);
    if (!call) continue;
    edits.push(...defaultEdits(call.config, panel.values, file, quote));
    applied.push(panel.name);
  }
  if (panels.length && !applied.length)
    throw new Error(
      'These dials are not in this view’s file. Reload the view, or save them to code where they are written.',
    );
  return { source: apply(source, edits), applied };
}

// Add: import the hook and start an empty group at the top of the view's component, for the agent to fill.
export function addDials(source: string, group: string) {
  const file = parse(source);
  syntaxCheck(file);
  if (libraryImports(file).imports.length) throw new Error('This view already has DialKit.');
  const body = componentBody(file);
  if (!body) throw new Error('Couldn’t find this view’s component. Ask your agent to add DialKit dials instead.');
  const quote = quoteOf(file);
  const imports = file.statements.filter(ts.isImportDeclaration);
  const importText = `import { ${HOOK} } from ${quote}${LIBRARY}${quote};`;
  const edits: Edit[] = [];
  if (imports.length) {
    const last = imports[imports.length - 1];
    edits.push({ start: last.end, end: last.end, text: `\n${importText}` });
  } else {
    const first = file.statements[0];
    const at = first ? first.getStart(file) : file.text.length;
    edits.push({ start: at, end: at, text: `${importText}\n\n` });
  }
  const first = body.statements[0];
  const indent = first ? indentOf(first, file) : indentOf(body, file) + '  ';
  const at = first ? first.getStart(file) : body.getStart(file) + 1;
  const call = `${HOOK}(${literal(group, quote)}, {});`;
  edits.push({
    start: at,
    end: at,
    text: first ? `${call}\n${indent}` : `\n${indent}${call}\n${indentOf(body, file)}`,
  });
  return apply(source, edits);
}

// The block body of the view's default-exported component, written as a function or an arrow with braces.
function componentBody(file: ts.SourceFile): ts.Block | undefined {
  const functions = new Map<string, ts.Block>();
  let exported: string | undefined;
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body) {
      const isDefault = statement.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
      if (isDefault) return statement.body;
      if (statement.name) functions.set(statement.name.text, statement.body);
    }
    if (ts.isVariableStatement(statement))
      for (const d of statement.declarationList.declarations) {
        const init = d.initializer && unwrap(d.initializer);
        if (
          ts.isIdentifier(d.name) &&
          init &&
          (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) &&
          ts.isBlock(init.body)
        )
          functions.set(d.name.text, init.body);
      }
    if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
      const expression = unwrap(statement.expression);
      if (ts.isIdentifier(expression)) exported = expression.text;
      else if ((ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) && ts.isBlock(expression.body))
        return expression.body;
    }
  }
  return exported ? functions.get(exported) : undefined;
}

// Remove: replace each group with plain values (its live values when given, otherwise its defaults), then drop
// the import, and any config constant only the hook used.
export function removeDials(source: string, panels: PanelValues[] = []) {
  const file = parse(source);
  syntaxCheck(file);
  const { imports, hooks } = libraryImports(file);
  if (!imports.length) throw new Error('This view doesn’t use DialKit.');
  const calls = dialCalls(file, hooks);
  // The hook must only be called, so removing its import can't leave a dangling reference.
  const references = (name: string) => {
    let count = 0;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text === name && !ts.isImportSpecifier(node.parent)) count++;
      ts.forEachChild(node, visit);
    };
    visit(file);
    return count;
  };
  for (const hook of hooks)
    if (references(hook) !== calls.filter(c => (c.call.expression as ts.Identifier).text === hook).length)
      throw new Error(`${hook} is used other than as a call in this view. Remove DialKit from the code by hand.`);
  for (const declaration of imports) {
    const bindings = declaration.importClause?.namedBindings;
    const names = bindings && ts.isNamedImports(bindings) ? bindings.elements.map(e => e.name.text) : [];
    for (const name of names)
      if (!hooks.has(name) && references(name))
        throw new Error(`This view uses ${name} from DialKit. Remove it from the code by hand.`);
  }
  const quote = quoteOf(file);
  const edits: Edit[] = imports.map(declaration => {
    const end = file.text[declaration.end] === '\n' ? declaration.end + 1 : declaration.end;
    return { start: declaration.getStart(file), end, text: '' };
  });
  for (const { call, name, config, constant } of calls) {
    const values = resolvedValues(config, panels.find(p => p.name === name)?.values);
    // A group nothing reads (as Add leaves it) goes whole; otherwise its values take the call's place.
    if (ts.isExpressionStatement(call.parent)) {
      const statement = call.parent;
      const end = file.text[statement.end] === '\n' ? statement.end + 1 : statement.end;
      edits.push({ start: statement.getStart(file) - indentOf(statement, file).length, end, text: '' });
    } else
      edits.push({ start: call.getStart(file), end: call.end, text: literal(values, quote, indentOf(call, file)) });
    // A config constant used only by this call goes too.
    if (constant && ts.isIdentifier(constant.name) && references(constant.name.text) === 2) {
      const list = constant.parent;
      const statement = list.parent;
      if (ts.isVariableDeclarationList(list) && ts.isVariableStatement(statement) && list.declarations.length === 1) {
        const end = file.text[statement.end] === '\n' ? statement.end + 1 : statement.end;
        edits.push({ start: statement.getStart(file) - indentOf(statement, file).length, end, text: '' });
      }
    }
  }
  return apply(source, edits);
}
