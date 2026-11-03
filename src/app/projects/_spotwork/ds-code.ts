import Image from "next/image";
import { Fragment, isValidElement, type ReactElement, type ReactNode } from "react";
import { css } from "../../../../styled-system/css";
import { TAILWIND } from "./ds-tailwind";

// An example's JSX as code, and as a file of its own the way shadcn/ui shows one. A component with a static
// `unwrap(props)` (a holder of state) shows what it renders; one with a static `tag` is that element, its `tw` the
// classes; host elements that only style are opened up.

const WIDTH = 80;
/** The width the file being written breaks its lines at. */
let width = WIDTH;
const SKIPPED = new Set(["children", "key", "ref", "className", "style"]);

// Data from the app's store, written as the fields it's read from: a record (`datum`) or a list mapped over (`each`).
const PATH = Symbol("path");
type Path = { [PATH]: string };
const isPath = (value: unknown): value is Path =>
  (typeof value === "function" || (typeof value === "object" && value !== null)) &&
  typeof (value as Path)[PATH] === "string";

/** A stand-in for the data at `path`, each field read from it, or method called on it, another. */
function pathOf(path: string): unknown {
  return new Proxy(() => {}, {
    get(_, key) {
      if (key === PATH) return path;
      if (key === Symbol.toPrimitive || key === "toString") return () => path;
      if (typeof key === "symbol" || key === "$$typeof" || key === "then") return undefined;
      return pathOf(/^\d+$/.test(key) ? `${path}[${key}]` : `${path}.${key}`);
    },
    apply: (_, __, args: unknown[]) => pathOf(`${path}(${args.map((arg) => JSON.stringify(arg)).join(", ")})`),
  });
}

type Mapped = { list: string; item: string; template: () => ReactNode };
const MAPS = new WeakMap<object, Mapped>();
const RECORDS = new WeakMap<object, { name: string; template: () => ReactNode }>();

const singular = (name: string) => name.replace(/s$/, "");
const typeOf = (name: string) => name[0].toUpperCase() + singular(name).slice(1);

/** The file's props, by name: what it maps over or reads from. */
let given: Map<string, string> | null = null;

/** `of` drawn by `render`; the code maps over it as `name`, a prop of the file unless it's a record's own list. */
export function each<T>(of: readonly T[], name: string, render: (item: T, index: number) => ReactElement): ReactElement[] {
  const item = singular(name);
  const template = () => render(pathOf(item) as T, 0);
  if (isPath(of)) {
    const stand: ReactElement[] = [];
    MAPS.set(stand, { list: of[PATH], item, template });
    return stand;
  }
  const list = of.map(render);
  MAPS.set(list, { list: name, item, template });
  return list;
}

/** `value` drawn by `render`; the code reads its fields from `name`, a prop of the file. */
export function datum<T>(value: T, name: string, render: (value: T) => ReactElement): ReactElement {
  const element = render(value);
  RECORDS.set(element, { name, template: () => render(pathOf(name) as T) });
  return element;
}

type Named = {
  displayName?: string;
  name?: string;
  render?: Named;
  type?: Named;
  tag?: string;
  unwrap?: (props: object) => ReactNode;
};

// Components that don't name themselves.
const KNOWN = new Map<unknown, string>([[Image, "Image"]]);

function rawNameOf(type: ReactElement["type"] | undefined): string {
  if (typeof type === "string") return type;
  if (!type) return "Component";
  const known = KNOWN.get(type);
  if (known) return known;
  const named = type as Named;
  return named.tag || named.displayName || named.name || rawNameOf((named.render ?? named.type) as ReactElement["type"] | undefined);
}

const iconOf = (name: string) => /^Svg(.+)$/.exec(name)?.[1];

function nameOf(type: ReactElement["type"] | undefined): string {
  const name = rawNameOf(type);
  const icon = iconOf(name);
  return icon ? (icon.endsWith("Icon") ? icon : `${icon}Icon`) : name;
}

