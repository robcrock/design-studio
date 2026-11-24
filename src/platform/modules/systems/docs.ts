// A design system's component docs, worked out from its files. A component is whatever files
// share a name, in a folder of their own (button/), or flat, which is still found:
//
//   button/button.tsx            the component (listed, with its props)
//   button/button.examples.tsx   live examples: each export named with a capital is one example
//   button/index.ts              re-exports it, so it's imported as .../components/button (not a component file)
//   button/button.md             front matter (title, description) and a "When to use" section, then
//                         anything else the team wants to write
//   button/button-icon.tsx       any other file in a folder with an index file is an internal part of that
//                         component, unless it has docs or examples of its own
//
// Only the first is needed to appear; the others add to the page. Nothing here reads a disk or
// imports anything, so Node scripts and the app can both load it. src/platform/modules/systems/node/docs.js
// reads the files and calls this.

export type SystemComponent = {
  name: string; // as the component file spells it ("Button", "button")
  slug: string; // its page in the Systems section ("icon-button")
  files: {
    // paths inside the system's components folder; null if absent
    source: string | null;
    examples: string | null;
    doc: string | null;
  };
};

// A component as the manifest carries it: its files, and what its markdown says about it (`docs` in
// its frontmatter is a link to its documentation elsewhere).
export type SystemComponentDoc = SystemComponent & {
  title: string;
  description: string;
  category: string | null;
  docsUrl: string | null;
  sourceNote?: string;
};

// A description from a component's comments, made short enough to read at a glance: its first
// sentence, without Markdown backticks, cut at a word if it's still longer than `max`.
export function conciseDescription(text: string, max = 140): string {
  const flat = text.replace(/`/g, '').replace(/\s+/g, ' ').trim();
  const first = flat.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? flat;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 1)).replace(/[\s,;:.\-]+$/, '')}…`;
}

// A component's props, read from its TypeScript (src/platform/modules/systems/node/extract-props.js). `native` is true
// when it also accepts the native attributes of the element it renders, which are left out of the list.
export type PropDoc = { name: string; type: string; required: boolean; default: string | null; description: string };
export type ComponentPropsDoc = { name: string; props: PropDoc[]; native: boolean };

type Kind = keyof SystemComponent['files'];

// "IconButton" → "icon-button": the component's page in the Systems section.
const kebab = (name: string) =>
  name
    .replace(/([a-z\d])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z\d]+/g, '-')
    .toLowerCase();

// The part of a path after its last "/".
const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);

// Which kind of file this is, and the name it goes by. Helpers (index files, tests, stories,
// anything starting with "_" or ".") and a README are not components.
function classify(file: string): { kind: Kind; name: string } | null {
  const base = baseName(file);
  if (/^[._]/.test(base) || /^index\.[jt]sx?$/.test(base) || /^readme\.md$/i.test(base)) return null;
  if (/\.(test|spec|stories)\.[jt]sx?$/.test(base) || base.endsWith('.d.ts')) return null;
  let m = base.match(/^(.+)\.examples\.[jt]sx$/);
  if (m) return { kind: 'examples', name: m[1] };
  m = base.match(/^(.+)\.md$/);
  if (m) return { kind: 'doc', name: m[1] };
  m = base.match(/^(.+)\.[jt]sx$/);
  if (m) return { kind: 'source', name: m[1] };
  return null;
}

