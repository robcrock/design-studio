import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDials, applyDials, hasDials, removeDials } from './node/source.ts';

const view = `/** @studio-id 0123456789abcdef */
import { useDialKit } from '@module/dialkit';
import Card from './_components/Card';

const motion = {
  enter: { type: 'spring', visualDuration: 0.3, bounce: 0.2 },
} satisfies Record<string, unknown>;

export default function Overview() {
  // Spacing the designer is tuning.
  const layout = useDialKit('Layout', {
    gap: [16, 0, 48, 1], // between cards
    padding: 32,
    dense: false,
    accent: '#3b82f6',
    tone: { type: 'select', options: ['calm', 'loud'], default: 'calm' },
    title: { type: 'text' },
    reset: { type: 'action' },
    card: { radius: [8, 0, 24], _collapsed: true },
    origin: { type: 'pad', x: [0, -1, 1, 0.01] },
  });
  const anim = useDialKit('Motion', motion);
  return <Card style={{ gap: layout.gap }} transition={anim.enter} />;
}
`;

test('Apply writes live values as defaults and keeps formatting and comments', () => {
  const { source, applied } = applyDials(view, [
    {
      name: 'Layout',
      values: {
        gap: 24,
        padding: 40.000000000001,
        dense: true,
        accent: '#ff0000',
        tone: 'loud',
        title: "It's here",
        reset: { type: 'action' },
        'card.radius': 12,
        origin: { x: 0.5, y: -0.25 },
      },
    },
    { name: 'Motion', values: { enter: { type: 'spring', visualDuration: 0.5, bounce: 0.1 } } },
  ]);
  assert.deepEqual(applied, ['Layout', 'Motion']);
  assert.match(source, /gap: \[24, 0, 48, 1\], \/\/ between cards/);
  assert.match(source, /padding: 40,/);
  assert.match(source, /dense: true,/);
  assert.match(source, /accent: '#ff0000',/);
  assert.match(source, /options: \['calm', 'loud'\], default: 'loud' \}/);
  assert.match(source, /title: \{ type: 'text', default: 'It\\'s here' \}/);
  assert.match(source, /reset: \{ type: 'action' \}/);
  assert.match(source, /radius: \[12, 0, 24\], _collapsed: true/);
  assert.match(source, /origin: \{ type: 'pad', x: \[0.5, -1, 1, 0.01\], y: \[-0.25, -1, 1, 0.01\] \}/);
  assert.match(source, /enter: \{ type: 'spring', visualDuration: 0.5, bounce: 0.1 \},\n\} satisfies/);
  assert.match(source, /^\/\*\* @studio-id 0123456789abcdef \*\/\n/);
  assert.match(source, /\/\/ Spacing the designer is tuning\./);
});

test('Apply refuses values it cannot write, and dials from another file', () => {
  const image = `import { useDialKit } from '@module/dialkit';\nexport default function A() {\n  const d = useDialKit('A', { photo: { type: 'image', options: ['/a.png'] } });\n  return d.photo;\n}\n`;
  assert.throws(
    () => applyDials(image, [{ name: 'A', values: { photo: 'data:image/png;base64,AAAA' } }]),
    /uploaded image/,
  );
  assert.match(
    applyDials(image, [{ name: 'A', values: { photo: '/a.png' } }]).source,
    /options: \['\/a.png'\], default: '\/a.png' \}/,
  );
  assert.throws(() => applyDials(view, [{ name: 'Elsewhere', values: {} }]), /not in this view/);
  const computed = view.replace('padding: 32', 'padding: base * 2');
  assert.throws(() => applyDials(computed, [{ name: 'Layout', values: { padding: 10 } }]), /"padding"/);
  const twice = view.replace("useDialKit('Motion'", "useDialKit('Layout'");
  assert.throws(() => applyDials(twice, []), /Two DialKit groups/);
});

test('Add starts an empty group in the component, and Remove takes it out again', () => {
  const plain = `/** @studio-id 0123456789abcdef */\nimport Card from './Card';\n\nexport default function Home() {\n  return <Card />;\n}\n`;
  const added = addDials(plain, 'Home');
  assert.equal(
    added,
    `/** @studio-id 0123456789abcdef */\nimport Card from './Card';\nimport { useDialKit } from '@module/dialkit';\n\nexport default function Home() {\n  useDialKit('Home', {});\n  return <Card />;\n}\n`,
  );
  assert.ok(hasDials(added));
  assert.throws(() => addDials(added, 'Home'), /already has DialKit/);
  assert.equal(removeDials(added), plain);
  const arrow = `const Page = () => {\n  return null;\n};\nexport default Page;\n`;
  assert.match(addDials(arrow, 'Page'), /const Page = \(\) => \{\n  useDialKit\('Page', \{\}\);\n  return null;/);
  assert.throws(() => addDials('export default () => null;\n', 'X'), /component/);
});

test('Remove turns groups into plain values, using live values when given', () => {
  const removed = removeDials(view, [{ name: 'Layout', values: { gap: 20 } }]);
  assert.ok(!hasDials(removed));
  assert.ok(!removed.includes('useDialKit'));
  assert.ok(!removed.includes('const motion'), 'the config constant only the hook used is removed');
  assert.match(
    removed,
    /const layout = \{\n {4}gap: 20,\n {4}padding: 32,\n {4}dense: false,\n {4}accent: '#3b82f6',\n {4}tone: 'calm',\n {4}title: '',/,
  );
  assert.match(removed, /card: \{ radius: 8 \},\n {4}origin: \{ x: 0, y: 0 \},\n {2}\};/);
  assert.match(removed, /const anim = \{ enter: \{ type: 'spring', visualDuration: 0.3, bounce: 0.2 \} \};/);
  assert.ok(!removed.includes('reset'));
  assert.throws(() => removeDials(view.replace("useDialKit('Motion', motion)", 'useDialKit')), /other than as a call/);
});