/** An imported image's file and name: `…/placeholder-female.4f3a9c1e.png` is `placeholderFemale`. */
function pictureOf(value: object) {
  const src = (value as { src?: unknown }).src;
  if (typeof src !== "string" || !("width" in value)) return null;
  const [base, ...rest] = src.split("/").at(-1)!.split(".");
  const file = rest.length > 1 ? `${base}.${rest.at(-1)}` : [base, ...rest].join(".");
  return { file, name: base.replace(/[-_]+(\w)/g, (_, letter: string) => letter.toUpperCase()) };
}

function valueOf(value: unknown): string {
  if (isPath(value)) return value[PATH];
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "function") return "() => {}";
  if (isValidElement(value)) return jsxOf(value).replace(/\n\s*/g, " ");
  if (Array.isArray(value)) return `[${value.map(valueOf).join(", ")}]`;
  const picture = typeof value === "object" && value !== null ? pictureOf(value) : null;
  if (picture) return picture.name;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    const key = (k: string) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
    return entries.length ? `{ ${entries.map(([k, v]) => `${key(k)}: ${valueOf(v)}`).join(", ")} }` : "{}";
  }
  return String(value);
}

function propOf(name: string, value: unknown) {
  if (value === true) return name;
  if (typeof value === "string" && !value.includes('"')) return `${name}="${value}"`;
  return `${name}={${valueOf(value)}}`;
}

const textOf = (text: string | Path) =>
  isPath(text) ? `{${text[PATH]}}` : /[{}<>]/.test(text) ? `{${JSON.stringify(text)}}` : text.trim();

/** Text and paths as one run, as JSX writes them: a path abuts words that don't space themselves off it. */
const joined = (parts: (string | Path)[]) =>
  parts
    .map((part, i) => {
      const before = parts[i - 1];
      const spaced = (!isPath(part) && /^\s/.test(part)) || (!isPath(before) && /\s$/.test(before));
      const abuts = i > 0 && (isPath(part) || isPath(before)) && !spaced;
      return (i > 0 && !abuts ? " " : "") + textOf(part);
    })
    .join("");

type Part = ReactElement | string | Path | { map: Mapped };
const isMap = (part: unknown): part is { map: Mapped } => typeof part === "object" && part !== null && "map" in part && !isPath(part);
const isText = (part: unknown): part is string | Path => typeof part === "string" || isPath(part);

const ownProps = (props: Record<string, unknown>) =>
  Object.entries(props).filter(([k, v]) => !SKIPPED.has(k) && v !== undefined && v !== null && v !== false);

/**
 * The elements and text `node` stands for, with layout boxes, fragments and holders of state opened up; a bare span
 * beside other elements, one of several runs (a tooltip's lines), stays.
 */
function flatten(node: ReactNode, alone = true): Part[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (isPath(node)) return [node];
  if (typeof node === "string" || typeof node === "number") return String(node).trim() ? [String(node)] : [];
  const mapped = typeof node === "object" ? MAPS.get(node) : undefined;
  if (mapped) {
    if (!mapped.list.includes(".")) given?.set(mapped.list, `${typeOf(mapped.list)}[]`);
    return [{ map: mapped }];
  }
  if (Array.isArray(node)) {
    const several = node.filter((child) => isValidElement(child)).length > 1;
    return node.flatMap((child) => flatten(child, !several));
  }
  if (!isValidElement(node)) return [];
  const record = RECORDS.get(node);
  if (record) {
    given?.set(record.name, typeOf(record.name));
    return flatten(record.template());
  }
  const props = node.props as Record<string, unknown>;
  if (node.type === Fragment) return flatten(props.children as ReactNode);
  const unwrap = typeof node.type !== "string" && (node.type as Named).unwrap;
  if (unwrap) return flatten(unwrap(props));
  // A box that only lays out or styles; other markup with no props (a `strong`) carries meaning, so it stays.
  const box = node.type === "div" || (node.type === "span" && alone) || props.className !== undefined || props.style !== undefined;
  if (typeof node.type === "string" && ownProps(props).length === 0 && box) return flatten(props.children as ReactNode);
  return [node];
}

