// ---------------------------------------------------------------------------
// An uploaded icon, read into something the playground can draw, re-weight and
// hand back as a file.
//
// The whole point of the icons playground is that a 16-grid icon and a 20-grid
// one are the SAME drawing at two scales, and that the weight of the line is a
// setting rather than a property of the file. So an icon is never rendered as
// the bytes that were uploaded: it is parsed into a small tree, and every
// surface — the grid, the download, the zip — asks for it at a size and a
// weight.
//
// Three things happen on the way in, and each of them is a rule this module
// owns rather than a habit its callers have to remember:
//
//   SANITISE   An icon comes out of a bucket, and a file in a bucket is
//              external content. The tree is REBUILT from an allowlist of
//              elements and attributes rather than scrubbed, so a `<script>`,
//              an `on*` handler, a `javascript:` href or anything else nobody
//              thought of is not dropped — it is never carried across in the
//              first place. Nothing here ever touches innerHTML: the same tree
//              is rendered as React elements and serialised as text.
//
//   COLOUR     Icons arrive painted whatever the exporter felt like (Figma
//              writes `white`, others write `#000`). A set that is half white
//              and half black is invisible in one theme or the other, so every
//              paint that is a colour becomes `currentColor` and the page it
//              lands in decides. `none` is left alone — it is not a colour, it
//              is the absence of one, and it is what keeps a stroked icon from
//              filling in.
//
//   WEIGHT     See `strokeUnitsFor`. The three house pairings — 16 at 1px, 20
//              at 1.25px, 24 at 1.5px — are one optical weight, and the maths
//              is built so that asking for any of them costs an icon nothing.
//
// What is deliberately NOT carried across: `defs`, `clipPath`, `mask`, `use`,
// `image`, `text` and `style`. Every one of them is a reference or a resource
// rather than geometry, and an icon that needs one is not the kind of icon
// this set is for — it would also arrive with ids that collide the moment two
// icons are inlined on one page.
// ---------------------------------------------------------------------------

/** One drawable node of a sanitised icon. */
export interface IconNode {
  tag: string;
  /** Allowlisted attributes only, in the order they were read. */
  attrs: Record<string, string>;
  children: IconNode[];
}

export interface IconSvg {
  /** The square grid the icon is drawn on — 16 and 20 here, mostly. */
  viewBox: number;
  /**
   * Whether any of its geometry is FILLED. Such an icon does not answer to a
   * stroke width — the outline was flattened before it got here — so the
   * playground holds it back for review rather than showing a set where the
   * weight slider silently skips a few tiles.
   */
  flattened: boolean;
  nodes: IconNode[];
}

/** How an icon is being asked for: its box in px, and the line's px weight. */
export interface IconSettings {
  size: number;
  stroke: number;
}

/**
 * Geometry, and nothing that can reference or execute. `g` is here for the
 * transforms exporters wrap things in; everything else draws a shape.
 */
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

/**
 * Attributes that describe a shape or how it is painted. No `id`, no `class`,
 * no `style`, no `href`, nothing beginning `on`, and nothing namespaced —
 * which between them is every attribute an icon could carry an instruction in.
 */
