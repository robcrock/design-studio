// Building blocks for the canvas tools (tools.ts): element JSON, colors, text sizes, and the
// geometry of arrows. Pure, and importing nothing from Excalidraw, so the same code runs in the app
// and on the command line. Elements are Excalidraw's own JSON; only what matters is filled in, and
// `restoreElements` supplies the rest when the canvas opens.
/* eslint-disable @typescript-eslint/no-explicit-any */

export type El = Record<string, any>;

// A mistake in a tool call, worded so the caller can fix it.
export class ToolError extends Error {}

// Excalidraw's own palette: a strong color for lines and text, a light one for fills.
const STRONG: Record<string, string> = {
  black: '#1e1e1e',
  gray: '#868e96',
  red: '#e03131',
  pink: '#c2255c',
  grape: '#9c36b5',
  violet: '#6741d9',
  blue: '#1971c2',
  cyan: '#0c8599',
  teal: '#099268',
  green: '#2f9e44',
  yellow: '#f08c00',
  orange: '#e8590c',
};
const LIGHT: Record<string, string> = {
  white: '#ffffff',
  gray: '#dee2e6',
  red: '#ffc9c9',
  pink: '#fcc2d7',
  grape: '#eebefa',
  violet: '#d0bfff',
  blue: '#a5d8ff',
  cyan: '#99e9f2',
  teal: '#96f2d7',
  green: '#b2f2bb',
  yellow: '#ffec99',
  orange: '#ffd8a8',
};
export const COLOR_NAMES = Object.keys(STRONG);

// Excalidraw's sticky notes (`stickynote`): its own five note colors, by name, and its layout. A note's
// label fits by shrinking from its font size down to 16px, and only then does the note grow taller. Its
// bottom band holds the date it was made. Excalidraw redoes this layout when it opens the canvas; this
// copy lets the command line place and describe notes without it.
export const NOTE_COLORS: Record<string, string> = {
  yellow: '#ffdf6b',
  pink: '#fcc2d7',
  green: '#b2f2bb',
  blue: '#a5d8ff',
  orange: '#ffd8a8',
};
export const NOTE_SIZE = 250;
const NOTE_PADDING = 16;
const NOTE_INSET_Y = NOTE_PADDING * 2 + 20; // padding above and below, and the date band
const NOTE_MIN_FONT_SIZE = 16;

export function noteLayout(text: string, width: number, baseHeight: number, fontSize = 20) {
  const room = width - NOTE_PADDING * 2;
  for (let size = fontSize; size > NOTE_MIN_FONT_SIZE; size -= 2)
    if (textHeight(text, room, size) <= baseHeight - NOTE_INSET_Y) return { fontSize: size, height: baseHeight, room };
  const size = Math.min(fontSize, NOTE_MIN_FONT_SIZE);
  return { fontSize: size, height: Math.max(baseHeight, textHeight(text, room, size) + NOTE_INSET_Y), room };
}

// A color as CSS: a hex value, "none", or one of Excalidraw's palette names ("blue"). For a fill,
// a name gives its light shade.
export function color(value: unknown, role: 'stroke' | 'background', field: string = role): string {
  if (typeof value !== 'string') throw new ToolError(`${field} must be a color name or a hex value like "#1971c2"`);
  if (value === 'none' || value === 'transparent') return 'transparent';
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  const found = (role === 'stroke' ? STRONG : LIGHT)[value];
  if (!found)
    throw new ToolError(
      `${field} "${value}" isn't a color. Use a hex value, "none", or one of: ${COLOR_NAMES.join(', ')}${role === 'background' ? ', white' : ''}`,
    );
  return found;
}

const random = () => Math.floor(Math.random() * 2 ** 31);
export const newId = () => `${Date.now().toString(36)}${random().toString(36)}`.slice(0, 18);

export const FONT_FAMILY = 6; // Nunito, the canvas's own font
export const LINE_HEIGHT = 1.25;

// Text sizes are worked out here (there's no font to measure with in a script), from the width of each
// character in Nunito, the canvas's font. These are its widths for ASCII 32 to 126, in hundredths of the
// font size, measured in the app; anything else counts as 0.6. A little extra is kept back (SAFETY), so
// a guess errs wide: a line breaks a touch early, and a box comes out a touch roomy, never the other
// way. The app measures properly when the canvas opens, but it doesn't re-wrap text that already has line breaks.
const NUNITO = [
  26, 23, 41, 60, 60, 93, 70, 23, 33, 33, 45, 60, 23, 43, 23, 29, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 23, 23, 60,
  60, 60, 45, 95, 73, 68, 68, 75, 59, 55, 73, 76, 26, 33, 63, 55, 86, 74, 77, 64, 77, 67, 62, 61, 73, 69, 110, 66, 60,
  59, 32, 29, 32, 60, 50, 36, 53, 59, 47, 59, 53, 34, 59, 57, 24, 24, 51, 30, 86, 57, 56, 59, 59, 37, 48, 36, 57, 52,
  84, 53, 52, 47, 36, 27, 36, 60,
];
const SAFETY = 1.04;
const charEm = (ch: string) => {
  const c = ch.charCodeAt(0);
  return c >= 32 && c <= 126 ? NUNITO[c - 32] / 100 : 0.6;
};
export const lineWidth = (line: string, fontSize: number) =>
  [...line].reduce((sum, ch) => sum + charEm(ch), 0) * fontSize * SAFETY;

export function measureText(text: string, fontSize: number) {
  const lines = text.split('\n');
  return {
    width: Math.max(...lines.map(line => lineWidth(line, fontSize))),
    height: lines.length * fontSize * LINE_HEIGHT,
  };
}

