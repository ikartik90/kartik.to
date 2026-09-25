// Icons are external content: the tree is REBUILT from an allowlist, never scrubbed, and
// never touches innerHTML. Colour paints become `currentColor`; `none` is kept.

export interface IconNode {
  tag: string;
  attrs: Record<string, string>;
  children: IconNode[];
}

export interface IconSvg {
  viewBox: number;
  /** Filled geometry ignores stroke width, so the playground holds such icons for review. */
  flattened: boolean;
  nodes: IconNode[];
}

/** Box and line weight, both in px. */
export interface IconSettings {
  size: number;
  stroke: number;
}

/** Geometry only; nothing that can reference or execute. */
const ALLOWED_TAGS = new Set([
  "g",
  "path",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "rect",
]);

/** No id, class, style, href, `on*` or namespaced attributes: nothing that can carry an instruction. */
const ALLOWED_ATTRS = new Set([
  "d",
  "points",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "transform",
  "fill",
  "fill-rule",
  "fill-opacity",
  "clip-rule",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-opacity",
  "opacity",
]);

const NON_COLOURS = new Set(["none", "transparent", "currentcolor", "inherit"]);

/** 1 on a 16 grid, 1.25 on a 20, 1.5 on a 24: one optical weight. */
function houseStroke(viewBox: number): number {
  return viewBox / 16;
}

interface Inherited {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function isColour(paint: string): boolean {
  return paint.length > 0 && !NON_COLOURS.has(paint.toLowerCase());
}

/** XML first, then HTML, which tolerates a hand-edited file. */
function parseDocument(source: string): Element | null {
  if (typeof DOMParser === "undefined") return null;
  const parser = new DOMParser();

  const xml = parser.parseFromString(source, "image/svg+xml");
  if (
    xml.documentElement.nodeName.toLowerCase() === "svg" &&
    xml.getElementsByTagName("parsererror").length === 0
  ) {
    return xml.documentElement;
  }

  return parser.parseFromString(source, "text/html").querySelector("svg");
}

function squareOf(svg: Element): number | null {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    const [, , width, height] = parts;
    // Square only: scaling a non-square drawing into a square cell would letterbox it.
    return width > 0 && width === height ? width : null;
  }

  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  return width > 0 && width === height ? width : null;
}

function readNode(
  element: Element,
  inherited: Inherited,
  found: { filled: boolean; strokes: number[] },
): IconNode | null {
  const tag = element.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return null;

  const attrs: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    const name = attr.name.toLowerCase();
    if (!ALLOWED_ATTRS.has(name)) continue;
    attrs[name] = attr.value;
  }

  const own: Inherited = {
    fill: attrs.fill ?? inherited.fill,
    stroke: attrs.stroke ?? inherited.stroke,
    strokeWidth: attrs["stroke-width"]
      ? Number.parseFloat(attrs["stroke-width"])
      : inherited.strokeWidth,
  };

  // A `g` paints nothing itself; it only hands its paint down.
  if (tag !== "g") {
    if (isColour(own.fill)) found.filled = true;
    if (isColour(own.stroke) && Number.isFinite(own.strokeWidth)) {
      found.strokes.push(own.strokeWidth);
    }
  }

  const children: IconNode[] = [];
  for (const child of Array.from(element.children)) {
    const node = readNode(child, own, found);
    if (node) children.push(node);
  }

  return { tag, attrs, children };
}

/** Null unless it is a square, non-empty SVG. */
export function readIconSvg(source: string): IconSvg | null {
  const svg = parseDocument(source);
  if (!svg) return null;

  const viewBox = squareOf(svg);
  if (!viewBox) return null;

  // SVG's defaults, which is why an icon without `fill="none"` on its root reads as flattened.
  const root: Inherited = {
    fill: svg.getAttribute("fill") ?? "black",
    stroke: svg.getAttribute("stroke") ?? "none",
    strokeWidth: Number.parseFloat(svg.getAttribute("stroke-width") ?? "1"),
  };

  const found = { filled: false, strokes: [] as number[] };
  const nodes: IconNode[] = [];
  for (const child of Array.from(svg.children)) {
    const node = readNode(child, root, found);
    if (node) nodes.push(node);
  }

  if (nodes.length === 0) return null;

  return { viewBox, flattened: found.filled, nodes };
}

