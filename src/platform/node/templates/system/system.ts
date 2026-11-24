import type { SystemSpec } from '#studio/system';

// __LABEL__: select source key __ID__ in creation controls. Prototype metadata stores this installation’s permanent studioId.
export default {
  status: 'active',
  role: 'prototype',
  label: '__LABEL__',
  themeClass: '__ID__-theme',
  styling: 'tailwind',
  colorModes: ['light', 'dark'],
  screens: [{ name: 'Desktop', width: 1440 }],
  docs: 'warn',
  libraries: [],
  origin: null,
} satisfies SystemSpec;
