import { canvasIdentity } from './identity.ts';
// Tests for the canvas tools (tools.ts) and the stored form (slim.ts). Run: pnpm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stringifyScene } from './slim.ts';
import { resourceId } from '../../core/fileTypes.ts';
import { lineWidth, wrapText } from './elements.ts';
import { run, ToolError, type Ctx, type El } from './tools.ts';

const artifacts: Record<
  string,
  { title: string; type: string; typeLabel: string; preview: boolean; screens?: { name: string; width: number }[] }
> = {
  '/pat/demo/main': {
    title: 'Main',
    type: 'view',
    typeLabel: 'View',
    preview: true,
    screens: [
      { name: 'Desktop', width: 1440 },
      { name: 'Phone', width: 390 },
    ],
  },
  '/pat/demo/notes': { title: 'Notes', type: 'document', typeLabel: 'Document', preview: false },
};
const ctx: Ctx = {
  base: '/pat/demo',
  artifact: path => (artifacts[path] ? { path, ...artifacts[path] } : null),
  artifacts: () => Object.entries(artifacts).map(([path, v]) => ({ path, ...v })),
};

test('canvas saves retain resource identity independently of element identities and filesystem links', () => {
  const id = resourceId('0123456789abcdef');
  const elements = [
    { id: 'frame-id', type: 'frame', x: 20, y: 30 },
    { id: 'embed-id', type: 'embeddable', link: '/pat/demo/main' },
  ];
  const written = stringifyScene(elements, { gridSize: 20 }, link => link, id);
  assert.equal(canvasIdentity.read(written), id);
  assert.deepEqual(
    JSON.parse(written).elements.map((el: { id: string }) => el.id),
    ['frame-id', 'embed-id'],
  );
  assert.equal(
    stringifyScene(JSON.parse(written).elements, { gridSize: 20 }, undefined, canvasIdentity.read(written)),
    written,
  );
  assert.equal(
    canvasIdentity.read(stringifyScene(elements)),
    null,
    'unmigrated files do not get random identity during saves',
  );
  assert.throws(() => stringifyScene(elements, {}, undefined, 'bad' as never));
});

// Runs tools in turn on one scene, as a caller would.
function session() {
  let scene: El[] = [];
  return {
    get scene() {
      return scene;
    },
    call(tool: string, args: unknown) {
      const out = run(scene, tool, args, ctx);
      scene = out.elements;
      return out.result as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    },
    live: () => scene.filter(el => !el.isDeleted),
  };
}

test('create places things, resolves @refs, and describe reads them back', () => {
  const s = session();
  const { created, refs } = s.call('create', {
    elements: [
      { type: 'artifact', artifact: 'main', ref: 'main' },
      { type: 'artifact', artifact: 'notes.md', rightOf: '@main' },
      { type: 'note', text: 'Check the empty state', below: '@main', color: 'pink' },
      { type: 'rectangle', text: 'Payment', color: 'blue', x: 0, y: 900, ref: 'pay' },
    ],
  });
  assert.equal(created.length, 4);
  assert.ok(refs.main && refs.pay);
  const d = s.call('describe', {});
  const kinds = d.elements.map((e: El) => e.kind);
  assert.deepEqual(
    kinds,
    ['artifact', 'artifact', 'note', 'shape'],
    'a shape colored blue is not mistaken for a blue note',
  );
  const [view, card, note] = d.elements;
  assert.equal(view.artifact.title, 'Main');
  assert.equal(view.height, 338, 'a view is a screen');
  assert.equal(card.height, 88, 'a document is a card');
  assert.equal(card.x, view.x + view.width + 80);
  assert.equal(note.color, 'pink');
  assert.equal(note.y, view.y + view.height + 24);
});