// Breaks text into lines that fit `maxWidth` (words are kept whole, unless one is longer than a line).
export function wrapText(text: string, maxWidth: number, fontSize: number): string {
  const fits = (line: string) => lineWidth(line, fontSize) <= maxWidth;
  return text
    .split('\n')
    .flatMap(paragraph => {
      const lines: string[] = [];
      let line = '';
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        // A word longer than a line is broken wherever it runs out of room.
        let rest = word;
        while (!fits(rest) && rest.length > 1) {
          let n = rest.length - 1;
          while (n > 1 && !fits(rest.slice(0, n))) n--;
          if (line) {
            lines.push(line);
            line = '';
          }
          lines.push(rest.slice(0, n));
          rest = rest.slice(n);
        }
        if (line && !fits(`${line} ${rest}`)) {
          lines.push(line);
          line = rest;
        } else line = line ? `${line} ${rest}` : rest;
      }
      lines.push(line);
      return lines;
    })
    .join('\n');
}

// How tall some text is once wrapped to `maxWidth`: lines times the line height.
export const textHeight = (text: string, maxWidth: number, fontSize: number) =>
  wrapText(text, maxWidth, fontSize).split('\n').length * fontSize * LINE_HEIGHT;

// Every element starts from this: a unique id, its place and size, and a first version.
export function make(type: string, props: El): El {
  return {
    id: newId(),
    type,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    version: 1,
    versionNonce: random(),
    seed: random(),
    ...props,
  };
}

// A free-standing piece of text, or a label bound to a container (`containerId`).
//
// `boxWidth` is the width it wraps to. The text is broken into lines here, with the real character widths
// (above), and the unbroken text is kept as `originalText`, which the app re-wraps from when the text is
// edited or the box is resized. `fixedWidth` makes free text keep its width and wrap to it, instead of growing
// with its longest line.
export function textElement(props: {
  text: string;
  x: number;
  y: number;
  fontSize?: number;
  containerId?: string;
  align?: 'left' | 'center';
  stroke?: string;
  boxWidth?: number;
  fixedWidth?: boolean;
}): El {
  const fontSize = props.fontSize ?? 20;
  const text = props.boxWidth ? wrapText(props.text, props.boxWidth, fontSize) : props.text;
  const measured = measureText(text, fontSize);
  const size = props.fixedWidth && props.boxWidth ? { width: props.boxWidth, height: measured.height } : measured;
  return make('text', {
    x: props.x,
    y: props.y,
    ...size,
    text,
    originalText: props.text,
    fontSize,
    fontFamily: FONT_FAMILY,
    lineHeight: LINE_HEIGHT,
    textAlign: props.align ?? 'left',
    verticalAlign: props.containerId ? 'middle' : 'top',
    autoResize: !props.fixedWidth,
    ...(props.containerId ? { containerId: props.containerId } : {}),
    ...(props.stroke ? { strokeColor: props.stroke } : {}),
  });
}

// Where a container's label goes: centered in it, wrapped to its width.
// Room for a label inside a container, by shape: a rectangle's whole width less padding, an ellipse's
// inscribed box, a diamond's inner box. The same rules Excalidraw wraps by.
export const labelRoom = (shape: string, width: number) =>
  Math.max(40, (shape === 'ellipse' ? width * 0.7 : shape === 'diamond' ? width * 0.5 : width) - 24);

// `wrap` false keeps the lines as given, for a container sized to its label already (a laid out diagram).
export function labelFor(container: El, text: string, fontSize = 20, stroke?: string, wrap = true): El {
  const inner = wrap ? labelRoom(container.type, container.width) : undefined;
  const label = textElement({
    text,
    x: 0,
    y: 0,
    fontSize,
    containerId: container.id,
    align: 'center',
    boxWidth: inner,
    stroke,
  });
  return centerLabel(container, label);
}

export function centerLabel(container: El, label: El): El {
  return {
    ...label,
    x: container.x + (container.width - label.width) / 2,
    y: container.y + (container.height - label.height) / 2,
  };
}

// The box around an element (a line's points are relative to its start).
export function boundsOf(el: El) {
  if (Array.isArray(el.points) && el.points.length) {
    const xs = el.points.map(([x]: number[]) => el.x + x);
    const ys = el.points.map(([, y]: number[]) => el.y + y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
  }
  return { x: el.x, y: el.y, width: el.width, height: el.height };
}

export function unionBounds(boxes: { x: number; y: number; width: number; height: number }[]) {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map(b => b.x));
  const y = Math.min(...boxes.map(b => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map(b => b.x + b.width)) - x,
    height: Math.max(...boxes.map(b => b.y + b.height)) - y,
  };
}

// A straight arrow between two elements: side to side if they sit in a row, otherwise top to bottom.
export function arrowEnds(from: El, to: El) {
  const a = boundsOf(from);
  const b = boundsOf(to);
  const horizontal =
    Math.abs(b.x + b.width / 2 - (a.x + a.width / 2)) >= Math.abs(b.y + b.height / 2 - (a.y + a.height / 2));
  const start = horizontal
    ? { x: b.x > a.x ? a.x + a.width : a.x, y: a.y + a.height / 2 }
    : { x: a.x + a.width / 2, y: b.y > a.y ? a.y + a.height : a.y };
  const end = horizontal
    ? { x: b.x > a.x ? b.x : b.x + b.width, y: b.y + b.height / 2 }
    : { x: b.x + b.width / 2, y: b.y > a.y ? b.y : b.y + b.height };
  return { start, end };
}

// An element with its version raised, so an open canvas takes the change instead of keeping its own.
export function bump(el: El, patch: El = {}): El {
  return { ...el, ...patch, version: (el.version ?? 0) + 1, versionNonce: random() };
}