const RUN = 6;

/** `parts`, each run of more than RUN of the same component cut to its first three and its last. */
function shorten(parts: Part[]): (Part | null)[] {
  const out: (Part | null)[] = [];
  const element = (part: Part): part is ReactElement => isValidElement(part);
  for (let i = 0; i < parts.length; ) {
    const part = parts[i];
    let end = i + 1;
    while (element(part) && end < parts.length && element(parts[end]) && nameOf((parts[end] as ReactElement).type) === nameOf(part.type)) end++;
    out.push(...(end - i > RUN ? [...parts.slice(i, i + 3), null, parts[end - 1]] : parts.slice(i, end)));
    i = end;
  }
  return out;
}

// Each Tailwind class's Panda class, so a `className` built of them (a `Typography`'s `glyph`) prints as Tailwind's.
const TAILWIND_OF = new Map(Object.entries(TAILWIND).map(([tw, style]) => [css(style), tw]));

const attributesOf = (node: ReactElement) => {
  const props = node.props as Record<string, unknown>;
  if (typeof node.type !== "string" && (node.type as Named).tag) return [`className="${props.tw}"`];
  const classes = typeof props.className === "string" ? props.className.split(/\s+/).flatMap((name) => TAILWIND_OF.get(name) ?? []) : [];
  return [...ownProps(props).map(([k, v]) => propOf(k, v)), ...(classes.length ? [`className="${classes.join(" ")}"`] : [])];
};

function write(node: Part | null, indent: string, keyed = false): string {
  if (node === null) return `${indent}{/* … */}`;
  if (isText(node)) return indent + textOf(node);
  if (isMap(node)) {
    const { list, item, template } = node.map;
    const body = shorten(flatten(template())).map((part) => write(part, `${indent}  `, true));
    return [`${indent}{${list}.map((${item}) => (`, ...body, `${indent}))}`].join("\n");
  }
  const name = nameOf(node.type);
  const attributes = [...(keyed && node.key ? [`key={${node.key}}`] : []), ...attributesOf(node)];
  const children = flatten((node.props as { children?: ReactNode }).children);
  const inline = `${indent}<${name}${attributes.map((a) => ` ${a}`).join("")}`;
  const open = inline.length + 2 <= width ? inline : [`${indent}<${name}`, ...attributes.map((a) => `${indent}  ${a}`)].join("\n");
  const broken = open !== inline;
  if (children.length === 0) return `${open}${broken ? `\n${indent}` : " "}/>`;
  const close = `</${name}>`;
  if (children.every(isText)) {
    const text = joined(children);
    const line = `${open}>${text}${close}`;
    if (!broken && line.length <= width) return line;
    return `${open}${broken ? `\n${indent}` : ""}>\n${indent}  ${text}\n${indent}${close}`;
  }
  const body = shorten(children)
    .map((child) => write(child, `${indent}  `))
    .join("\n");
  return `${open}${broken ? `\n${indent}` : ""}>\n${body}\n${indent}${close}`;
}

export function jsxOf(node: ReactNode) {
  return shorten(flatten(node))
    .map((part) => write(part, ""))
    .join("\n");
}

type Import = { from: string; name: string; default?: boolean; type?: boolean };

const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

/** Where a component comes from: a compound one's parts with its root, icons from one module, the rest from their own. */
function importOf(type: ReactElement["type"]): Import | null {
  if (typeof type === "string" || (type as Named).tag) return null;
  if (KNOWN.has(type)) return { from: "next/image", name: "Image", default: true };
  if (iconOf(rawNameOf(type))) return { from: "@/components/icons", name: nameOf(type) };
  const root = nameOf(type).split(".")[0];
  return { from: `@/components/ui/${kebab(root)}`, name: root };
}

