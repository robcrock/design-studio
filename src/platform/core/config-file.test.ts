import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfigFile, serializeConfig, withModule, withSettings } from './config-file.ts';
import type { StudioConfig } from './config.ts';

const base: StudioConfig = {
  $schema: './src/platform/core/studio.config.schema.json',
  formatVersion: 1,
  name: 'Studio',
  usage: 'personal',
  modules: { canvas: true, text: false },
  systems: ['product'],
  systemMaintainers: { aaaaaaaaaaaaaaaa: [] },
  defaultSystem: 'aaaaaaaaaaaaaaaa',
  assetLimitKB: 750,
};

test('the file is parsed as plain JSON and bad text says what is wrong', () => {
  assert.deepEqual(parseConfigFile(serializeConfig(base)), { value: base });
  assert.match((parseConfigFile('{ name: 1 }') as { error: string }).error, /not valid JSON/);
  assert.match((parseConfigFile('[]') as { error: string }).error, /must be a JSON object/);
  assert.match((parseConfigFile('null') as { error: string }).error, /must be a JSON object/);
  assert.match((parseConfigFile('export default {}') as { error: string }).error, /not valid JSON/);
});

test('a repeated key is refused at any depth, and only a key counts', () => {
  assert.match((parseConfigFile('{"name":"a","name":"b"}') as { error: string }).error, /"name" more than once/);
  assert.match(
    (parseConfigFile('{"modules":{"canvas":true,"canvas":false}}') as { error: string }).error,
    /"canvas" more than once/,
  );
  assert.ok('value' in parseConfigFile('{"a":{"x":1},"b":{"x":2},"list":[{"x":1},{"x":2}],"name":"x:","t":"name"}'));
});

test('setting updates preserve unrelated data and do not mutate their input', () => {
  const changed = withSettings(base, { name: 'Renamed', tagline: 'Hello' });
  assert.deepEqual(changed, { ...base, name: 'Renamed', tagline: 'Hello' });
  assert.equal(base.name, 'Studio');
  assert.deepEqual(withSettings(changed, { tagline: undefined }), { ...base, name: 'Renamed' });
});

test('turning a module on, off, or out edits only the modules list', () => {
  assert.deepEqual(withModule(base, 'text', true).modules, { canvas: true, text: true });
  assert.deepEqual(withModule(base, 'diagrams', false).modules, { canvas: true, text: false, diagrams: false });
  assert.deepEqual(withModule(base, 'text', null).modules, { canvas: true });
  assert.deepEqual(Object.keys(withModule(base, 'text', null)), Object.keys(base));
  assert.deepEqual(withModule({ ...base, modules: undefined } as unknown as StudioConfig, 'text', true).modules, {
    text: true,
  });
});
