import type { ModuleSpec } from '#studio/module';

// DialKit: live dials for tuning a prototype view, saved to the view's code (README.md).
export default {
  lib: true,
  id: 'dialkit',
  label: 'DialKit',
  version: '0.1.0',
  requires: '0.2.0',
  description: 'Tune a prototype view with live dials, then save the values to its code.',
  optional: true,
  settings: { group: 'prototyping', order: 5 },
  instructions: [{ path: 'skills/use-dialkit/', when: 'asks to add, tune, save, or remove DialKit dials on a view' }],
  optimizeDependencies: ['dialkit', 'motion'],
  dependencies: { dialkit: '2.2.0', motion: '14.9.0' },
} satisfies ModuleSpec;