const ALLOWED_ATTRS = new Set([
  // Shape
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
  // Paint
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

/** Paints that name no colour, and so are carried across untouched. */
const NON_COLOURS = new Set(["none", "transparent", "currentcolor", "inherit"]);

/**
 * What a grid is drawn at when nothing in the file says: 1 on a 16, 1.25 on a
 * 20, 1.5 on a 24 — one optical weight expressed three ways, which is exactly
 * the ratio `viewBox / 16` gives.
 */
function houseStroke(viewBox: number): number {
  return viewBox / 16;
}

/** The paint an element inherits where it declares none of its own. */
interface Inherited {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

function isColour(paint: string): boolean {
  return paint.length > 0 && !NON_COLOURS.has(paint.toLowerCase());
}

/**
 * Parse a file into a document, leniently. An icon export is well-formed XML
 * and parses as `image/svg+xml`; anything hand-edited enough to have lost a
 * quote still parses as HTML, where the parser is namespace-aware and puts an
 * inline `<svg>` in the right namespace anyway.
 */
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

/** The square the icon is drawn on, from its viewBox or failing that its box. */
function squareOf(svg: Element): number | null {
  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
    const [, , width, height] = parts;
    // Square only. A 32×20 drawing is a logotype or a piece of a sheet, and
    // scaling it into a square cell would silently letterbox it.
    return width > 0 && width === height ? width : null;
  }

  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  return width > 0 && width === height ? width : null;
}

/**
 * Rebuild one element and its children from the allowlist, dropping anything
 * that is not on it — and, on the way past, note whether anything is filled.
 */
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

/**
 * An uploaded file as an icon, or `null` if it is not one: not an SVG, not
 * square, or square and empty.
 */
export function readIconSvg(source: string): IconSvg | null {
  const svg = parseDocument(source);
  if (!svg) return null;

  const viewBox = squareOf(svg);
  if (!viewBox) return null;

  // SVG's own defaults, which is what an element inherits when the root says
  // nothing: black fill, no stroke, and a stroke width of 1 if one appears.
  // The default fill is why an icon whose root does not say `fill="none"`
  // reads as flattened — because in a browser it genuinely draws filled.
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

/** Every stroke width in the tree, in document order. */
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

/**
 * The weight the icon was DRAWN at — the one every other stroke in it is
 * proportional to.
 *
 * The commonest width rather than the first or the largest, because an icon
 * that mixes weights (a body at 1.25 with a hairline detail at 0.5) has one
 * that is plainly its own and others that are decisions relative to it. Taking
 * the mode means re-weighting scales the whole icon and keeps those decisions;
 * taking every stroke to the same number would level the icon flat.
 *
 * An icon with no strokes at all — a flattened one — reports its grid's house
 * weight, so the ratio it would be re-weighted by is 1 rather than a division
 * by zero. Nothing in it will move either way.
 */
export function nativeStrokeOf(icon: IconSvg): number {
  const widths = strokeWidthsOf(icon);
  if (widths.length === 0) return houseStroke(icon.viewBox);

  const tally = new Map<number, number>();
  for (const width of widths) tally.set(width, (tally.get(width) ?? 0) + 1);

  let best = widths[0];
  let bestCount = 0;
  for (const [width, count] of tally) {
    // Ties go to the heavier stroke: the body of an icon is what a hairline is
    // a detail on, never the other way round.
    if (count > bestCount || (count === bestCount && width > best)) {
      best = width;
      bestCount = count;
    }
  }
  return best;
}

/**
 * The stroke width, in the icon's own user units, that renders as exactly
 * `stroke` CSS pixels when the icon is drawn in a `size` box.
 *
 * A stroke in user units is multiplied by `size / viewBox` on its way to the
 * screen, so the units wanted are the pixels wanted divided by that — which is
 * the whole of it:
 *
 *   units = stroke × viewBox / size
 *
 * What makes it the right formula rather than merely a correct one is what it
 * does to the house pairings. A 20-grid icon drawn at 1.25 asked for 16px at
 * 1px needs 1 × 20/16 = 1.25 units — the weight it already has. The same icon
 * at 24px and 1.5px needs 1.5 × 20/24 = 1.25 units. So the three pairings the
 * set is authored around cost the file no change at all, and only genuinely
 * off-grid combinations (24px at 1px, say) re-weight anything.
 */
export function strokeUnitsFor(
  viewBox: number,
  size: number,
  stroke: number,
): number {
  return (stroke * viewBox) / size;
}

/** At most four decimals, with no trailing zeros — `1.25`, not `1.2500`. */
function num(value: number): string {
  return String(Math.round(value * 10000) / 10000);
}

/**
 * The tree with its paint and its weight resolved for these settings —
 * geometry untouched. Shared by the renderer and the serialiser so a
 * downloaded icon cannot differ from the one on screen.
 */
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

      // Written out even where the source left it to the default, so the
      // weight is a fact of the file rather than of what it is dropped into.
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

/**
 * The icon as a file, at the size and weight it is being looked at.
 *
 * The box, the viewBox and the drawing are all made to agree: an icon drawn on
 * a smaller grid is scaled by a group transform rather than by rewriting its
 * path data, which is exact, reversible and about forty lines of parser
 * cheaper. The stroke units are worked out for the ORIGINAL grid, since the
 * group scale multiplies them on the way out exactly as the viewBox would
 * have.
 */
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

/** An uploaded file straight to a downloadable one, or `null` if it is not an icon. */
export function bakeIconSvg(source: string, settings: IconSettings): string | null {
  const icon = readIconSvg(source);
  return icon ? serializeIconSvg(icon, settings) : null;
}

/**
 * Attribute names as React wants them on an SVG element. The allowlist is
 * fixed and short, so this is a transformation rather than a table: React
 * warns on every hyphenated name it knows a camel form for, and passing the
 * hyphenated one through would fill the console with them.
 */
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