function strokeWidthsOf(icon: IconSvg): number[] {
  const widths: number[] = [];

  const walk = (nodes: IconNode[], inherited: Inherited) => {
    for (const node of nodes) {
      const own: Inherited = {
        fill: node.attrs.fill ?? inherited.fill,
        stroke: node.attrs.stroke ?? inherited.stroke,
        strokeWidth: node.attrs["stroke-width"]
          ? Number.parseFloat(node.attrs["stroke-width"])
          : inherited.strokeWidth,
      };
      if (node.tag !== "g" && isColour(own.stroke) && Number.isFinite(own.strokeWidth)) {
        widths.push(own.strokeWidth);
      }
      walk(node.children, own);
    }
  };

  walk(icon.nodes, { fill: "black", stroke: "none", strokeWidth: 1 });
  return widths;
}

/** The commonest stroke width (ties go heavier), so re-weighting keeps the icon's own ratios. */
export function nativeStrokeOf(icon: IconSvg): number {
  const widths = strokeWidthsOf(icon);
  if (widths.length === 0) return houseStroke(icon.viewBox);

  const tally = new Map<number, number>();
  for (const width of widths) tally.set(width, (tally.get(width) ?? 0) + 1);

  let best = widths[0];
  let bestCount = 0;
  for (const [width, count] of tally) {
    if (count > bestCount || (count === bestCount && width > best)) {
      best = width;
      bestCount = count;
    }
  }
  return best;
}

/** User units that render as `stroke` px in a `size` box; the house pairings need no change. */
export function strokeUnitsFor(
  viewBox: number,
  size: number,
  stroke: number,
): number {
  return (stroke * viewBox) / size;
}

function num(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

/** Shared by the renderer and the serialiser, so a download matches the screen. */
export function resolveIconNodes(
  icon: IconSvg,
  settings: IconSettings,
): IconNode[] {
  const factor =
    strokeUnitsFor(icon.viewBox, settings.size, settings.stroke) /
    nativeStrokeOf(icon);

  const resolve = (nodes: IconNode[], inherited: Inherited): IconNode[] =>
    nodes.map((node) => {
      const attrs: Record<string, string> = { ...node.attrs };

      const own: Inherited = {
        fill: attrs.fill ?? inherited.fill,
        stroke: attrs.stroke ?? inherited.stroke,
        strokeWidth: attrs["stroke-width"]
          ? Number.parseFloat(attrs["stroke-width"])
          : inherited.strokeWidth,
      };

      if (attrs.fill && isColour(attrs.fill)) attrs.fill = "currentColor";
      if (attrs.stroke && isColour(attrs.stroke)) attrs.stroke = "currentColor";

      // Written even when defaulted, so the weight doesn't depend on where the file lands.
      if (node.tag !== "g" && isColour(own.stroke)) {
        attrs["stroke-width"] = num(own.strokeWidth * factor);
      } else if (attrs["stroke-width"]) {
        attrs["stroke-width"] = num(own.strokeWidth * factor);
      }

      return { tag: node.tag, attrs, children: resolve(node.children, own) };
    });

  return resolve(icon.nodes, { fill: "black", stroke: "none", strokeWidth: 1 });
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeNode(node: IconNode, indent: string): string {
  const attrs = Object.entries(node.attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join("");

  if (node.children.length === 0) return `${indent}<${node.tag}${attrs}/>`;

  const inner = node.children
    .map((child) => serializeNode(child, `${indent}  `))
    .join("\n");
  return `${indent}<${node.tag}${attrs}>\n${inner}\n${indent}</${node.tag}>`;
}

/** Scales by a group transform rather than rewriting path data; stroke units stay on the original grid. */
export function serializeIconSvg(icon: IconSvg, settings: IconSettings): string {
  const { size } = settings;
  const scale = size / icon.viewBox;
  const nodes = resolveIconNodes(icon, settings);

  const body = nodes.map((node) => serializeNode(node, scale === 1 ? "  " : "    "));
  const drawing =
    scale === 1
      ? body.join("\n")
      : [`  <g transform="scale(${num(scale)})">`, ...body, "  </g>"].join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(size)}" height="${num(size)}" viewBox="0 0 ${num(size)} ${num(size)}" fill="none">`,
    drawing,
    "</svg>",
    "",
  ].join("\n");
}

export function bakeIconSvg(source: string, settings: IconSettings): string | null {
  const icon = readIconSvg(source);
  return icon ? serializeIconSvg(icon, settings) : null;
}

/** camelCase names: React warns on hyphenated SVG attributes. */
export function iconAttrsToProps(
  attrs: Record<string, string>,
): Record<string, string> {
  const props: Record<string, string> = {};
  for (const [name, value] of Object.entries(attrs)) {
    const camel = name.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase(),
    );
    props[camel] = value;
  }
  return props;
}
