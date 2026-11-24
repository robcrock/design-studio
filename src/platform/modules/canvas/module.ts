import type { ModuleSpec } from '#studio/module';

// The canvas file type: an .excalidraw file is a page to arrange views, documents, and notes on (src/platform/context/file-types.md).
export default {
  lib: false,
  id: 'canvas',
  label: 'Canvases',
  version: '0.1.0',
  requires: '0.1.0',
  description: 'An .excalidraw file opens as a page to arrange views, documents, and notes on.',
  optional: true,
  hosts: [{ id: 'canvas', scopes: ['prototype'], references: 'same-prototype' }],
  settings: { group: 'prototyping', order: 2 },
  instructions: [
    { path: 'skills/use-canvas/', when: 'asks for a canvas (a page of views, documents, and notes arranged together)' },
  ],
  optimizeDependencies: ['@excalidraw/excalidraw', '@excalidraw/mermaid-to-excalidraw'],
  dependencies: {
    '@excalidraw/excalidraw': '0.18.0-3c916c5',
    '@excalidraw/mermaid-to-excalidraw': '3.6.0',
    linkedom: '0.18.12',
  },
} satisfies ModuleSpec;
