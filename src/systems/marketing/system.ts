import type { SystemSpec } from '#studio/system';

// Marketing: a design system prototypes can build with. A prototype picks it with "system": "marketing" in its meta.json.
export default {
  status: "active",
  role: 'prototype',
  label: 'Marketing',
  themeClass: 'marketing-theme',
  styling: 'tailwind',
  colorModes: ['light', 'dark'],
  screens: [
    { name: 'Desktop', width: 1440 },
    { name: 'Tablet', width: 768 },
    { name: 'Phone', width: 390 },
  ],
  docs: 'warn',
  libraries: [
    {
      "kind": "source",
      "id": "tailwind",
      "label": "Tailwind CSS",
      "description": "Styling utilities and theme integration, supplied by Studio",
      "docs": "https://tailwindcss.com/docs"
    },
    {
      "kind": "source",
      "id": "shadcn",
      "label": "shadcn/ui",
      "description": "Component source and styles",
      "docs": "https://ui.shadcn.com/docs",
      "components": [
        "button",
        "tabs",
        "tooltip"
      ]
    },
    {
      "kind": "package",
      "id": "base-ui",
      "label": "Base UI",
      "package": "@base-ui/react",
      "description": "Accessible component behavior",
      "docs": "https://base-ui.com/react/overview/quick-start"
    },
    {
      "kind": "package",
      "id": "lucide",
      "label": "Lucide",
      "package": "lucide-react",
      "description": "Icon catalog",
      "entry": "libraries/icons.ts",
      "docs": "https://lucide.dev/icons/",
      "assets": [
        "icons"
      ]
    },
    {
      "kind": "package",
      "id": "font",
      "label": "Geist",
      "package": "@fontsource-variable/geist",
      "description": "System typeface",
      "docs": "https://fontsource.org/fonts/geist",
      "assets": [
        "fonts"
      ]
    },
    {
      "kind": "package",
      "id": "font-mono",
      "label": "Geist Mono",
      "package": "@fontsource-variable/geist-mono",
      "description": "Monospace typeface for numbers, IDs, and code",
      "docs": "https://fontsource.org/fonts/geist-mono",
      "assets": [
        "fonts"
      ]
    }
  ],
  origin: 'shadcn',
  studioId: "v4576ka1mbpbqdp1",
} satisfies SystemSpec;