// The components in a list of paths inside a system's components folder ("button.tsx",
// "dialog/dialog.md"). Files match by folder and name, ignoring case, so button.md belongs to
// Button.tsx next to it but not to another folder's button. A component needs at least one of the
// three files, so a system whose components come from a package can hold only the docs.
export function discoverComponents(files: string[]): SystemComponent[] {
  const found = new Map<string, SystemComponent>();
  for (const file of [...files].sort()) {
    const c = classify(file);
    if (!c) continue;
    const key = `${file.slice(0, file.length - baseName(file).length)}${c.name}`.toLowerCase();
    let component = found.get(key);
    if (!component) {
      component = { name: c.name, slug: kebab(c.name), files: { source: null, examples: null, doc: null } };
      found.set(key, component);
    }
    if (!component.files[c.kind]) component.files[c.kind] = file;
    // The component file names it best (Button over button), whichever was seen first.
    if (c.kind === 'source') {
      component.name = c.name;
      component.slug = kebab(c.name);
    }
  }
  // A folder with an index file is one component, imported as the folder. Its other files, at any depth, are internal
  // parts: only the file named like the folder, or one with docs or examples of its own, gets a page.
  const indexed = new Set(
    files.filter(file => /^index\.[jt]sx?$/.test(baseName(file))).map(file => file.slice(0, -baseName(file).length)),
  );
  const internal = ({ name, files: own }: SystemComponent) => {
    if (!own.source || own.doc || own.examples) return false;
    const folder = own.source.slice(0, -baseName(own.source).length);
    const owner = [...indexed].filter(dir => folder.startsWith(dir)).sort((a, b) => b.length - a.length)[0];
    return (
      owner !== undefined && !(owner === folder && baseName(folder.slice(0, -1)).toLowerCase() === name.toLowerCase())
    );
  };
  return [...found.values()].filter(component => !internal(component)).sort((a, b) => a.name.localeCompare(b.name));
}

// The examples an examples file offers: its exports named with a capital, as React components are.
export function exampleNames(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/^export\s+(?:async\s+)?(?:const|function|class)\s+([A-Z]\w*)/gm)) names.push(m[1]);
  return names;
}

// The file's text with code blocks and HTML comments removed, so a heading inside an example
// or the scaffold's hint comment doesn't count.
const prose = (body: string) => body.replace(/^(```|~~~)[\s\S]*?^\1/gm, '').replace(/<!--[\s\S]*?-->/g, '');

// What a component's page is missing, as short sentences starting with the file or thing at
// fault ("button.md needs a ..."). `doc` is the parsed markdown file, `examples` the examples
// file's text; either is null when the file isn't there.
export function componentProblems(
  component: SystemComponent,
  text: { doc: { frontmatter: Record<string, unknown> | null; body: string } | null; examples: string | null },
): string[] {
  const { files } = component;
  const problems: string[] = [];
  const stem = files.source ? baseName(files.source).replace(/\.[jt]sx$/, '') : component.name;
  if (!files.doc && !files.examples)
    return [
      `has no examples or description yet. Add ${stem}.examples.tsx and ${stem}.md, or move it into the folder of the component it belongs to`,
    ];
  if (!files.doc) problems.push(`has no ${stem}.md yet (a title, a description, and a "When to use" section)`);
  else if (text.doc) {
    const file = baseName(files.doc);
    const fm = text.doc.frontmatter ?? {};
    for (const field of ['title', 'description']) {
      if (typeof fm[field] !== 'string' || !(fm[field] as string).trim())
        problems.push(`${file} needs a "${field}" in its front matter`);
    }
    if (!/^#{2,3}[ \t]+when to use[ \t]*$/im.test(prose(text.doc.body)))
      problems.push(`${file} needs a "When to use" section (a ## heading)`);
  }
  if (!files.examples) problems.push(`has no ${stem}.examples.tsx yet (at least one example)`);
  else if (text.examples !== null && exampleNames(text.examples).length === 0) {
    problems.push(
      `${baseName(files.examples)} has no examples: export a React component whose name starts with a capital letter`,
    );
  }
  return problems;
}

// Two components with the same name would share a page.
export function duplicateProblems(components: SystemComponent[]): { component: SystemComponent; problem: string }[] {
  const seen = new Map<string, SystemComponent>();
  const problems: { component: SystemComponent; problem: string }[] = [];
  for (const component of components) {
    const first = seen.get(component.slug);
    if (first)
      problems.push({
        component,
        problem: `has the same name as ${first.files.source ?? first.files.doc ?? first.files.examples}, so they'd share a page. Rename one`,
      });
    else seen.set(component.slug, component);
  }
  return problems;
}
