// Lays out Mermaid as Excalidraw elements, with Excalidraw's own converter: the one behind pasting
// Mermaid onto a canvas. The `mermaid` tool (tools.ts) makes them into canvas elements. It reads SVG
// with the browser's DOM; cli.ts gives it one in Node.
import { parseMermaidToExcalidraw } from '@excalidraw/mermaid-to-excalidraw';
import { ToolError, type El } from './elements.ts';

export async function layoutMermaid(source: unknown): Promise<El[]> {
  if (typeof source !== 'string' || !source.trim())
    throw new ToolError('mermaid needs `source`: the Mermaid text, such as "flowchart LR\\n  A --> B"');
  try {
    return (await parseMermaidToExcalidraw(source)).elements as El[];
  } catch (error) {
    throw new ToolError(`this Mermaid doesn't parse. ${(error as Error).message}`);
  }
}
