// The tools an agent uses on a canvas, defined once. The app's live API (agent.ts, in the open
// browser tab) and the command line (cli.ts, on the file) both run them from here, so they behave
// the same and `help` describes both. Pure: elements in, elements out, and nothing imported from
// Excalidraw.
//
// The tools are meant to be enough to use Excalidraw fluently: shapes, text, arrows, lines, sticky
// notes, frames, and the views and documents of a prototype. `create` and `update` take Excalidraw's
// own vocabulary (colors, stroke, fill), and the shortcuts (notes, artifacts, sections) are just
// conveniences on top of it.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { artifactSlug } from '../../core/fileTypes.ts';
import {
  NOTE_COLORS,
  NOTE_SIZE,
  ToolError,
  arrowEnds,
  boundsOf,
  bump,
  centerLabel,
  color,
  labelFor,
  make,
  measureText,
  labelRoom,
  newId,
  noteLayout,
  textElement,
  textHeight,
  unionBounds,
  wrapText,
  type El,
} from './elements.ts';

export { ToolError, type El };

// What the tools need to know about the app around the canvas.
export type ArtifactInfo = {
  path: string;
  sourcePath?: string;
  title: string;
  type: string;
  typeLabel: string;
  preview: boolean;
  // The screens a view can be shown at (its system's; the first is the default). Absent for other artifacts.
  screens?: readonly Screen[];
};
export type Screen = { name: string; width: number };
export type Ctx = {
  // The canvas’s own permanent prototype address.
  base: string;
  // The artifact at its permanent app address, or null.
  artifact(path: string): ArtifactInfo | null;
  // The artifacts in this prototype, for the `artifacts` tool and hints. A canvas shows only its own prototype's artifacts.
  artifacts?(): ArtifactInfo[];
  // A link's app path: "https://host/samples/x" is "/samples/x". App paths pass through. Null if it isn't a link into the app.
  linkPath?(link: string): string | null;
};

// How big things start out. A view is its screen width and 900 px of its height at a third of the size (1440 is
// 480 x 300, under its title bar), so views at different screen widths compare at one scale; a card is one row.
// Its height is only how much shows: set it to frame a device.
const ARTIFACT_WIDTH = 480;
const PREVIEW_HEIGHT = 338;
const PREVIEW_CHROME = 38; // the title bar and border
export const screenBox = (screen: Screen) => ({
  width: Math.round(screen.width / 3),
  height: PREVIEW_CHROME + 300,
});
const CARD_HEIGHT = 88;
const GAP = 80;
const NOTE_GAP = 24;
const SECTION_GAP = 120;
const SECTION_PAD = 60;
const MAX_CREATE = 200;

// ---- help -------------------------------------------------------------------------------------

export type ToolDef = { name: string; live?: true; summary: string; args: Record<string, string>; example: unknown };

const STYLE_ARGS = {
  color:
    'shortcut for stroke and background together: a name (red, pink, grape, violet, blue, cyan, teal, green, yellow, orange, gray) or hex. On a sticky note: yellow, pink, green, blue, or orange',
  stroke: 'outline and text color: a name, a hex value, or "none"',
  background: 'fill color: a name (its light shade), a hex value, or "none"',
  strokeWidth: 'number, 1 (thin) to 4 (bold)',
  strokeStyle: '"solid", "dashed", or "dotted"',
  opacity: '0 to 100',
  rounded: 'true for rounded corners (rectangles and diamonds)',
};

export const TOOLS: ToolDef[] = [
  {
    name: 'context',
    live: true,
    summary:
      'Where you are: the canvas, what the person has selected, and what they are looking at. Use it to make sense of "this" and "here".',
    args: {},
    example: {},
  },
  {
    name: 'describe',
    summary:
      'Read the canvas as data: every element with its kind, position, size, text, colors and links (artifacts are named), plus sections. Look before you change things, and again after.',
    args: {
      scope:
        '"all" (default), "selection" (what the person has selected), or "view" (what is on their screen). The last two need the open canvas.',
      ids: 'only these elements (and their labels)',
    },
    example: { scope: 'selection' },
  },
  {
    name: 'artifacts',
    summary:
      "The views and documents you can put on the canvas with an `artifact`: their names, titles and types. A canvas shows only its own prototype's.",
    args: {},
    example: {},
  },
  {
    name: 'create',
    summary:
      'Make things. Pass { elements: [...] } (or one element). Each has a `type`; see help("create") for the types. Placement: x and y, or `below`, `rightOf` (an id or @ref), or `section`. With none, it goes below everything. `align` sets how it lines up with what it is beside: "start" (left edge under something, top edge beside it) or "center" (centered on it). `rightOf` centers by default, so arrows between things of different heights run straight; `below` aligns left. The result lists `warnings` if something landed on top of something else or repeats existing content. `ref` names it, so later elements in the same call can use @name.',
    args: {
      elements: 'a list of elements to make',
      type: 'text, rectangle, ellipse, diamond, arrow, line, artifact, section, or note',
      align: '"start" or "center", with below / rightOf',
      ...STYLE_ARGS,
    },
    example: {
      elements: [
        { type: 'artifact', artifact: 'lofi/main', ref: 'main' },
        { type: 'text', text: 'Retry keeps the draft', below: '@main', width: 480 },
        { type: 'rectangle', text: 'Payment', rightOf: '@main', color: 'blue', ref: 'pay' },
        { type: 'arrow', from: '@main', to: '@pay', text: 'continue' },
      ],
    },
  },
  {
    name: 'update',
    summary:
      'Change something that is there. Pass its id and any of the properties below; only those change. Text on a note, shape or arrow is its label.',
    args: {
      id: 'the element to change (or `ids` for several)',
      text: 'new text (a label, for a shape, note or arrow)',
      fontSize: 'text size',
      x: 'number',
      y: 'number',
      width: 'number',
      height: 'number',
      name: "a section's title",
      artifact: 'point an artifact at another view or document',
      screen:
        'the screen a view is laid out at: a name from its system ("Phone") or a width. Its width follows; its height stays',
      from: "an arrow's start (an id)",
      to: "an arrow's end (an id)",
      locked: 'true to lock it in place',
      ...STYLE_ARGS,
    },
    example: { id: 'abc123', text: 'Retry keeps the draft and the amount', color: 'yellow' },
  },
  {
    name: 'move',
    summary:
      'Move something by dx and dy, or to x and y. A section takes what is in it, a label goes with its shape, and arrows attached to it follow.',
    args: { id: 'the element (or `ids`)', dx: 'number', dy: 'number', x: 'number', y: 'number' },
    example: { id: 'abc123', dx: 0, dy: 120 },
  },
  {
    name: 'delete',
    summary:
      'Remove elements. Their labels and any arrows attached to them go too. A section keeps its contents unless `withContents` is true.',
    args: { id: 'the element (or `ids`)', withContents: 'true to remove a section and everything in it' },
    example: { ids: ['abc123', 'def456'] },
  },
  {
    name: 'point',
    live: true,
    summary:
      'Select these elements and scroll to them, so the person sees which one you mean. Use it when you say "this one".',
    args: { ids: 'the elements' },
    example: { ids: ['abc123'] },
  },
  {
    name: 'screenshot',
    live: true,
    summary:
      'A PNG (as a data URL) of the canvas, or of some elements. Views show as plain boxes; use describe for what they are.',
    args: { ids: 'only these (and what is in them)', scale: '0.1 to 4' },
    example: { scale: 1 },
  },
  {
    name: 'mermaid',
    summary:
      'Draw Mermaid as editable shapes and arrows: a flowchart, sequence, class, state or ER diagram, a Gantt chart, timeline or quadrant chart. It is placed like one element of `create` (x and y, `below`, `rightOf` or `section`; with none, below everything). `refs` in the result maps each Mermaid id (a node such as A, or an edge such as A_B) to its element id, for update and move. For a diagram that stays Mermaid, make a diagram artifact instead.',
    args: {
      source: 'the Mermaid text',
      x: 'number',
      y: 'number',
      below: 'an id',
      rightOf: 'an id',
      section: 'a section id',
    },
    example: { source: 'flowchart LR\n  cart[Cart] --> pay{Paid?}\n  pay -->|yes| done([Done])', below: 'abc123' },
  },
  {
    name: 'help',
    summary: 'This list. help("create") explains the element types.',
    args: { tool: 'a tool name, for its details' },
    example: 'create',
  },
];

