import { describe, expect, it } from "vitest";
import type { BlockNode, TextNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";
import { documentToMarkdown } from "../document-markdown";

const ORIGIN = "https://kartik.to";

const text = (value: string, marks?: TextNode["marks"]): TextNode => ({
  type: "text",
  text: value,
  ...(marks ? { marks } : {}),
});

const paragraph = (...children: TextNode[]): BlockNode => ({
  type: "paragraph",
  children,
});

const doc = (...content: BlockNode[]): Document => ({ type: "doc", content });

const md = (document: Document, title?: string) =>
  documentToMarkdown(document, { title, origin: ORIGIN });

describe("documentToMarkdown", () => {
  it("opens with the title as the one top-level heading", () => {
    expect(md(doc(paragraph(text("Hello."))), "A study")).toBe(
      "# A study\n\nHello.\n",
    );
  });

  it("separates blocks with a blank line", () => {
    expect(md(doc(paragraph(text("One.")), paragraph(text("Two."))))).toBe(
      "One.\n\nTwo.\n",
    );
  });

  it("writes headings at their own level", () => {
    expect(
      md(doc({ type: "heading", level: 3, children: [text("Research")] })),
    ).toBe("### Research\n");
  });

  it("spells out inline marks", () => {
    expect(
      md(
        doc(
          paragraph(
            text("bold", [{ type: "bold" }]),
            text(" "),
            text("italic", [{ type: "italic" }]),
            text(" "),
            text("code", [{ type: "code" }]),
            text(" "),
            text("gone", [{ type: "strikethrough" }]),
            text(" "),
            text("site", [{ type: "link", href: "https://example.com/" }]),
          ),
        ),
      ),
    ).toBe("**bold** _italic_ `code` ~~gone~~ [site](https://example.com/)\n");
  });

  it("drops the marks Markdown has no spelling for, keeping the words", () => {
    expect(
      md(
        doc(
          paragraph(
            text("under", [{ type: "underline" }]),
            text(" "),
            text("lit", [{ type: "highlight" }]),
          ),
        ),
      ),
    ).toBe("under lit\n");
  });

  it("keeps a mark's spaces outside its delimiters", () => {
    // `** bold**` is not bold in any Markdown reader.
    expect(md(doc(paragraph(text(" bold ", [{ type: "bold" }]))))).toBe(
      "**bold**\n",
    );
  });

  it("turns sidenotes into numbered footnotes at the end", () => {
    expect(
      md(
        doc(
          paragraph(
            text("A claim", [{ type: "sidenote", id: "a", text: "A source." }]),
            text("."),
          ),
          paragraph(text("More.")),
        ),
      ),
    ).toBe("A claim[^1].\n\nMore.\n\n[^1]: A source.\n");
  });

  it("quotes a blockquote and credits its caption", () => {
    expect(
      md(
        doc({
          type: "blockquote",
          children: [text("Ship it.")],
          caption: "A manager",
        }),
      ),
    ).toBe("> Ship it.\n>\n> — A manager\n");
  });

  it("runs consecutive list items together as one list", () => {
    expect(
      md(
        doc(
          { type: "list_item", children: [text("First")] },
          { type: "list_item", children: [text("Second")] },
          paragraph(text("After.")),
        ),
      ),
    ).toBe("1. First\n2. Second\n\nAfter.\n");
  });

  it("marks checked and crossed bullets", () => {
    expect(
      md(
        doc(
          { type: "bullet_list_item", children: [text("Plain")] },
          { type: "bullet_list_item", children: [text("Yes")], marker: "check" },
          { type: "bullet_list_item", children: [text("No")], marker: "cross" },
        ),
      ),
    ).toBe("- Plain\n- ✓ Yes\n- ✗ No\n");
  });

  it("fences code with its language", () => {
    expect(
      md(
        doc({
          type: "code_block",
          language: "tsx",
          children: [text("const a = 1;\nconst b = 2;")],
        }),
      ),
    ).toBe("```tsx\nconst a = 1;\nconst b = 2;\n```\n");
  });

  it("draws a rule", () => {
    expect(md(doc({ type: "horizontal_rule" }))).toBe("---\n");
  });

  it("describes a picture by its alt text and caption", () => {
    expect(
      md(
        doc({
          type: "media",
          kind: "image",
          src: "https://cdn.example.com/a.png",
          alt: "The old form",
          caption: "Before the redesign",
        }),
      ),
    ).toBe("![The old form](https://cdn.example.com/a.png)\n\n_Before the redesign_\n");
  });

  it("links a clip rather than embedding it", () => {
    expect(
      md(
        doc({
          type: "media",
          kind: "video",
          src: "https://cdn.example.com/a.mp4",
          alt: "A walkthrough",
        }),
      ),
    ).toBe("[Video: A walkthrough](https://cdn.example.com/a.mp4)\n");
  });

  it("makes a site-relative source absolute", () => {
    expect(
      md(doc({ type: "media", kind: "image", src: "/assets/a.png", alt: "A" })),
    ).toBe("![A](https://kartik.to/assets/a.png)\n");
  });

  it("lists every picture in a collection, then its caption", () => {
    expect(
      md(
        doc({
          type: "collection",
          items: [
            { type: "media", kind: "image", src: "/1.png", alt: "One" },
            { type: "media", kind: "image", src: "/2.png", alt: "Two" },
          ],
          caption: "Both states",
        }),
      ),
    ).toBe(
      "![One](https://kartik.to/1.png)\n\n![Two](https://kartik.to/2.png)\n\n_Both states_\n",
    );
  });

  it("states a metric with its caption and subtext", () => {
    expect(
      md(
        doc({
          type: "metric",
          children: [text("38%")],
          caption: "fewer cancellations",
          subtext: "in the first quarter",
        }),
      ),
    ).toBe("**38%** fewer cancellations (in the first quarter)\n");
  });

  it("notes an interactive component it cannot carry", () => {
    expect(
      md(doc({ type: "component", componentId: "c1", caption: "Try the parser" })),
    ).toBe("_Interactive demo on the page: Try the parser_\n");
  });

  it("leaves out the homepage's furniture and empty paragraphs", () => {
    expect(
      md(
        doc(
          paragraph(),
          { type: "social_links" },
          { type: "project_grid" },
          paragraph(text("Words.")),
        ),
      ),
    ).toBe("Words.\n");
  });
});
