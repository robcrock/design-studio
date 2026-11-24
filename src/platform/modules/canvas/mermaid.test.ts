// Tests for the `mermaid` tool: Mermaid laid out by Excalidraw's converter (mermaid.ts), made into canvas
// elements (tools.ts), the way `pnpm canvas` runs it. Run: pnpm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DOMParser, parseHTML } from 'linkedom';
import { layoutMermaid } from './mermaid.ts';
import { run, ToolError, type Ctx, type El } from './tools.ts';

// The converter reads SVG with a browser's DOM, as in cli.ts.
Object.assign(globalThis, { DOMParser, document: parseHTML('<html><body></body></html>').document });

const ctx: Ctx = { base: '/pat/demo', artifact: () => null };
const mermaid = async (scene: El[], source: string, args: object = {}) =>
  run(scene, 'mermaid', { ...args, diagram: await layoutMermaid(source) }, ctx);
const byId = (scene: El[], id: string) => scene.find(el => el.id === id)!;
const labelOf = (scene: El[], id: string) => scene.find(el => el.containerId === id)!;

test('mermaid makes a flowchart into joined shapes an agent can move', async () => {
  const start = run([], 'create', { type: 'rectangle', text: 'Before', x: 0, y: 0 }, ctx).elements;
  const made = await mermaid(
    start,
    'flowchart LR\n  subgraph G[Checkout]\n  cart[Cart] --> pay{Paid?}\n  end\n  pay -->|yes| done([Done])',
  );
  const { refs, warnings } = made.result as { refs: Record<string, string>; warnings?: string[] };
  const scene = made.elements;
  assert.equal(warnings, undefined, 'its own parts may overlap (a group around its nodes) without warnings');
  assert.equal(byId(scene, refs.pay).type, 'diamond');
  assert.equal(labelOf(scene, refs.pay).text, 'Paid?', 'labels keep the lines they were laid out with');
  assert.notEqual(labelOf(scene, refs.G__title).strokeColor, 'transparent', "a group's title shows");
  assert.ok(byId(scene, refs.G).y > 120, 'with no placement, it goes below everything');
  const arrow = byId(scene, refs.cart_pay);
  assert.equal(arrow.startBinding.elementId, refs.cart);
  assert.equal(arrow.endBinding.elementId, refs.pay);

  const moved = run(scene, 'move', { id: refs.done, dy: 100 }, ctx).elements;
  const after = byId(moved, refs.pay_done);
  assert.ok(after.y + after.points.at(-1)[1] > byId(scene, refs.pay_done).y + 50, 'the arrow follows the node');
});

test('mermaid keeps what the layout needs: small shapes, top labels, groups and arrowheads', async () => {
  const state = (await mermaid([], 'stateDiagram-v2\n  [*] --> Idle')).elements;
  assert.ok(
    state.some(el => el.type === 'ellipse' && el.width < 20),
    "a state diagram's start dot keeps its size",
  );

  const cls = await mermaid([], 'classDiagram\n  Animal <|-- Duck\n  Animal : +int age');
  const { refs } = cls.result as { refs: Record<string, string> };
  const box = byId(cls.elements, refs.Animal);
  const name = labelOf(cls.elements, refs.Animal);
  assert.equal(name.verticalAlign, 'top', "a class's name sits at the top of its box");
  const member = cls.elements.find(el => el.text === '+int age')!;
  assert.ok(box.groupIds.length && member.groupIds[0] === box.groupIds[0], 'a class and its members move as one');
  assert.equal(
    cls.elements.find(el => el.type === 'arrow')!.startArrowhead,
    'triangle_outline',
    'inheritance keeps its hollow arrowhead',
  );
});

test('mermaid says what it cannot draw', async () => {
  await assert.rejects(
    mermaid([], 'pie\n  "a" : 1'),
    (e: Error) => e instanceof ToolError && /diagram artifact/.test(e.message),
  );
  await assert.rejects(
    layoutMermaid('flowchart LR\n  A -->'),
    (e: Error) => e instanceof ToolError && /doesn't parse/.test(e.message),
  );
  await assert.rejects(layoutMermaid(''), ToolError);
  assert.throws(() => run([], 'mermaid', { source: 'flowchart LR\n A --> B' }, ctx), ToolError);
});
