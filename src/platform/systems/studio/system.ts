import type { SystemSpec } from '../../modules/systems/spec.ts';

// Studio's supplied toolkit and operating guidance. Prototype systems remain independent.
export default {
  label: 'Studio',
  status: 'active',
  role: 'platform',
  themeClass: 'studio-theme',
  styling: 'tailwind',
  colorModes: ['light', 'dark'],
  screens: [{ name: 'Desktop', width: 1440 }],
  docs: 'off',
  libraries: [],
  origin: 'shadcn',
  studioId: '5e3btfmmmys5b0h7',
} satisfies SystemSpec;
