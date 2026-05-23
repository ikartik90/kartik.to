// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inlineNodesToHtml, domToInlineNodes, ArticleEditor } from "../article-editor";
import type { InlineNode } from "@/domain/nodes";
import { useEditorStore } from "@/store/editor";

// ---------------------------------------------------------------------------
// Mock SVG icons and slash menu for component tests
// ---------------------------------------------------------------------------

vi.mock("@/assets/icons/subheading.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/paragraph.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/media.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/quote.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/code.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/border.svg", () => ({ default: () => null }));

vi.mock("@/components/slash-menu", () => ({
  SlashMenu: ({ onSelect, onDismiss }: { onSelect: (t: string) => void; onDismiss: () => void }) => (
    <div data-testid="slash-menu">
      <button onClick={() => onSelect("heading")}>heading</button>
      <button onClick={() => onSelect("paragraph")}>paragraph</button>
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}));

// ---------------------------------------------------------------------------
// inlineNodesToHtml
// ---------------------------------------------------------------------------

describe("inlineNodesToHtml", () => {
  it("renders plain text", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "hello" }];
    expect(inlineNodesToHtml(nodes)).toBe("hello");
  });

  it("wraps bold text in <strong>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<strong>bold</strong>");
  });

  it("wraps italic text in <em>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<em>italic</em>");
  });

  it("wraps code text in <code>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "fn()", marks: [{ type: "code" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("<code>fn()</code>");
  });

  it("escapes HTML entities in text", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "<script>&" }];
    expect(inlineNodesToHtml(nodes)).toBe("&lt;script&gt;&amp;");
  });

  it("concatenates multiple nodes", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "hello " },
      { type: "text", text: "world", marks: [{ type: "bold" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe("hello <strong>world</strong>");
  });

  it("returns empty string for empty array", () => {
    expect(inlineNodesToHtml([])).toBe("");
  });
});

// ---------------------------------------------------------------------------
// domToInlineNodes
// ---------------------------------------------------------------------------

describe("domToInlineNodes", () => {
  function parse(html: string): InlineNode[] {
    const div = document.createElement("div");
    div.innerHTML = html;
    return domToInlineNodes(div);
  }

  it("extracts a plain text node", () => {
    expect(parse("hello")).toEqual([{ type: "text", text: "hello" }]);
  });

  it("extracts bold from <strong>", () => {
    expect(parse("<strong>bold</strong>")).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
  });

  it("extracts bold from <b>", () => {
    expect(parse("<b>bold</b>")).toEqual([
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
    ]);
  });

  it("extracts italic from <em>", () => {
    expect(parse("<em>italic</em>")).toEqual([
      { type: "text", text: "italic", marks: [{ type: "italic" }] },
    ]);
  });

  it("extracts code from <code>", () => {
    expect(parse("<code>fn()</code>")).toEqual([
      { type: "text", text: "fn()", marks: [{ type: "code" }] },
    ]);
  });

  it("extracts nested marks", () => {
    const result = parse("<strong><em>both</em></strong>");
    expect(result).toEqual([
      {
        type: "text",
        text: "both",
        marks: expect.arrayContaining([{ type: "bold" }, { type: "italic" }]),
      },
    ]);
  });

  it("returns empty array for empty element", () => {
    expect(parse("")).toEqual([]);
  });

  it("ignores BR tags", () => {
    expect(parse("hello<br>world")).toEqual([
      { type: "text", text: "hello" },
      { type: "text", text: "world" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// ArticleEditor component
// ---------------------------------------------------------------------------

describe("ArticleEditor", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  it("renders the title input with placeholder 'Title'", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    expect(input).toBeDefined();
  });

  it("renders the body placeholder on the first block when body is empty", () => {
    render(<ArticleEditor />);
    const el = document.querySelector("[data-placeholder='Tell your story...']");
    expect(el).not.toBeNull();
  });

  it("populates the title from initialPost", () => {
    const post = {
      id: "p1",
      slug: "p1",
      title: "My Post",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const input = screen.getByPlaceholderText("Title") as HTMLInputElement;
    expect(input.value).toBe("My Post");
  });

  it("updates the store title when typing in the title input", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    fireEvent.change(input, { target: { value: "New title" } });
    expect(useEditorStore.getState().title).toBe("New title");
  });

  it("pressing Enter in title moves focus to first body block", () => {
    render(<ArticleEditor />);
    const input = screen.getByPlaceholderText("Title");
    const firstBlock = document.querySelector("[data-block-index='0']") as HTMLElement;
    const focusSpy = vi.spyOn(firstBlock, "focus");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(focusSpy).toHaveBeenCalled();
  });

  it("does not show the slash menu initially", () => {
    render(<ArticleEditor />);
    expect(screen.queryByTestId("slash-menu")).toBeNull();
  });

  it("Backspace at the start of a non-empty heading downgrades it to a paragraph", () => {
    const post = {
      id: "h1",
      slug: "h1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Hello" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    expect(block).not.toBeNull();

    block.focus();
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(block, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
    expect(
      "children" in blocks[0] &&
        blocks[0].children.some((n) => "text" in n && n.text === "Hello")
    ).toBe(true);
  });

  it("Backspace at the start of a non-empty blockquote downgrades it to a paragraph", () => {
    const post = {
      id: "bq1",
      slug: "bq1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(block, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
  });

  it("Enter on a heading splits into two headings of the same level", () => {
    const post = {
      id: "h2",
      slug: "h2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Hello World" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    // Place caret after "Hello " (offset 6 in the text node)
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 6);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // Original block keeps its type
    expect(blocks[0].type).toBe("heading");
    expect((blocks[0] as { level: number }).level).toBe(2);
    // New block inherits the heading type and level
    expect(blocks[1].type).toBe("heading");
    expect((blocks[1] as { level: number }).level).toBe(2);
  });

  it("Enter on a blockquote splits into two blockquotes", () => {
    const post = {
      id: "bq2",
      slug: "bq2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [{ type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] }],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    const textNode = block.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, 1);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("blockquote");
    expect(blocks[1].type).toBe("blockquote");
  });
});