function importsOf(parts: (Part | null)[], into: Import[] = []) {
  const visit = (value: unknown): void => {
    if (isPath(value)) return;
    if (isValidElement(value)) importsOf(shorten(flatten(value)), into);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") {
      const picture = pictureOf(value);
      if (picture) into.push({ from: `@/assets/${picture.file}`, name: picture.name, default: true });
      else Object.values(value).forEach(visit);
    }
  };
  for (const part of parts) {
    if (part === null || isText(part)) continue;
    if (isMap(part)) {
      importsOf(shorten(flatten(part.map.template())), into);
      continue;
    }
    const own = importOf(part.type);
    if (own) into.push(own);
    const props = part.props as Record<string, unknown>;
    ownProps(props).forEach(([, value]) => visit(value));
    importsOf(shorten(flatten(props.children as ReactNode)), into);
  }
  return into;
}

/** The import lines for `imports`, one per module: packages first, then the project's own, each set by path. */
function importLines(imports: Import[]) {
  const modules = new Map<string, { default?: string; names: Set<string>; type?: boolean }>();
  for (const { from, name, default: whole, type } of imports) {
    const entry = modules.get(from) ?? { names: new Set(), type };
    if (whole) entry.default = name;
    else entry.names.add(name);
    modules.set(from, entry);
  }
  const line = (from: string) => {
    const { default: whole, names, type } = modules.get(from)!;
    const sorted = [...names].sort();
    const named = names.size ? `{ ${sorted.join(", ")} }` : "";
    const inline = `import ${type ? "type " : ""}${[whole, named].filter(Boolean).join(", ")} from "${from}"`;
    if (inline.length <= width || !names.size) return inline;
    return [`import ${whole ? `${whole}, ` : ""}{`, ...sorted.map((name) => `  ${name},`), `} from "${from}"`].join("\n");
  };
  const paths = [...modules.keys()].sort();
  const groups = [paths.filter((path) => !path.startsWith("@/")), paths.filter((path) => path.startsWith("@/"))];
  return groups.filter((group) => group.length).map((group) => group.map(line).join("\n"));
}

/** `node` as a file of its own: its imports, then a component named `name` that returns it. */
export function fileOf(name: string, node: ReactNode, lineWidth = WIDTH) {
  given = new Map();
  width = lineWidth;
  try {
    const parts = shorten(flatten(node));
    const body =
      parts.length === 1
        ? write(parts[0], "    ")
        : ["    <>", ...parts.map((part) => write(part, "      ")), "    </>"].join("\n");
    const inline = `  return ${parts.length ? body.trim() : "null"}`;
    const returned = !parts.length || (!body.includes("\n") && inline.length <= width) ? inline : `  return (\n${body}\n  )`;
    const imports = importsOf(parts);
    const props = [...given];
    for (const [, type] of props) imports.push({ from: `@/domain/${kebab(type.replace("[]", ""))}`, name: type.replace("[]", ""), type: true });
    const signature = props.length
      ? `{ ${props.map(([prop]) => prop).join(", ")} }: { ${props.map(([prop, type]) => `${prop}: ${type}`).join("; ")} }`
      : "";
    return [...importLines(imports), [`export function ${name}(${signature}) {`, returned, "}"].join("\n")].join("\n\n");
  } finally {
    given = null;
    width = WIDTH;
  }
}

const pascal = (words: string) =>
  words
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join("");

/** An example's function name: its component's Figma name (less a part the last repeats), then its title, or Demo. */
export function exampleName(id: string, title?: string) {
  const parts = id.split("/");
  const last = parts.at(-1)!;
  return parts.filter((part) => part === last || !last.includes(part)).map(pascal).join("") + pascal(title ?? "Demo");
}