const ELEMENT_TYPES: Record<string, { summary: string; args: Record<string, string>; example: unknown }> = {
  text: {
    summary: 'Native Excalidraw text with no box: the default for annotations, headings, and labels.',
    args: {
      text: 'what it says (\\n for a new line). A line longer than 560 wraps to that width',
      width: 'wrap to this width (20 to 4000), for a paragraph',
      fontSize: 'default 20; 28 for a heading',
      ...STYLE_ARGS,
    },
    example: { type: 'text', text: 'Onboarding flow', fontSize: 28, x: 0, y: -80 },
  },
  note: {
    summary:
      "Excalidraw's sticky note (N in the toolbar). Prefer native text for screen annotations unless a sticky note is wanted.",
    args: {
      text: 'what it says. It wraps to the note; long text gets a smaller font, then a taller note',
      color: 'yellow (default), pink, green, blue, or orange',
      width: 'default 250',
      height: 'default 250 (taller if the text needs it)',
    },
    example: { type: 'note', text: 'Retry keeps the draft', color: 'pink', below: '@main' },
  },
  rectangle: {
    summary: 'A rectangle, ellipse or diamond, with an optional label inside. Boxes for steps, groups, and states.',
    args: {
      text: 'a label inside',
      width: 'default 200',
      height: 'default 120',
      fontSize: 'label size, default 20',
      ...STYLE_ARGS,
    },
    example: { type: 'rectangle', text: 'Payment', color: 'blue', rounded: true, x: 600, y: 0 },
  },
  arrow: {
    summary:
      'An arrow (or a plain `line`). Between two elements, give `from` and `to` (ids or @refs): it stays attached when they move. Otherwise give a start (x, y, or placement) and dx, dy, or `points`.',
    args: {
      from: 'an id or @ref',
      to: 'an id or @ref',
      dx: 'number',
      dy: 'number',
      points: 'a list of [x, y] steps from the start',
      text: 'a label on the arrow',
      head: '"arrow" (default for arrows), "triangle", "dot", "bar", or "none"',
      startHead: 'the same, for the start',
      ...STYLE_ARGS,
    },
    example: { type: 'arrow', from: '@a', to: '@b', text: 'then' },
  },
  artifact: {
    summary:
      'An artifact from this prototype, on the canvas. Views and diagrams have live previews; other artifacts are cards with an Open link. It must be from this prototype: a canvas shows only its own. Its title bar opens it.',
    args: {
      artifact: 'its path in this prototype without the extension ("lofi/main")',
      screen:
        "a view only: the screen it is laid out at, one of its system's screens by name (\"Phone\") or a width in pixels (390). Default: the system's first screen. `artifacts` lists each view's screens. Show a view at several screens only when the person asks",
      width: "default: a view's screen width at a third of the size, 480 for another preview",
      height:
        'default 338 for a preview (900 px of a view at a third), 88 for a card. A view is cropped to it: set it to frame a device, such as 319 for a 390 x 844 phone',
    },
    example: { type: 'artifact', artifact: 'lofi/main', screen: 'Phone', ref: 'main' },
  },
  section: {
    summary:
      'A titled frame around things that go together. Give `children` (ids or @refs) and it wraps them; give only a size and put things in it with `section`.',
    args: {
      name: 'its title',
      children: 'ids or @refs to put in it',
      width: 'default fits the children',
      height: 'default fits the children',
    },
    // Sections clip what sticks out; these grow to hold anything put into them with `section`.
    example: { type: 'section', name: 'Edge cases', children: ['@a', '@b'] },
  },
};

// Details of one tool, or the list of all.
export function help(tool?: string) {
  if (!tool)
    return {
      tools: TOOLS.map(({ name, live, summary }) => ({
        name,
        summary,
        ...(live ? { needs: 'the open canvas in a browser' } : {}),
      })),
    };
  const def = TOOLS.find(t => t.name === tool);
  if (!def) throw new ToolError(`no tool "${tool}". Tools: ${TOOLS.map(t => t.name).join(', ')}`);
  return { ...def, ...(tool === 'create' ? { types: ELEMENT_TYPES } : {}) };
}

// ---- running a tool ---------------------------------------------------------------------------

export type Run = {
  elements: El[]; // the whole scene, deleted elements included
  result: unknown;
  touched: string[]; // ids made or changed, for the caller to re-measure
};

// Runs a tool on a scene. Never changes what it's given; returns the new scene.
export function run(scene: El[], tool: string, args: any, ctx: Ctx): Run {
  const input = args ?? {};
  switch (tool) {
    case 'describe':
      return { elements: scene, result: describe(scene, input, ctx), touched: [] };
    case 'artifacts':
      return { elements: scene, result: listArtifacts(ctx), touched: [] };
    case 'create':
      return create(scene, input, ctx);
    case 'update':
      return update(scene, input, ctx);
    case 'move':
      return move(scene, input);
    case 'delete':
      return remove(scene, input);
    case 'mermaid':
      return mermaid(scene, input, ctx);
    case 'help':
      return { elements: scene, result: help(typeof input === 'string' ? input : input.tool), touched: [] };
    default:
      throw new ToolError(
        `no tool "${tool}" here. Tools: ${TOOLS.filter(t => !t.live)
          .map(t => t.name)
          .join(', ')}`,
      );
  }
}

const live = (scene: El[]) => scene.filter(el => !el.isDeleted);
const labelOf = (scene: El[], el: El) => scene.find(t => t.containerId === el.id && !t.isDeleted && t.type === 'text');
const isNote = (el: El) => el.type === 'stickynote';
const noteColorName = (el: El) =>
  Object.entries(NOTE_COLORS).find(([, fill]) => fill === el.backgroundColor)?.[0] ?? el.backgroundColor;
