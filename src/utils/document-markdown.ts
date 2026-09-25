import type { BlockNode, MediaNode, TextNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";

interface MarkdownOptions {
  title?: string | null;
  origin: string;
}

type Mark = NonNullable<TextNode["marks"]>[number];

const sameMarks = (a: TextNode, b: TextNode) =>
  JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);

/** Merges adjacent runs with identical marks: `**a****b**` is not bold. */
function mergeRuns(children: TextNode[]): TextNode[] {
  const merged: TextNode[] = [];
  for (const child of children) {
    const last = merged.at(-1);
    if (last && sameMarks(last, child)) {
      merged[merged.length - 1] = { ...last, text: last.text + child.text };
    } else {
      merged.push(child);
    }
  }
  return merged;
}

function wrap(body: string, marks: Mark[]): string {
  let out = body;
  for (const mark of marks) {
    if (mark.type === "code") out = `\`${out}\``;
    if (mark.type === "strikethrough") out = `~~${out}~~`;
    if (mark.type === "italic") out = `_${out}_`;
  }
  if (marks.some((mark) => mark.type === "bold")) out = `**${out}**`;
  const link = marks.find((mark) => mark.type === "link");
  return link ? `[${out}](${link.href})` : out;
}

class Footnotes {
  private numbers = new Map<string, number>();
  private notes: string[] = [];

  marker(id: string, note: string): string {
    let number = this.numbers.get(id);
    if (number === undefined) {
      number = this.notes.push(`[^${this.notes.length + 1}]: ${note}`);
      this.numbers.set(id, number);
    }
    return `[^${number}]`;
  }

  toString(): string {
    return this.notes.join("\n");
  }
}

function inline(children: TextNode[], footnotes: Footnotes): string {
  const runs = mergeRuns(children);
  return runs
    .map((run, index) => {
      const marks = run.marks ?? [];
      const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(run.text)!;
      const written = body ? wrap(body, marks) : "";

      // A sidenote can span several runs; its number goes after the last one.
      const sidenote = marks.find((mark) => mark.type === "sidenote");
      const continues = runs[index + 1]?.marks?.some(
        (mark) => mark.type === "sidenote" && mark.id === sidenote?.id,
      );
      const note =
        sidenote && !continues ? footnotes.marker(sidenote.id, sidenote.text) : "";

      return `${lead}${written}${note}${trail}`;
    })
    .join("")
    .trim();
}

function absolute(src: string, origin: string): string {
  return src.startsWith("/") && !src.startsWith("//") ? `${origin}${src}` : src;
}

function media(node: MediaNode, origin: string): string {
  const src = absolute(node.src, origin);
  return node.kind === "video"
    ? `[${node.alt ? `Video: ${node.alt}` : "Video"}](${src})`
    : `![${node.alt ?? ""}](${src})`;
}

const caption = (value: string | undefined) => (value ? [`_${value}_`] : []);

function block(
  node: BlockNode,
  origin: string,
  footnotes: Footnotes,
): string[] {
  switch (node.type) {
    case "paragraph": {
      const body = inline(node.children, footnotes);
      return body ? [body] : [];
    }
    case "heading":
      return [`${"#".repeat(node.level)} ${inline(node.children, footnotes)}`];
    case "blockquote":
      return [
        [
          `> ${inline(node.children, footnotes)}`,
          ...(node.caption ? [">", `> — ${node.caption}`] : []),
        ].join("\n"),
      ];
    case "code_block": {
      const code = node.children.map((child) => child.text).join("");
      return [`\`\`\`${node.language ?? ""}\n${code}\n\`\`\``];
    }
    case "horizontal_rule":
      return ["---"];
    case "media":
      return [media(node, origin), ...caption(node.caption)];
    case "collection":
      return [
        ...node.items.map((item) => media(item, origin)),
        ...caption(node.caption),
      ];
    case "metric": {
      const value = `**${inline(node.children, footnotes)}**`;
      const parts = [value, node.caption, node.subtext && `(${node.subtext})`];
      return [parts.filter(Boolean).join(" ")];
    }
    case "component":
      return [
        `_Interactive demo on the page${node.caption ? `: ${node.caption}` : ""}_`,
      ];
    case "button_link": {
      const label = node.text.trim();
      return label && node.href
        ? [`[${label}](${absolute(node.href, origin)})`]
        : [];
    }
    // List items are grouped by the caller; the rest is page furniture.
    case "list_item":
    case "bullet_list_item":
    case "project_grid":
    case "social_links":
      return [];
  }
}

const BULLET_MARKERS = { check: "✓ ", cross: "✗ " } as const;

export function documentToMarkdown(
  document: Document,
  { title, origin }: MarkdownOptions,
): string {
  const footnotes = new Footnotes();
  const chunks: string[] = title ? [`# ${title}`] : [];
  const blocks = document.content;

  for (let index = 0; index < blocks.length; index++) {
    const node = blocks[index];

    if (node.type === "list_item" || node.type === "bullet_list_item") {
      // A run of items of one kind is one list, written without blank lines.
      const lines: string[] = [];
      let number = node.type === "list_item" ? (node.start ?? 1) : 0;
      while (blocks[index]?.type === node.type) {
        const item = blocks[index] as typeof node;
        const body = inline(item.children, footnotes);
        if (item.type === "list_item") {
          lines.push(`${number++}. ${body}`);
        } else {
          lines.push(`- ${item.marker ? BULLET_MARKERS[item.marker] : ""}${body}`);
        }
        index++;
      }
      index--;
      chunks.push(lines.join("\n"));
      continue;
    }

    chunks.push(...block(node, origin, footnotes));
  }

  const notes = footnotes.toString();
  if (notes) chunks.push(notes);

  return `${chunks.join("\n\n")}\n`;
}