test('errors say what to do', () => {
  const s = session();
  assert.throws(
    () => s.call('create', { type: 'artifact', artifact: 'nope' }),
    (e: Error) => e instanceof ToolError && /no artifact at \/pat\/demo\/nope.*main/.test(e.message),
  );
  assert.throws(() => s.call('create', { type: 'rectangle', color: 'chartreuse' }), /isn't a color.*blue/);
  assert.throws(() => s.call('create', { type: 'blob' }), /unknown type.*note/);
  assert.throws(() => s.call('update', { id: 'nope', text: 'x' }), /no element nope/);
  assert.throws(() => s.call('nope', {}), /no tool "nope"/);
});

test('arrows stay attached: bound on both ends, and they follow a move', () => {
  const s = session();
  const { refs } = s.call('create', {
    elements: [
      { type: 'rectangle', text: 'A', x: 0, y: 0, ref: 'a' },
      { type: 'rectangle', text: 'B', x: 400, y: 0, ref: 'b' },
      { type: 'arrow', from: '@a', to: '@b', text: 'then' },
    ],
  });
  const arrow = s.live().find(e => e.type === 'arrow')!;
  assert.equal(arrow.startBinding.elementId, refs.a);
  assert.equal(arrow.endBinding.elementId, refs.b);
  assert.ok(
    s
      .live()
      .find(e => e.id === refs.a)!
      .boundElements.some((b: El) => b.id === arrow.id),
    'the shape lists the arrow',
  );
  s.call('move', { id: refs.b, dx: 0, dy: 300 });
  const after = s.live().find(e => e.id === arrow.id)!;
  assert.ok(after.points[1][1] > 0, 'the arrow now points down as well as across');
  assert.ok(after.version > arrow.version, 'a changed element has a newer version, so an open canvas takes it');
});

test('update changes text and colors, and a label follows its shape', () => {
  const s = session();
  const { refs } = s.call('create', { type: 'rectangle', text: 'Payment', color: 'blue', ref: 'p' });
  s.call('update', { id: refs.p, text: 'Payment (card)', color: 'violet', width: 300 });
  const shape = s.live().find(e => e.id === refs.p)!;
  const label = s.live().find(e => e.containerId === refs.p)!;
  assert.equal(label.originalText, 'Payment (card)');
  assert.equal(label.strokeColor, shape.strokeColor, 'the label takes the outline color');
  assert.equal(shape.width, 300);
  assert.ok(Math.abs(label.x + label.width / 2 - (shape.x + 150)) < 1, 'and stays centered');
  assert.throws(() => s.call('update', { id: refs.p, bogus: 1 }), /can't change bogus/);
});

test('delete takes labels and attached arrows with it, and cleans up references', () => {
  const s = session();
  const { refs } = s.call('create', {
    elements: [
      { type: 'rectangle', text: 'A', x: 0, y: 0, ref: 'a' },
      { type: 'rectangle', text: 'B', x: 400, y: 0, ref: 'b' },
      { type: 'arrow', from: '@a', to: '@b', text: 'then' },
    ],
  });
  s.call('delete', { id: refs.a });
  assert.deepEqual(
    s
      .live()
      .map(e => e.type)
      .sort(),
    ['rectangle', 'text'],
    'only B and its label are left',
  );
  assert.deepEqual(
    s
      .live()
      .find(e => e.id === refs.b)!
      .boundElements.filter((b: El) => b.type === 'arrow'),
    [],
  );
});

test('sections wrap their children, carry them when moved, and grow to hold what is put in them', () => {
  const s = session();
  const { refs } = s.call('create', {
    elements: [
      { type: 'note', text: 'one', x: 0, y: 0, ref: 'n1' },
      { type: 'note', text: 'two', x: 300, y: 0, ref: 'n2' },
      { type: 'section', name: 'Pair', children: ['@n1', '@n2'], ref: 's' },
    ],
  });
  const frame = s.live().find(e => e.id === refs.s)!;
  assert.ok(frame.width >= 500 + 120 && frame.height >= 200 + 120, 'the frame wraps its children with padding');
  s.call('move', { id: refs.s, dy: 1000 });
  assert.equal(s.live().find(e => e.id === refs.n1)!.y, 1000, 'children move with the section');
  const small = s.call('create', {
    elements: [
      { type: 'section', name: 'Small', width: 300, height: 100, x: 0, y: 2000, ref: 'small' },
      { type: 'artifact', artifact: 'main', section: '@small' },
    ],
  });
  const grown = s.live().find(e => e.id === small.refs.small)!;
  assert.ok(grown.height >= 338 + 120, 'a section grows so nothing is clipped');
  assert.equal(s.live().filter(e => e.frameId === grown.id).length, 1);
});

test('the stored form is small and stable', () => {
  const s = session();
  s.call('create', {
    elements: [
      { type: 'artifact', artifact: 'main', x: 0.123456, y: 0 },
      { type: 'note', text: 'hi', x: 10, y: 10 },
    ],
  });
  const text = stringifyScene(s.scene, { viewBackgroundColor: '#ffffff' });
  const file = JSON.parse(text);
  assert.equal(file.studioVersion, 1);
  assert.deepEqual(file.files, {});
  assert.equal(file.elements[0].link, '/pat/demo/main', 'links are app paths');
  assert.equal(file.elements[0].x, 0.12, 'numbers are rounded');
  assert.ok(!('isDeleted' in file.elements[0]) && !('angle' in file.elements[0]), 'defaults are left out');
  assert.equal(stringifyScene(s.scene), stringifyScene(JSON.parse(text).elements), 'saving twice writes the same file');
});

test('rightOf centers by default so arrows between different heights run straight; align sets it', () => {
  const s = session();
  const { refs } = s.call('create', {
    elements: [
      { type: 'artifact', artifact: 'main', x: 0, y: 0, ref: 'view' },
      { type: 'artifact', artifact: 'notes', rightOf: '@view', ref: 'card' },
      { type: 'artifact', artifact: 'notes', rightOf: '@view', align: 'start', y: undefined, ref: 'top' },
      { type: 'note', text: 'under', below: '@card', align: 'center', ref: 'under' },
      { type: 'arrow', from: '@view', to: '@card' },
    ],
  });
  const at = (ref: string) => s.live().find(e => e.id === refs[ref])!;
  assert.equal(at('card').y, (338 - 88) / 2, 'centered on the view');
  assert.equal(at('top').y, 0, 'align: start lines up the tops');
  assert.equal(at('under').x, at('card').x + (480 - 250) / 2, 'a note centered under a card');
  const arrow = s.live().find(e => e.type === 'arrow')!;
  assert.equal(arrow.points[1][1], 0, 'the arrow is straight');
  assert.throws(() => s.call('create', { type: 'note', text: 'x', below: '@card', align: 'left' }), /align must be/);
});

test('create warns when something lands on something else', () => {
  const s = session();
  const first = s.call('create', { type: 'note', text: 'a', x: 0, y: 0 });
  assert.equal(first.warnings, undefined);
  const second = s.call('create', {
    elements: [
      { type: 'note', text: 'b', x: 50, y: 50 },
      { type: 'note', text: 'c', x: 900, y: 0 },
    ],
  });
  assert.equal(second.warnings.length, 1);
  assert.match(second.warnings[0], /overlaps/);
});

test('create warns when a call repeats existing content, as a retried command would', () => {
  const s = session();
  const call = {
    elements: [
      { type: 'note', text: 'Same idea' },
      { type: 'text', text: 'Heading' },
    ],
  };
  assert.equal(s.call('create', call).warnings, undefined);
  const again = s.call('create', call);
  assert.ok(again.warnings.some((w: string) => /repeat existing ones.*delete the new copies/.test(w)));
});

test('artifacts lists what can go on the canvas, and a wrong name points at it', () => {
  const s = session();
  const { artifacts } = s.call('artifacts', {});
  assert.deepEqual(
    artifacts.map((i: El) => i.artifact),
    ['main', 'notes'],
  );
  assert.equal(artifacts[0].shownAs, 'live preview');
  assert.equal(artifacts[1].shownAs, 'card');
  assert.throws(() => s.call('create', { type: 'artifact', artifact: 'nope' }), /`artifacts` tool/);
});

test('describe reports how a shape is drawn', () => {
  const s = session();
  s.call('create', {
    type: 'rectangle',
    text: 'Not built',
    strokeStyle: 'dashed',
    rounded: true,
    opacity: 60,
    color: 'gray',
  });
  const [shape] = s.call('describe', {}).elements;
  assert.equal(shape.strokeStyle, 'dashed');
  assert.equal(shape.rounded, true);
  assert.equal(shape.opacity, 60);
});

test('a canvas shows only artifacts from its own prototype', () => {
  const s = session();
  assert.throws(
    () => s.call('create', { elements: [{ type: 'artifact', artifact: '/pat/other/main' }] }),
    /another prototype.*\/pat\/demo/,
  );
  s.call('create', { elements: [{ type: 'artifact', artifact: '/pat/demo/main', ref: 'inside' }] });
  assert.equal(s.live().length, 1, 'the whole app path of its own prototype works');
});

test('moving an artifact to another prototype is refused, and artifacts lists only this prototype', () => {
  const s = session();
  const { refs } = s.call('create', { elements: [{ type: 'artifact', artifact: 'main', ref: 'main' }] });
  assert.throws(() => s.call('update', { id: refs.main, artifact: '/pat/other/main' }), /another prototype/);
  assert.deepEqual(
    s.call('artifacts', {}).artifacts.map((i: { artifact: string }) => i.artifact),
    ['main', 'notes'],
  );
});

const LONG =
  'A long note. This one has a lot more to say, because the agent was asked to explain a whole flow in a single sticky note, with reasons, edge cases, and a question at the end that nobody has answered yet. Does it fit?';

test("a note is Excalidraw's sticky note: square when its text fits, a smaller font and then taller when not", () => {
  const s = session();
  s.call('create', {
    elements: [
      { type: 'note', text: 'Short' },
      { type: 'note', text: LONG },
      { type: 'note', text: `${LONG} ${LONG} ${LONG}` },
    ],
  });
  const [short, long, longer] = s.live().filter(el => el.type === 'stickynote');
  const labelOf = (note: El) => s.live().find(el => el.type === 'text' && el.containerId === note.id)!;
  assert.equal(short.height, 250);
  assert.equal(short.baseHeight, 250);
  assert.equal(labelOf(short).fontSize, 20);
  assert.equal(long.height, 250, 'a longer text first shrinks its font');
  assert.ok(labelOf(long).fontSize < 20, `smaller font (${labelOf(long).fontSize})`);
  assert.equal(labelOf(long).baseFontSize, 20, 'the font it shrinks from is kept');
  assert.ok(longer.height > 250, `a much longer one is taller (${longer.height})`);
  assert.equal(longer.baseHeight, 250);
  const label = labelOf(longer);
  assert.ok(label.y + label.height <= longer.y + longer.height, 'the text ends inside the note');
});

test('a note says so when it had to be taller than the height asked for', () => {
  const s = session();
  const out = s.call('create', { elements: [{ type: 'note', text: LONG, height: 120 }] });
  assert.match(out.warnings.join(' '), /made \d+ tall, not 120/);
  assert.ok(s.live().find(el => el.type === 'stickynote')!.height > 120);
});

test('wrapped text never runs wider than the box it wraps to', () => {
  for (const width of [120, 180, 300]) {
    for (const line of wrapText(
      `${LONG} Supercalifragilisticexpialidocious_and_more_words_without_spaces`,
      width,
      20,
    ).split('\n')) {
      assert.ok(lineWidth(line, 20) <= width, `"${line}" fits ${width}`);
    }
  }
});

test('free text wraps when a line is long, or when it is given a width', () => {
  const s = session();
  s.call('create', {
    elements: [
      { type: 'text', text: LONG },
      { type: 'text', text: 'A paragraph that should wrap at three hundred wide and no wider than that.', width: 300 },
      { type: 'text', text: 'Short one' },
    ],
  });
  const [long, narrow, short] = s.live();
  assert.ok(
    long.text.includes('\n') && long.width <= 560 && long.originalText === LONG,
    'a long line wraps at 560 and keeps the original',
  );
  assert.equal(narrow.width, 300);
  assert.ok(narrow.text.split('\n').every((l: string) => lineWidth(l, 20) <= 300));
  assert.ok(!short.text.includes('\n') && short.autoResize !== false, 'short text stays one line and sizes to itself');
});

test('a box grows to hold its label, and the label stays centered in it', () => {
  const s = session();
  const out = s.call('create', {
    elements: [
      {
        type: 'rectangle',
        text: 'A labelled box with a long label that needs to wrap inside the shape and make the box taller',
        width: 240,
        height: 80,
      },
    ],
  });
  const box = s.live().find(el => el.type === 'rectangle')!;
  const label = s.live().find(el => el.type === 'text')!;
  assert.ok(box.height > 80 && label.y >= box.y && label.y + label.height <= box.y + box.height);
  assert.match(out.warnings.join(' '), /made \d+ tall, not 80/);
});

test("changing a note's text makes it taller when it needs to be", () => {
  const s = session();
  const { refs } = s.call('create', { elements: [{ type: 'note', text: 'Short', ref: 'n' }] });
  s.call('update', { id: refs.n, text: LONG });
  assert.ok(s.live().find(el => el.id === refs.n)!.height > 200);
});

test('a size that is not sensible is refused', () => {
  const s = session();
  assert.throws(() => s.call('create', { elements: [{ type: 'note', text: 'x', width: 5 }] }), /between 20 and 4000/);
  assert.throws(
    () => s.call('create', { elements: [{ type: 'text', text: 'x', width: 99999 }] }),
    /between 20 and 4000/,
  );
});

test('relative canvas authoring paths resolve to permanent links and remain scoped to their prototype', () => {
  const base = '/prototypes/0123456789abcdef';
  const view = {
    path: `${base}/artifacts/abcdefghjkmnpqrs`,
    sourcePath: 'app/main.tsx',
    title: 'Main',
    type: 'view',
    typeLabel: 'View',
    preview: true,
  };
  const notes = {
    path: `${base}/artifacts/23456789abcdefgh`,
    sourcePath: 'notes.md',
    title: 'Notes',
    type: 'document',
    typeLabel: 'Document',
    preview: false,
  };
  const identified: Ctx = {
    base,
    artifacts: () => [view, notes],
    artifact: path => [view, notes].find(item => item.path === path) ?? null,
  };
  const created = run(
    [],
    'create',
    {
      elements: [
        { type: 'artifact', artifact: './app/main.tsx' },
        { type: 'artifact', artifact: 'notes' },
      ],
    },
    identified,
  );
  assert.deepEqual(
    created.elements.filter(element => element.type === 'embeddable').map(element => element.link),
    [view.path, notes.path],
  );
  const list = run([], 'artifacts', {}, identified).result as { artifacts: { artifact: string }[] };
  assert.deepEqual(
    list.artifacts.map(item => item.artifact),
    ['app/main.tsx', 'notes.md'],
  );
  const embed = created.elements.find(element => element.type === 'embeddable')!;
  const updated = run(created.elements, 'update', { id: embed.id, artifact: 'notes.md' }, identified);
  assert.equal(updated.elements.find(element => element.id === embed.id)!.link, notes.path);
  assert.throws(
    () =>
      run(
        [],
        'create',
        { type: 'artifact', artifact: '/prototypes/3456789abcdefghj/artifacts/abcdefghjkmnpqrs' },
        identified,
      ),
    /another prototype/,
  );
  assert.throws(
    () => run([], 'create', { type: 'artifact', artifact: '../other/main.tsx' }, identified),
    /no artifact at/,
  );
});

test('a view is shown at one of its screens: the first by default, another by name or width', () => {
  const s = session();
  const created = s.call('create', {
    elements: [
      { type: 'artifact', artifact: 'main', x: 0, y: 0, ref: 'desktop' },
      { type: 'artifact', artifact: 'main', screen: 'phone', rightOf: '@desktop', ref: 'phone' },
      { type: 'artifact', artifact: 'main', screen: 1024, rightOf: '@phone', ref: 'laptop' },
    ],
  });
  const { refs } = created;
  assert.ok(!created.warnings?.some((w: string) => /repeat/.test(w)), 'one view at several screens is not a repeat');
  const at = (ref: string) => s.live().find(e => e.id === refs[ref])!;
  assert.equal(
    s
      .call('create', { type: 'artifact', artifact: 'main', screen: 'Phone' })
      .warnings?.some((w: string) => /repeat/.test(w)),
    true,
    'the same view at the same screen is a repeat',
  );
  assert.equal(at('desktop').customData.viewport, 1440, 'the default screen is written, never assumed');
  assert.deepEqual([at('desktop').width, at('desktop').height], [480, 338]);
  assert.equal(at('phone').customData.viewport, 390);
  assert.deepEqual([at('phone').width, at('phone').height], [130, 338], 'one scale for every screen');
  assert.equal(at('laptop').customData.viewport, 1024);
  s.call('update', { id: refs.desktop, screen: 'Phone', height: 319 });
  assert.equal(at('desktop').customData.viewport, 390);
  assert.equal(at('desktop').customData.frame, true, 'its other custom data stays');
  assert.deepEqual([at('desktop').width, at('desktop').height], [130, 319]);
  const described = s.call('describe', {}).elements.filter((e: { screen?: unknown }) => 'screen' in e);
  assert.deepEqual(
    described.map((e: { screen: unknown }) => e.screen),
    ['Phone', 'Phone', 1024, 'Phone'],
  );
  assert.throws(() => s.call('create', { type: 'artifact', artifact: 'main', screen: 'Watch' }), /screen should be/);
  assert.throws(() => s.call('create', { type: 'artifact', artifact: 'notes', screen: 'Phone' }), /applies to views/);
  assert.throws(() => s.call('update', { id: refs.desktop, screen: 50 }), /screen should be/);
});

test('the canvas check asks every view to say which screen it is shown at', async () => {
  const { default: canvasType } = await import('./type.ts');
  const prototype = {
    contributor: 'pat',
    id: 'demo',
    studioId: '3456789abcdefghj',
    artifacts: [
      { studioId: 'abcdefghjkmnpqrs', systemUsage: 'assigned' as const },
      { studioId: 'bcdefghjkmnpqrst', systemUsage: 'independent' as const },
    ],
  };
  const source = (viewport?: number) =>
    JSON.stringify({
      type: 'excalidraw',
      elements: [
        {
          type: 'embeddable',
          link: '/prototypes/3456789abcdefghj/artifacts/abcdefghjkmnpqrs',
          customData: { viewport },
        },
        { type: 'embeddable', link: '/prototypes/3456789abcdefghj/artifacts/bcdefghjkmnpqrst' },
      ],
      files: {},
    });
  assert.match(canvasType.check!({ source: source(), frontmatter: null, prototype }).join(' '), /1 view doesn't say/);
  assert.match(
    canvasType.check!({ source: source(100), frontmatter: null, prototype }).join(' '),
    /1 view doesn't say/,
  );
  assert.deepEqual(canvasType.check!({ source: source(390), frontmatter: null, prototype }), []);
});