const noteColor = (name: unknown) => {
  const fill = NOTE_COLORS[name as string];
  if (!fill) throw new ToolError(`a note's color must be one of ${Object.keys(NOTE_COLORS).join(', ')}`);
  return fill;
};
// A note's label, laid out the way Excalidraw lays it out: centered, its font shrunk to fit.
function noteLabel(note: El, text: string, layout: ReturnType<typeof noteLayout>, baseFontSize = 20): El {
  const label = textElement({
    text,
    x: 0,
    y: 0,
    fontSize: layout.fontSize,
    containerId: note.id,
    boxWidth: layout.room,
    align: 'center',
  });
  return centerLabel(
    { ...note, height: layout.height - 20 },
    { ...label, baseFontSize, strokeColor: note.strokeColor ?? '#1e1e1e' },
  );
}
const isArtifact = (el: El) => el.type === 'embeddable' && typeof el.link === 'string';

function num(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ToolError(`${field} must be a number`);
  return value;
}

// A width or height someone asked for: a number, kept to a size a canvas can hold.
function size(value: unknown, field: string): number | undefined {
  const n = num(value, field);
  if (n !== undefined && (n < 20 || n > 4000)) throw new ToolError(`${field} must be between 20 and 4000`);
  return n;
}

// Free text wraps to this width when a line is longer, so a paragraph reads as one. Give `width` for another.
const TEXT_WRAP_WIDTH = 560;

function str(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new ToolError(`${field} must be text`);
  if (value.length > 4000) throw new ToolError(`${field} is longer than 4000 characters`);
  return value;
}

// An element by id, or by @ref within a call.
function finder(scene: () => El[], refs: Record<string, string> = Object.create(null)) {
  return (id: unknown, field: string): El => {
    if (typeof id !== 'string')
      throw new ToolError(`${field} must be an element id${Object.keys(refs).length ? ' or an @ref' : ''}`);
    const real = id.startsWith('@') ? refs[id.slice(1)] : id;
    const el = real && scene().find(e => e.id === real && !e.isDeleted);
    if (!el)
      throw new ToolError(
        `${field}: no element ${id}. Use an id from describe${
          Object.keys(refs).length
            ? ` or an @ref made earlier in this call (${Object.keys(refs)
                .map(r => `@${r}`)
                .join(', ')})`
            : ''
        }`,
      );
    return el;
  };
}

// The screen a `screen` argument means for this artifact: one of its screens by name or width, or another width.
// With none, its default screen. Null for an artifact without screens.
function screenOf(info: ArtifactInfo, value: unknown): Screen | null {
  if (!info.screens?.length) {
    if (value !== undefined) throw new ToolError(`screen applies to views; ${info.title} is a ${info.typeLabel}`);
    return null;
  }
  if (value === undefined) return info.screens[0];
  const named = info.screens.find(
    s => s.width === value || (typeof value === 'string' && s.name.toLowerCase() === value.trim().toLowerCase()),
  );
  if (named) return named;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 200 && value <= 4096)
    return { name: String(value), width: value };
  throw new ToolError(
    `screen should be one of ${info.screens.map(s => `${s.name} (${s.width})`).join(', ')}, or a width from 200 to 4096`,
  );
}

// The app path an `artifact` argument means.
function artifactPath(value: unknown, ctx: Ctx): string {
  const given = str(value, 'artifact').trim();
  const asPath = ctx.linkPath?.(given) ?? (given.startsWith('/') ? given : null);
  const sourcePath = given.replace(/^\.?\//, '');
  const matches = asPath
    ? []
    : (ctx.artifacts?.() ?? []).filter(
        item =>
          item.sourcePath === sourcePath ||
          (item.sourcePath && artifactSlug(item.sourcePath) === artifactSlug(sourcePath)),
      );
  if (matches.length > 1) throw new ToolError(`ambiguous artifact source path ${given}`);
  const path = asPath ?? matches[0]?.path ?? `${ctx.base}/${sourcePath}`;
  // A canvas shows only its own prototype's artifacts, so a prototype stays self-contained.
  if (!path.startsWith(`${ctx.base}/`))
    throw new ToolError(
      `${given} is in another prototype. A canvas shows only artifacts from its own (${ctx.base}). Copy the view into this prototype first, then put that copy on the canvas`,
    );
  // Without the extension: "lofi/main.tsx" is "lofi/main".
  return path
    .split('/')
    .map((part, i, all) => (i === all.length - 1 ? artifactSlug(part) : part))
    .join('/')
    .replace(/\/$/, '');
}

function styleOf(spec: El, kind: 'shape' | 'text' | 'line' = 'shape'): El {
  const out: El = {};
  if (spec.color !== undefined) {
    out.strokeColor = color(spec.color, 'stroke', 'color');
    if (kind === 'shape') {
      out.backgroundColor = color(spec.color, 'background', 'color');
      out.fillStyle = 'solid';
    }
  }
  if (spec.stroke !== undefined) out.strokeColor = color(spec.stroke, 'stroke');
  if (spec.background !== undefined) {
    out.backgroundColor = color(spec.background, 'background');
    out.fillStyle = 'solid';
  }
  if (spec.strokeWidth !== undefined) out.strokeWidth = num(spec.strokeWidth, 'strokeWidth');
  if (spec.strokeStyle !== undefined) {
    if (!['solid', 'dashed', 'dotted'].includes(spec.strokeStyle))
      throw new ToolError('strokeStyle must be "solid", "dashed", or "dotted"');
    out.strokeStyle = spec.strokeStyle;
  }
  if (spec.opacity !== undefined) out.opacity = Math.min(100, Math.max(0, num(spec.opacity, 'opacity')!));
  if (spec.rounded !== undefined) out.roundness = spec.rounded ? { type: 3 } : null;
  return out;
}

const ARROWHEADS = ['arrow', 'triangle', 'dot', 'bar', 'none'];
function head(value: unknown, fallback: string | null, field: string): string | null {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !ARROWHEADS.includes(value))
    throw new ToolError(`${field} must be one of ${ARROWHEADS.map(h => `"${h}"`).join(', ')}`);
  return value === 'none' ? null : value;
}

