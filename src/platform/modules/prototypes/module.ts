import type { ModuleSpec } from '#studio/module';

// Prototypes: the team's work, in src/prototypes/<person>/<id>/, at /prototypes. A prototype is a folder of files
// (views, documents, canvases, text) that opens in the viewer; each belongs to the person whose folder it is in.
// Required: the viewer here is also how a module item or a system content section opens.
export default {
  optional: false,
  settings: { group: 'prototyping', order: 0 },
  lib: true,
  instructions: [
    { path: 'skills/build-prototype/', when: 'asks to create or edit interactive prototype views' },
    {
      path: 'skills/organize-prototype/',
      when: 'asks to rename, move, duplicate, archive, restore, download, or remove a prototype',
    },
  ],
  id: 'prototypes',
  label: 'Prototypes',
  version: '0.1.0',
  requires: '0.1.0',
  description: 'What your team is designing, one folder each: screens, notes and canvases.',
  section: { key: 'prototypes', folder: 'src/prototypes', items: 'prototypes', byPerson: true },
} satisfies ModuleSpec;