// The points of an arrow or line, relative to its start, and the box around them.
function pointsBox(points: number[][]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return { width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

// An arrow's label sits at the middle of the arrow.
function placeArrowLabel(arrow: El, label: El): El {
  const b = boundsOf(arrow);
  return { ...label, x: b.x + b.width / 2 - label.width / 2, y: b.y + b.height / 2 - label.height / 2 };
}

// An artifact's app path as `artifact` takes it inside this prototype: "lofi/main".
const relative = (path: string, ctx: Ctx) => (path.startsWith(`${ctx.base}/`) ? path.slice(ctx.base.length + 1) : path);

function listArtifacts(ctx: Ctx) {
  const artifacts = (ctx.artifacts?.() ?? []).map(i => ({
    artifact: i.sourcePath ?? relative(i.path, ctx),
    title: i.title,
    type: i.typeLabel,
    ...(i.preview ? { shownAs: 'live preview' } : { shownAs: 'card' }),
    ...(i.screens && { screens: i.screens.map(s => `${s.name} ${s.width}`) }),
  }));
  return { artifacts };
}

// ---- create -----------------------------------------------------------------------------------

// Where a new element goes: given, beside or under another element, at the end of a section, or below everything.
function placeOf(scene: El[], find: ReturnType<typeof finder>, spec: El, width: number, height = 0) {
  const align = spec.align ?? undefined;
  if (align !== undefined && align !== 'start' && align !== 'center')
    throw new ToolError('align must be "start" or "center"');
  const x = num(spec.x, 'x');
  const y = num(spec.y, 'y');
  if (x !== undefined && y !== undefined) return { x, y };
  if (spec.below !== undefined) {
    const b = boundsOf(find(spec.below, 'below'));
    return { x: x ?? (align === 'center' ? b.x + (b.width - width) / 2 : b.x), y: y ?? b.y + b.height + NOTE_GAP };
  }
  if (spec.rightOf !== undefined) {
    const b = boundsOf(find(spec.rightOf, 'rightOf'));
    return { x: x ?? b.x + b.width + GAP, y: y ?? (align === 'start' ? b.y : b.y + (b.height - height) / 2) };
  }
  if (spec.section !== undefined) {
    const frame = find(spec.section, 'section');
    const kids = live(scene).filter(el => el.frameId === frame.id && !(el.type === 'text' && el.containerId));
    if (!kids.length) return { x: frame.x + SECTION_PAD, y: frame.y + SECTION_PAD };
    const b = unionBounds(kids.map(boundsOf))!;
    return { x: b.x + b.width + GAP, y: b.y };
  }
  const all = unionBounds(
    live(scene)
      .filter(el => !(el.type === 'text' && el.containerId))
      .map(boundsOf),
  );
  return all ? { x: x ?? all.x, y: y ?? all.y + all.height + SECTION_GAP } : { x: x ?? 0, y: y ?? 0 };
}

// `laidOut`: the elements come laid out already (a Mermaid diagram), so they keep their sizes and don't warn about
// overlapping each other.
function create(input: El[], args: any, ctx: Ctx, laidOut = false): Run {
  const specs: El[] | null = Array.isArray(args)
    ? args
    : Array.isArray(args.elements)
      ? args.elements
      : args.type
        ? [args]
        : null;
  if (!specs?.length)
    throw new ToolError(
      'create needs { elements: [...] }: a list of things to make, each with a `type`. help("create") lists the types.',
    );
  if (specs.length > MAX_CREATE) throw new ToolError(`at most ${MAX_CREATE} elements per call`);

  let scene = input.slice();
  const refs: Record<string, string> = Object.create(null); // names come from the caller: no '__proto__' surprises
  const created: string[] = [];
  const touched = new Set<string>();
  const find = finder(() => scene, refs);
  const replace = (id: string, patch: El) => {
    touched.add(id);
    scene = scene.map(el => (el.id === id ? bump(el, patch) : el));
  };
  const add = (...els: El[]) => {
    scene = scene.concat(els);
    els.forEach(el => touched.add(el.id));
  };

  const place = (spec: El, width: number, height = 0) => placeOf(scene, find, spec, width, height);
  const grow = new Set<string>(); // sections that things were put into, to be made big enough
  const notices: string[] = []; // things made bigger than asked, so the caller knows
  const frameOf = (spec: El) => {
    if (spec.section === undefined) return null;
    const id = find(spec.section, 'section').id;
    grow.add(id);
    return id;
  };

  for (const [i, spec] of specs.entries()) {
    try {
      if (!spec || typeof spec !== 'object') throw new ToolError('each element must be an object with a `type`');
      const inFrame = frameOf(spec);
      const inSection = (el: El): El => (inFrame ? { ...el, frameId: inFrame } : el);
      let made: El[] = [];
      switch (spec.type) {
        case 'note': {
          const fill = noteColor(spec.color ?? 'yellow');
          const w = size(spec.width, 'width') ?? NOTE_SIZE;
          const asked = size(spec.height, 'height');
          const text = str(spec.text ?? '', 'text');
          const layout = noteLayout(text, w, asked ?? NOTE_SIZE);
          // A note grows to hold its text: text that doesn't fit would spill out over what's below it.
          if (asked !== undefined && layout.height > asked)
            notices.push(
              `a note was made ${Math.round(layout.height)} tall, not ${asked}, to fit its text. Shorten the text or give it more width.`,
            );
          const at = place(spec, w, layout.height);
          const note = make('stickynote', {
            ...at,
            width: w,
            height: layout.height,
            baseHeight: asked ?? NOTE_SIZE,
            backgroundColor: fill,
            created: Date.now(),
          });
          const label = text ? noteLabel(note, text, layout) : null;
          made = label ? [{ ...note, boundElements: [{ id: label.id, type: 'text' }] }, label] : [note];
          break;
        }
        case 'text': {
          const fontSize = num(spec.fontSize, 'fontSize') ?? 20;
          const text = str(spec.text, 'text');
          // Text keeps the lines it was given. A line longer than TEXT_WRAP_WIDTH, or any with a `width`, wraps.
          const asked = size(spec.width, 'width');
          const width = asked ?? (measureText(text, fontSize).width > TEXT_WRAP_WIDTH ? TEXT_WRAP_WIDTH : undefined);
          const box = width ? { width, height: textHeight(text, width, fontSize) } : measureText(text, fontSize);
          const at = place(spec, box.width, box.height);
          made = [
            textElement({
              text,
              ...at,
              fontSize,
              boxWidth: width,
              fixedWidth: width !== undefined,
              stroke:
                spec.stroke !== undefined || spec.color !== undefined ? styleOf(spec, 'text').strokeColor : undefined,
            }),
          ];
          break;
        }
        case 'rectangle':
        case 'ellipse':
        case 'diamond': {
          // A laid out shape keeps its size, however small (a state diagram's start dot is 14 across).
          const measure = laidOut ? num : size;
          const w = measure(spec.width, 'width') ?? 200;
          const asked = measure(spec.height, 'height');
          let h = asked ?? 120;
          // A rectangle grows to hold its label. (An ellipse or diamond has less room inside, and can't just
          // grow taller, so it gets a notice instead.)
          if (spec.text && !laidOut) {
            const fontSize = num(spec.fontSize, 'fontSize') ?? 20;
            const needed = textHeight(str(spec.text, 'text'), labelRoom(spec.type, w), fontSize) + 24;
            if (needed > h) {
              if (spec.type === 'rectangle') {
                if (asked !== undefined)
                  notices.push(`a box was made ${Math.ceil(needed / 10) * 10} tall, not ${asked}, to fit its label.`);
                h = Math.ceil(needed / 10) * 10;
              } else
                notices.push(
                  `the label "${String(spec.text).slice(0, 24)}" may not fit inside its ${spec.type}. Make it bigger or the label shorter.`,
                );
            }
          }
          const at = place(spec, w, h);
          const shape = make(spec.type, { ...at, width: w, height: h, ...styleOf(spec) });
          if (spec.text) {
            const label = labelFor(
              shape,
              str(spec.text, 'text'),
              num(spec.fontSize, 'fontSize') ?? 20,
              spec.stroke !== undefined || spec.color !== undefined ? shape.strokeColor : undefined,
              !laidOut,
            );
            made = [{ ...shape, boundElements: [{ id: label.id, type: 'text' }] }, label];
          } else made = [shape];
          break;
        }
        case 'arrow':
        case 'line': {
          const isArrow = spec.type === 'arrow';
          let from: El | undefined;
          let to: El | undefined;
          let at: { x: number; y: number };
          let points: number[][];
          if (spec.from !== undefined || spec.to !== undefined) {
            if (!isArrow)
              throw new ToolError('only arrows can join elements (from, to). A line takes x, y and dx, dy or points');
            if (spec.from === undefined || spec.to === undefined)
              throw new ToolError('an arrow between elements needs both `from` and `to`');
            from = find(spec.from, 'from');
            to = find(spec.to, 'to');
            if (laidOut && Array.isArray(spec.points)) {
              // The route it was laid out with, such as a curve around another arrow between the same two.
              at = { x: num(spec.x, 'x')!, y: num(spec.y, 'y')! };
              points = [[0, 0], ...spec.points];
            } else {
              const { start, end } = arrowEnds(from, to);
              at = start;
              points = [
                [0, 0],
                [end.x - start.x, end.y - start.y],
              ];
            }
          } else {
            at = place(spec, 0);
            points = Array.isArray(spec.points)
              ? [
                  [0, 0],
                  ...spec.points.map((p: any, n: number) => {
                    if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))
                      throw new ToolError(`points[${n}] must be [x, y]`);
                    return p as number[];
                  }),
                ]
              : [
                  [0, 0],
                  [num(spec.dx, 'dx') ?? 200, num(spec.dy, 'dy') ?? 0],
                ];
          }
          const arrow = make(spec.type, {
            ...at,
            ...pointsBox(points),
            points,
            ...styleOf(spec, 'line'),
            ...(isArrow
              ? {
                  startBinding: from ? { elementId: from.id, focus: 0, gap: 8 } : null,
                  endBinding: to ? { elementId: to.id, focus: 0, gap: 8 } : null,
                  startArrowhead: head(spec.startHead, null, 'startHead'),
                  endArrowhead: head(spec.head, 'arrow', 'head'),
                  elbowed: false,
                }
              : { polygon: false }),
          });
          made = [arrow];
          if (spec.text) {
            const label = placeArrowLabel(
              arrow,
              textElement({ text: str(spec.text, 'text'), x: 0, y: 0, containerId: arrow.id, align: 'center' }),
            );
            made = [{ ...arrow, boundElements: [{ id: label.id, type: 'text' }] }, label];
          }
          for (const end of [from, to])
            if (end)
              replace(end.id, {
                boundElements: [
                  ...(scene.find(e => e.id === end.id)!.boundElements ?? []),
                  { id: arrow.id, type: 'arrow' },
                ],
              });
          break;
        }
        case 'artifact': {
          const path = artifactPath(spec.artifact, ctx);
          const info = ctx.artifact(path);
          if (!info) {
            const here = ctx
              .artifacts?.()
              .slice(0, 20)
              .map(i => i.sourcePath ?? relative(i.path, ctx));
            throw new ToolError(
              `no artifact at ${path}${here?.length ? `. In this prototype: ${here.join(', ')} (the \`artifacts\` tool lists them)` : ''}`,
            );
          }
          const screen = screenOf(info, spec.screen);
          const box = screen ? screenBox(screen) : null;
          const w = num(spec.width, 'width') ?? box?.width ?? ARTIFACT_WIDTH;
          const h = num(spec.height, 'height') ?? box?.height ?? (info.preview ? PREVIEW_HEIGHT : CARD_HEIGHT);
          made = [
            make('embeddable', {
              ...place(spec, w, h),
              width: w,
              height: h,
              link: path,
              strokeColor: 'transparent',
              roundness: null,
              customData: { frame: true, hideLinkIcon: true, ...(screen && { viewport: screen.width }) },
            }),
          ];
          break;
        }
        case 'section':
        case 'frame': {
          const kids = (spec.children ?? []).map((id: unknown, n: number) => find(id, `children[${n}]`));
          const name = str(spec.name ?? spec.title ?? '', 'name');
          let box: { x: number; y: number; width: number; height: number };
          if (kids.length) {
            const b = unionBounds(kids.map(boundsOf))!;
            box = {
              x: b.x - SECTION_PAD,
              y: b.y - SECTION_PAD,
              width: b.width + SECTION_PAD * 2,
              height: b.height + SECTION_PAD * 2,
            };
          } else {
            const w = num(spec.width, 'width') ?? 1200;
            box = { ...place(spec, w), width: w, height: num(spec.height, 'height') ?? 600 };
          }
          const frame = make('frame', { ...box, name });
          made = [frame];
          add(...made);
          for (const kid of kids) {
            replace(kid.id, { frameId: frame.id });
            const label = labelOf(scene, kid);
            if (label) replace(label.id, { frameId: frame.id });
          }
          made = [];
          created.push(frame.id);
          if (spec.ref) refs[spec.ref] = frame.id;
          continue;
        }
        default:
          throw new ToolError(
            `unknown type ${JSON.stringify(spec.type)}. Types: note, text, rectangle, ellipse, diamond, arrow, line, artifact, section`,
          );
      }
      made = made.map(inSection);
      add(...made);
      created.push(made[0].id);
      if (spec.ref !== undefined) {
        if (typeof spec.ref !== 'string' || !spec.ref) throw new ToolError('ref must be a name');
        refs[spec.ref] = made[0].id;
      }
    } catch (error) {
      if (error instanceof ToolError)
        throw new ToolError(`elements[${i}]${spec?.type ? ` (${spec.type})` : ''}: ${error.message}`);
      throw error;
    }
  }
  // Say so if something landed on top of something else, so the caller can move it.
  const top = (el: El) => !['arrow', 'line', 'frame'].includes(el.type) && !(el.type === 'text' && el.containerId);
  const newOnes = created.map(id => scene.find(e => e.id === id)!).filter(top);
  const before = live(input).filter(top);
  const warnings: string[] = [...notices];
  const name = (el: El) => `${el.id} (${kindOf(el)}${el.text ? ` "${String(el.text).slice(0, 24)}"` : ''})`;
  const meet = (a: El, b: El) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  newOnes.forEach((a, i) => {
    for (const b of [...before, ...(laidOut ? [] : newOnes.slice(i + 1))])
      if (a.id !== b.id && meet(boundsOf(a) as El, boundsOf(b) as El)) warnings.push(`${name(a)} overlaps ${name(b)}`);
  });
  // Agents retry commands: a call that repeats existing content is likely a second run, so say so.
  // The same view at another screen is new content, not a repeat.
  const label = (el: El) =>
    el.text || el.link ? `${kindOf(el)}|${el.text ?? ''}|${el.link ?? ''}|${el.customData?.viewport ?? ''}` : null;
  const known = new Set(input.map(el => el.id));
  const existing = new Map(
    live(input)
      .map(el => [label(el), el] as const)
      .filter(([key]) => key),
  );
  const repeats = live(scene).filter(el => !known.has(el.id) && existing.has(label(el)));
  if (repeats.length)
    warnings.push(
      `${repeats.length} new element(s) repeat existing ones, such as ${name(repeats[0])} and ${name(existing.get(label(repeats[0]))!)}. If this call already ran, delete the new copies.`,
    );

  // A section clips what sticks out of it, so one that things were put into grows to hold them (never shrinks).
  for (const id of grow) {
    const frame = scene.find(e => e.id === id)!;
    const inside = live(scene).filter(e => e.frameId === id && !(e.type === 'text' && e.containerId));
    const b = unionBounds(inside.map(boundsOf));
    if (!b) continue;
    const width = Math.max(frame.width, b.x + b.width + SECTION_PAD - frame.x);
    const height = Math.max(frame.height, b.y + b.height + SECTION_PAD - frame.y);
    if (width > frame.width || height > frame.height) replace(id, { width, height });
  }
  return {
    elements: scene,
    result: { ok: true, created, refs, ...(warnings.length ? { warnings } : {}) },
    touched: [...touched],
  };
}

// ---- mermaid ----------------------------------------------------------------------------------

const DIAGRAM_TYPES = ['rectangle', 'ellipse', 'diamond', 'text', 'arrow', 'line'];
const BOUND_TEXT_PADDING = 5; // Excalidraw's, between a container and its label

// Mermaid as ordinary canvas elements. The caller (agent.ts or cli.ts) adds `diagram`: the elements
// Excalidraw's own converter lays out from `source` (mermaid.ts), the same one behind pasting Mermaid onto a
// canvas. They are made with `create`, then given what `create` doesn't take: groups, label alignment,
// arrowheads and angles.
function mermaid(input: El[], args: any, ctx: Ctx): Run {
  const diagram: El[] | undefined = args.diagram;
  if (!Array.isArray(diagram)) throw new ToolError('mermaid needs `source`: the Mermaid text');
  if (!diagram.length) throw new ToolError('this Mermaid has nothing to draw');
  const other = diagram.find(e => !DIAGRAM_TYPES.includes(e.type));
  if (other)
    throw new ToolError(
      other.type === 'image'
        ? "this kind of Mermaid diagram can't be made into shapes. Flowcharts, sequence, class, state and ER diagrams, Gantt charts, timelines and quadrant charts can. A diagram artifact shows any kind."
        : `this Mermaid makes a ${other.type}, which the canvas tools don't make`,
    );
  if (diagram.length > MAX_CREATE)
    throw new ToolError(
      `this Mermaid makes ${diagram.length} elements, and a call makes at most ${MAX_CREATE}. Split it.`,
    );

  const box = (e: El) => boundsOf({ ...e, width: e.width ?? 0, height: e.height ?? 0 });
  const whole = unionBounds(diagram.map(box))!;
  const at = placeOf(
    input,
    finder(() => input),
    args,
    whole.width,
    whole.height,
  );
  const dx = at.x - whole.x;
  const dy = at.y - whole.y;
  const ids = new Set(diagram.map(e => e.id).filter(Boolean));
  const style = (e: El, fill: boolean) => ({
    ...(e.strokeColor ? { stroke: e.strokeColor } : {}),
    ...(fill && e.backgroundColor && e.backgroundColor !== 'transparent' ? { background: e.backgroundColor } : {}),
    ...(e.strokeWidth ? { strokeWidth: e.strokeWidth } : {}),
    ...(e.strokeStyle ? { strokeStyle: e.strokeStyle } : {}),
  });
  const common = (e: El) => ({
    ...(e.id ? { ref: e.id } : {}),
    ...(args.section !== undefined ? { section: args.section } : {}),
  });
  const specOf = (e: El): El => {
    const text = e.label?.text || undefined;
    if (e.type === 'text')
      return {
        type: 'text',
        text: e.text,
        x: e.x + dx,
        y: e.y + dy,
        fontSize: e.fontSize,
        ...style(e, false),
        ...common(e),
      };
    if (e.type === 'arrow' || e.type === 'line') {
      const points: number[][] = e.points ?? [
        [0, 0],
        [e.width ?? 0, e.height ?? 0],
      ];
      const [x0, y0] = points[0];
      const joins =
        e.type === 'arrow' && ids.has(e.start?.id) && ids.has(e.end?.id)
          ? { from: `@${e.start.id}`, to: `@${e.end.id}` }
          : {};
      return {
        type: e.type,
        ...joins,
        x: e.x + x0 + dx,
        y: e.y + y0 + dy,
        points: points.slice(1).map(([x, y]) => [x - x0, y - y0]),
        text,
        ...style(e, false),
        ...common(e),
      };
    }
    return {
      type: e.type,
      x: e.x + dx,
      y: e.y + dy,
      width: e.width,
      height: e.height,
      text,
      fontSize: e.label?.fontSize,
      rounded: e.roundness ? true : undefined,
      ...style(e, true),
      ...common(e),
    };
  };
  // Shapes first, so arrows can join them, in the converter's order (which puts groups behind what is in them).
  const order = [
    ...diagram.filter(e => e.type !== 'arrow' && e.type !== 'line'),
    ...diagram.filter(e => e.type === 'arrow' || e.type === 'line'),
  ];
  const made = create(input, { elements: order.map(specOf) }, ctx, true);
  const { created } = made.result as { created: string[] };

  let scene = made.elements;
  const touched = new Set(made.touched);
  const patch = (id: string, change: El) => {
    touched.add(id);
    scene = scene.map(el => (el.id === id ? bump(el, change) : el));
  };
  const groups = new Map<string, string>();
  const groupOf = (id: string) => groups.get(id) ?? (groups.set(id, newId()), groups.get(id)!);
  order.forEach((e, i) => {
    const el = scene.find(x => x.id === created[i])!;
    const label = labelOf(scene, el);
    const groupIds = (e.groupIds ?? []).map(groupOf);
    const change: El = {};
    if (groupIds.length) change.groupIds = groupIds;
    if (e.angle) change.angle = e.angle;
    if (e.type === 'text' && e.textAlign) change.textAlign = e.textAlign;
    if (e.type === 'arrow') {
      if ('startArrowhead' in e) change.startArrowhead = e.startArrowhead ?? null;
      if ('endArrowhead' in e) change.endArrowhead = e.endArrowhead ?? null;
    }
    if (Object.keys(change).length) patch(el.id, change);
    if (label && e.type !== 'arrow' && e.type !== 'line') {
      const align: El = groupIds.length ? { groupIds } : {};
      if (e.label?.strokeColor) align.strokeColor = color(e.label.strokeColor, 'stroke');
      if (e.label?.verticalAlign === 'top')
        Object.assign(align, { verticalAlign: 'top', y: el.y + BOUND_TEXT_PADDING });
      if (e.label?.textAlign === 'left') Object.assign(align, { textAlign: 'left', x: el.x + BOUND_TEXT_PADDING });
      if (Object.keys(align).length) patch(label.id, align);
    } else if (label && groupIds.length) patch(label.id, { groupIds });
  });
  return { elements: scene, result: made.result, touched: [...touched] };
}

// ---- update, move, delete ---------------------------------------------------------------------

const idsOf = (args: any, field = 'id') => {
  const ids = Array.isArray(args.ids) ? args.ids : args.id !== undefined ? [args.id] : null;
  if (!ids?.length) throw new ToolError(`give the ${field} (or \`ids\`) of what to change. Use describe to see ids`);
  return ids as string[];
};

// Re-routes an arrow joining two elements after either moved, and moves its label.
function reroute(scene: El[], arrowId: string): El[] {
  const arrow = scene.find(e => e.id === arrowId)!;
  const a = arrow.startBinding && scene.find(e => e.id === arrow.startBinding.elementId && !e.isDeleted);
  const b = arrow.endBinding && scene.find(e => e.id === arrow.endBinding.elementId && !e.isDeleted);
  if (!a || !b) return scene;
  const { start, end } = arrowEnds(a, b);
  const moved = bump(arrow, {
    x: start.x,
    y: start.y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
    points: [
      [0, 0],
      [end.x - start.x, end.y - start.y],
    ],
  });
  return scene.map(e => {
    if (e.id === arrow.id) return moved;
    if (e.containerId === arrow.id && e.type === 'text') return bump(e, placeArrowLabel(moved, e));
    return e;
  });
}

const arrowsTouching = (scene: El[], ids: Set<string>) =>
  live(scene)
    .filter(e => e.type === 'arrow' && (ids.has(e.startBinding?.elementId) || ids.has(e.endBinding?.elementId)))
    .map(e => e.id);

const UPDATABLE = [
  'text',
  'fontSize',
  'x',
  'y',
  'width',
  'height',
  'name',
  'artifact',
  'screen',
  'from',
  'to',
  'locked',
  'color',
  'stroke',
  'background',
  'strokeWidth',
  'strokeStyle',
  'opacity',
  'rounded',
];

function update(input: El[], args: any, ctx: Ctx): Run {
  const ids = idsOf(args);
  const touched = new Set<string>();
  let scene = input.slice();
  const find = finder(() => scene);
  const set = (id: string, patch: El) => {
    touched.add(id);
    scene = scene.map(e => (e.id === id ? bump(e, patch) : e));
  };
  const unknown = Object.keys(args).filter(k => !['id', 'ids', ...UPDATABLE].includes(k));
  if (unknown.length)
    throw new ToolError(`update can't change ${unknown.join(', ')}. It can change: ${UPDATABLE.join(', ')}`);
  if (!Object.keys(args).some(k => UPDATABLE.includes(k)))
    throw new ToolError(`update needs something to change: ${UPDATABLE.join(', ')}`);

  for (const id of ids) {
    let el = find(id, 'id');
    const patch: El = {};
    // A note's color is one of four; on anything else, `color` styles the outline and fill.
    if (args.color !== undefined && isNote(el)) patch.backgroundColor = noteColor(args.color);
    else
      Object.assign(
        patch,
        styleOf(args, el.type === 'text' ? 'text' : el.type === 'arrow' || el.type === 'line' ? 'line' : 'shape'),
      );
    for (const key of ['x', 'y', 'width', 'height'] as const)
      if (args[key] !== undefined) patch[key] = num(args[key], key);
    // A note's asked-for height is its least height; it grows from there to fit its text.
    if (isNote(el) && patch.height !== undefined) patch.baseHeight = patch.height;
    if (args.locked !== undefined) patch.locked = Boolean(args.locked);
    if (args.name !== undefined) {
      if (el.type !== 'frame') throw new ToolError(`${id}: name is a section's title`);
      patch.name = str(args.name, 'name');
    }
    if (args.artifact !== undefined) {
      if (!isArtifact(el)) throw new ToolError(`${id}: artifact applies to artifacts on the canvas`);
      const path = artifactPath(args.artifact, ctx);
      if (!ctx.artifact(path)) throw new ToolError(`no artifact at ${path}`);
      patch.link = path;
    }
    if (args.screen !== undefined) {
      const path = isArtifact(el) ? (ctx.linkPath?.(patch.link ?? el.link) ?? patch.link ?? el.link) : null;
      const info = path ? ctx.artifact(path) : null;
      if (!info?.screens) throw new ToolError(`${id}: screen applies to views on the canvas`);
      const screen = screenOf(info, args.screen)!;
      const box = screenBox(screen);
      patch.customData = { ...el.customData, viewport: screen.width };
      if (args.width === undefined) patch.width = box.width; // its height, how much shows, stays
    }
    if ((args.from !== undefined || args.to !== undefined) && el.type !== 'arrow')
      throw new ToolError(`${id}: from and to apply to arrows`);
    if (args.from !== undefined) patch.startBinding = { elementId: find(args.from, 'from').id, focus: 0, gap: 8 };
    if (args.to !== undefined) patch.endBinding = { elementId: find(args.to, 'to').id, focus: 0, gap: 8 };
    if (args.fontSize !== undefined && el.type === 'text') {
      patch.fontSize = num(args.fontSize, 'fontSize');
      Object.assign(patch, measureText(el.text, patch.fontSize));
    }
    set(el.id, patch);
    el = find(el.id, 'id');
    // A label takes its shape's outline color (a note's text stays dark).
    if (patch.strokeColor !== undefined && !isNote(el)) {
      const label = labelOf(scene, el);
      if (label) set(label.id, { strokeColor: patch.strokeColor });
    }

    // Text: a text element's own, or the label of a note, shape or arrow.
    if (
      args.text !== undefined ||
      args.fontSize !== undefined ||
      args.width !== undefined ||
      args.height !== undefined ||
      args.x !== undefined ||
      args.y !== undefined
    ) {
      const value = args.text !== undefined ? str(args.text, 'text') : undefined;
      if (el.type === 'text' && !el.containerId && value !== undefined)
        set(el.id, {
          text: value,
          originalText: value,
          ...(el.autoResize === false
            ? { height: textHeight(value, el.width, el.fontSize) }
            : measureText(value, el.fontSize)),
        });
      else if (el.type !== 'text') {
        const label = labelOf(scene, el);
        if (label || value) {
          const fontSize = num(args.fontSize, 'fontSize') ?? label?.fontSize ?? 20;
          const words = value ?? label!.originalText ?? label!.text;
          let next: El;
          if (el.type === 'arrow')
            next = placeArrowLabel(
              el,
              textElement({ text: words, x: 0, y: 0, fontSize, containerId: el.id, align: 'center' }),
            );
          else if (isNote(el)) {
            // The note fits its text again: a smaller font first, then a taller note.
            const base = num(args.fontSize, 'fontSize') ?? label?.baseFontSize ?? 20;
            const layout = noteLayout(words, el.width, el.baseHeight ?? el.height, base);
            set(el.id, { height: layout.height });
            next = noteLabel(find(el.id, 'id'), words, layout, base);
          } else {
            next = labelFor(el, words, fontSize, label?.strokeColor);
            if (el.type === 'rectangle' && next.height + 24 > el.height) {
              set(el.id, { height: Math.ceil((next.height + 24) / 10) * 10 });
              next = centerLabel({ ...el, height: Math.ceil((next.height + 24) / 10) * 10 }, next);
            }
          }
          if (label)
            set(label.id, {
              text: next.text,
              originalText: next.originalText,
              fontSize: next.fontSize,
              ...(next.baseFontSize ? { baseFontSize: next.baseFontSize } : {}),
              width: next.width,
              height: next.height,
              x: next.x,
              y: next.y,
            });
          else {
            const made: El = { ...next, ...(el.frameId ? { frameId: el.frameId } : {}) };
            scene = scene
              .concat(made)
              .map(e =>
                e.id === el.id
                  ? bump(e, { boundElements: [...(e.boundElements ?? []), { id: made.id, type: 'text' }] })
                  : e,
              );
            touched.add(made.id);
            touched.add(el.id);
          }
        }
      }
    }
    // An arrow joined to something that changed follows it.
    for (const arrowId of new Set([
      ...arrowsTouching(scene, new Set([el.id])),
      ...(el.type === 'arrow' && (args.from !== undefined || args.to !== undefined) ? [el.id] : []),
    ])) {
      scene = reroute(scene, arrowId);
      touched.add(arrowId);
    }
  }
  return { elements: scene, result: { ok: true, updated: ids }, touched: [...touched] };
}

function move(input: El[], args: any): Run {
  const ids = idsOf(args);
  if (['dx', 'dy', 'x', 'y'].every(k => args[k] === undefined)) throw new ToolError('move needs dx and dy, or x and y');
  if ((args.x !== undefined || args.y !== undefined) && ids.length > 1)
    throw new ToolError('x and y place one element; use dx and dy to move several');
  const find = finder(() => input);
  let scene = input.slice();
  const moving = new Set<string>();
  for (const id of ids) {
    const el = find(id, 'id');
    const dx = num(args.dx, 'dx') ?? (num(args.x, 'x') ?? el.x) - el.x;
    const dy = num(args.dy, 'dy') ?? (num(args.y, 'y') ?? el.y) - el.y;
    const group = new Set([el.id]);
    // A section takes what is in it; a shape takes its label.
    if (el.type === 'frame')
      live(scene)
        .filter(e => e.frameId === el.id)
        .forEach(e => group.add(e.id));
    live(scene)
      .filter(e => e.type === 'text' && e.containerId && group.has(e.containerId))
      .forEach(e => group.add(e.id));
    scene = scene.map(e => (group.has(e.id) ? bump(e, { x: e.x + dx, y: e.y + dy }) : e));
    group.forEach(g => moving.add(g));
  }
  // Arrows joined to what moved follow it (arrows that moved with it already did).
  const touched = new Set(moving);
  for (const arrowId of arrowsTouching(scene, moving)) {
    if (moving.has(arrowId)) continue;
    scene = reroute(scene, arrowId);
    touched.add(arrowId);
  }
  return { elements: scene, result: { ok: true, moved: ids }, touched: [...touched] };
}

function remove(input: El[], args: any): Run {
  const ids = idsOf(args);
  const find = finder(() => input);
  const gone = new Set<string>();
  for (const id of ids) {
    const el = find(id, 'id');
    gone.add(el.id);
    live(input)
      .filter(e => e.containerId === el.id)
      .forEach(e => gone.add(e.id));
    if (el.type === 'frame' && args.withContents)
      live(input)
        .filter(e => e.frameId === el.id)
        .forEach(e => gone.add(e.id));
  }
  // An arrow attached to something deleted goes with it, and so does its label.
  for (const e of live(input))
    if (e.type === 'arrow' && (gone.has(e.startBinding?.elementId) || gone.has(e.endBinding?.elementId)))
      gone.add(e.id);
  for (const e of live(input)) if (e.containerId && gone.has(e.containerId)) gone.add(e.id);
  const frames = new Set(ids.filter(id => input.find(e => e.id === id)?.type === 'frame'));
  const touched: string[] = [];
  const scene = input.map(e => {
    if (gone.has(e.id)) {
      touched.push(e.id);
      return bump(e, { isDeleted: true });
    }
    const patch: El = {};
    if (e.frameId && frames.has(e.frameId) && !args.withContents) patch.frameId = null;
    // Nothing keeps a reference to what was deleted.
    if ((e.boundElements ?? []).some((b: El) => gone.has(b.id)))
      patch.boundElements = e.boundElements.filter((b: El) => !gone.has(b.id));
    if (e.startBinding && gone.has(e.startBinding.elementId)) patch.startBinding = null;
    if (e.endBinding && gone.has(e.endBinding.elementId)) patch.endBinding = null;
    if (Object.keys(patch).length) {
      touched.push(e.id);
      return bump(e, patch);
    }
    return e;
  });
  return { elements: scene, result: { ok: true, deleted: [...gone] }, touched };
}

// ---- describe ---------------------------------------------------------------------------------

const round = (n: number) => Math.round(n);

function describe(scene: El[], args: any, ctx: Ctx) {
  const elements = live(scene);
  const byId = new Map(elements.map(e => [e.id, e]));
  const only = Array.isArray(args.ids) ? new Set<string>(args.ids) : null;
  const artifacts = [];
  for (const el of elements) {
    if (el.type === 'text' && el.containerId) continue; // a label is part of what it labels
    if (only && !only.has(el.id) && !(el.frameId && only.has(el.frameId))) continue;
    const b = boundsOf(el);
    const label = labelOf(elements, el);
    const out: El = {
      id: el.id,
      kind: kindOf(el),
      x: round(b.x),
      y: round(b.y),
      width: round(b.width),
      height: round(b.height),
    };
    if (el.type !== 'text' && el.type !== 'frame' && el.type !== 'embeddable') out.shape = el.type;
    const words =
      el.type === 'text' ? (el.originalText ?? el.text) : label ? (label.originalText ?? label.text) : undefined;
    if (words !== undefined) out.text = words;
    if (isNote(el)) out.color = noteColorName(el);
    else if (el.type !== 'embeddable' && el.type !== 'frame') {
      if (el.strokeColor && el.strokeColor !== '#1e1e1e') out.stroke = el.strokeColor;
      if (el.backgroundColor && el.backgroundColor !== 'transparent') out.background = el.backgroundColor;
    }
    if (el.type === 'text' && el.fontSize) out.fontSize = el.fontSize;
    if (el.type !== 'text' && el.type !== 'embeddable' && el.type !== 'frame' && !isNote(el)) {
      if (el.strokeStyle && el.strokeStyle !== 'solid') out.strokeStyle = el.strokeStyle;
      if (el.strokeWidth && el.strokeWidth !== 2) out.strokeWidth = el.strokeWidth;
      if (el.roundness) out.rounded = true;
    }
    if (el.opacity !== undefined && el.opacity < 100) out.opacity = el.opacity;
    if (el.type === 'frame') out.name = el.name ?? '';
    if (el.type === 'arrow') {
      out.from = el.startBinding?.elementId ?? null;
      out.to = el.endBinding?.elementId ?? null;
    }
    if (isArtifact(el)) {
      const path = ctx.linkPath?.(el.link) ?? el.link;
      const info = path ? ctx.artifact(path) : null;
      out.link = path;
      out.artifact = info ? { title: info.title, type: info.typeLabel } : null;
      if (info?.screens) {
        const viewport = el.customData?.viewport;
        out.screen = info.screens.find(s => s.width === viewport)?.name ?? viewport ?? null;
      }
    } else if (el.type === 'embeddable') out.link = el.link;
    if (el.frameId && byId.get(el.frameId)) out.section = el.frameId;
    if (el.locked) out.locked = true;
    artifacts.push(out);
  }
  const boxes = elements.filter(e => !(e.type === 'text' && e.containerId)).map(boundsOf);
  const all = unionBounds(boxes);
  return {
    elements: artifacts,
    sections: elements.filter(e => e.type === 'frame').map(f => ({ id: f.id, name: f.name ?? '' })),
    bounds: all && { x: round(all.x), y: round(all.y), width: round(all.width), height: round(all.height) },
  };
}

function kindOf(el: El) {
  switch (el.type) {
    case 'frame':
      return 'section';
    case 'embeddable':
      return isArtifact(el) ? 'artifact' : 'embed';
    case 'stickynote':
      return 'note';
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
      return 'shape';
    case 'freedraw':
      return 'drawing';
    default:
      return el.type;
  }
}

// Kept for the app's live API, which lays out text itself.
export { centerLabel, wrapText };
