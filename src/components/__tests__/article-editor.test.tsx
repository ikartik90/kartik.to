// @vitest-environment jsdom
import React, { type ReactNode } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  inlineNodesToHtml,
  domToInlineNodes,
  stripEmptySidenoteWrappers,
  renumberSidenoteSups,
  ArticleEditor,
  transformMarksInRange,
  rangeHasMark,
  findLinkRangeAt,
  findSidenoteRangeAt,
  mergeAdjacentInlineNodes,
  normalizeLinkHref,
} from "../article-editor";
import type { InlineNode, Mark, MediaNode } from "@/domain/nodes";
import type { Document } from "@/domain/post";
import { useEditorStore } from "@/store/editor";
import { notifyContentUpdated } from "@/utils/content-sync";
import { createDraft, saveDraft } from "@/app/actions/post";

// ---------------------------------------------------------------------------
// Mock SVG icons and slash menu for component tests
// ---------------------------------------------------------------------------

vi.mock("@/assets/icons/subheading.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/paragraph.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/media.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/quote.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/code.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/border.svg", () => ({ default: () => null }));
vi.mock("@/assets/icons/trash.svg", () => ({ default: () => null }));

vi.mock("@/components/slash-menu", () => ({
  SlashMenu: ({
    onSelect,
    onDismiss,
  }: {
    onSelect: (t: string) => void;
    onDismiss: () => void;
  }) => (
    <div data-testid="slash-menu">
      <button onClick={() => onSelect("heading")}>heading</button>
      <button onClick={() => onSelect("paragraph")}>paragraph</button>
      <button onClick={() => onSelect("media")}>media</button>
      <button onClick={() => onSelect("collection")}>collection</button>
      <button onClick={() => onSelect("list_item")}>list_item</button>
      <button onClick={() => onSelect("bullet_list_item")}>bullet_list_item</button>
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
  slashMenuHasResults: () => true,
}));

// Two instances are mounted (single-image and collection); only one is ever
// open, and `data-selection-mode` is what tells them apart in assertions.
vi.mock("@/components/image-insert-dialog", () => ({
  ImageInsertDialog: ({
    open,
    mode,
    selectionMode,
    maxSelection,
    onClose,
    onInsert,
  }: {
    open: boolean;
    mode?: "insert" | "change";
    selectionMode?: "single" | "multiple";
    maxSelection?: number;
    onClose: () => void;
    onInsert: (payload: never) => void;
  }) =>
    open ? (
      <div
        data-testid="image-dialog"
        data-mode={mode ?? "insert"}
        data-selection-mode={selectionMode ?? "single"}
        data-max-selection={maxSelection}
      >
        <button onClick={onClose}>close</button>
        <button
          onClick={() =>
            onInsert(
              (selectionMode === "multiple"
                ? [
                    { kind: "image", src: "https://cdn/1.png" },
                    { kind: "image", src: "https://cdn/2.png" },
                    { kind: "image", src: "https://cdn/3.png" },
                    { kind: "image", src: "https://cdn/4.png" },
                  ]
                : { kind: "image", src: "https://cdn/1.png" }) as never,
            )
          }
        >
          insert
        </button>
        {/* The library holds clips too, and the dialog reads their kind off
            the stored content type rather than off the url — so the src here
            carries no extension, and a handler that re-derived the kind from
            it would come back with the wrong answer. */}
        <button
          onClick={() =>
            onInsert(
              (selectionMode === "multiple"
                ? [{ kind: "video", src: "https://cdn/8f2c-key" }]
                : { kind: "video", src: "https://cdn/8f2c-key" }) as never,
            )
          }
        >
          insert clip
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/demo-frame", () => ({
  DemoFrame: ({
    children,
    ...props
  }: {
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <div data-testid="demo-frame" {...props}>
      {children}
    </div>
  ),
}));

const demoRegistryEntry = vi.hoisted(() => ({
  id: "calchemy-demo",
  label: "Calchemy Demo",
  load: async () =>
    function Demo() {
      return (
        <button
          type="button"
          data-testid="demo-interact"
          onClick={() => undefined}
        >
          Demo
        </button>
      );
    },
}));

vi.mock("@/components/demo/registry", () => ({
  getDemoComponent: () => demoRegistryEntry,
  demoComponents: [demoRegistryEntry],
}));

// The editor imports server actions (⌘S save) and the router — stub both so the
// component renders under jsdom without pulling in Prisma / the app router.
const mockRouter = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/edit/new",
}));

const postActions = vi.hoisted(() => ({
  createDraft: vi.fn(),
  saveDraft: vi.fn(),
}));
vi.mock("@/app/actions/post", () => postActions);

// Stubbed so the collection tests can assert what the editor NEVER calls: a
// picture is a reference, and dropping the reference must not touch the object
// the rest of the site may still be pointing at. See the removal test below.
const mediaActions = vi.hoisted(() => ({
  listMediaAssets: vi.fn(async () => []),
  createMediaUploadUrl: vi.fn(),
  updateMediaAlt: vi.fn(),
  updateMediaFilename: vi.fn(),
  deleteMedia: vi.fn(),
}));
vi.mock("@/app/actions/media", () => mediaActions);

vi.mock("@/utils/content-sync", () => ({
  notifyContentUpdated: vi.fn(),
  subscribeContentUpdated: () => () => {},
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
    expect(inlineNodesToHtml(nodes)).toBe(
      '<code class="inline-code">fn()</code>',
    );
  });

  it("wraps highlighted text in <mark>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "note", marks: [{ type: "highlight" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">note</mark>',
    );
  });

  it("coalesces a styled sub-span within a highlight into a single <mark>", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "hello ", marks: [{ type: "highlight" }] },
      {
        type: "text",
        text: "world",
        marks: [{ type: "highlight" }, { type: "italic" }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">hello <em>world</em></mark>',
    );
  });

  it("extracts highlight as the outer wrapper regardless of mark order", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "x",
        marks: [{ type: "italic" }, { type: "highlight" }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight"><em>x</em></mark>',
    );
  });

  it("keeps non-adjacent highlights in separate marks", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "a", marks: [{ type: "highlight" }] },
      { type: "text", text: "b" },
      { type: "text", text: "c", marks: [{ type: "highlight" }] },
    ];
    expect(inlineNodesToHtml(nodes)).toBe(
      '<mark class="article-highlight">a</mark>b<mark class="article-highlight">c</mark>',
    );
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

  it("wraps a sidenote run in a dotted span with an anchor-name and a numbered superscript", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "term",
        marks: [{ type: "sidenote", id: "abc", text: "a note" }],
      },
    ];
    // base 0 → the block's first note is ordinal 1. The annotated text sits in
    // its own underlined span so the ordinal, a plain inline that follows it,
    // can never be broken onto a line of its own.
    expect(inlineNodesToHtml(nodes)).toBe(
      '<span class="article-sidenote" data-sidenote-id="abc"' +
        ' data-sidenote-text="a note" style="anchor-name:--sn-abc">' +
        '<span class="article-sidenote-text">term</span>' +
        '<sup class="article-sidenote-ref" contenteditable="false" aria-hidden="true"' +
        ' data-sidenote-number="1"></sup></span>',
    );
  });

  it("offsets note ordinals by the block base and increments within the block", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "a", marks: [{ type: "sidenote", id: "x", text: "" }] },
      { type: "text", text: " and " },
      { type: "text", text: "b", marks: [{ type: "sidenote", id: "y", text: "" }] },
    ];
    const html = inlineNodesToHtml(nodes, 4);
    expect(html).toContain('data-sidenote-id="x"');
    expect(html.match(/data-sidenote-number="(\d+)"/g)).toEqual([
      'data-sidenote-number="5"',
      'data-sidenote-number="6"',
    ]);
  });

  it("coalesces contiguous runs of one sidenote into a single span", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "hello ",
        marks: [{ type: "sidenote", id: "x", text: "n" }],
      },
      {
        type: "text",
        text: "world",
        marks: [{ type: "sidenote", id: "x", text: "n" }, { type: "bold" }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toContain(
      '<span class="article-sidenote" data-sidenote-id="x"',
    );
    // A single wrapper (one <sup>) with the bold nested inside.
    const html = inlineNodesToHtml(nodes);
    expect(html.match(/<sup/g)?.length).toBe(1);
    expect(html).toContain("hello <strong>world</strong>");
  });

  it("keeps two adjacent sidenotes with different ids in separate spans", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "a",
        marks: [{ type: "sidenote", id: "1", text: "one" }],
      },
      {
        type: "text",
        text: "b",
        marks: [{ type: "sidenote", id: "2", text: "two" }],
      },
    ];
    expect(inlineNodesToHtml(nodes).match(/<sup/g)?.length).toBe(2);
  });

  it("escapes the note text in the data attribute", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "t",
        marks: [{ type: "sidenote", id: "i", text: 'a "quoted" & <tag>' }],
      },
    ];
    expect(inlineNodesToHtml(nodes)).toContain(
      'data-sidenote-text="a &quot;quoted&quot; &amp; &lt;tag&gt;"',
    );
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

  it("extracts highlight from <mark>", () => {
    expect(parse("<mark>note</mark>")).toEqual([
      { type: "text", text: "note", marks: [{ type: "highlight" }] },
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

  it("extracts a sidenote (id + text) from its wrapper span and drops the <sup>", () => {
    expect(
      parse(
        '<span data-sidenote-id="abc" data-sidenote-text="a note">term' +
          '<sup class="article-sidenote-ref" contenteditable="false"></sup></span>',
      ),
    ).toEqual([
      {
        type: "text",
        text: "term",
        marks: [{ type: "sidenote", id: "abc", text: "a note" }],
      },
    ]);
  });

  it("round-trips a sidenote through inlineNodesToHtml → domToInlineNodes", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "before " },
      {
        type: "text",
        text: "annotated",
        marks: [{ type: "sidenote", id: "n1", text: "the note" }],
      },
      { type: "text", text: " after" },
    ];
    expect(parse(inlineNodesToHtml(nodes))).toEqual(nodes);
  });

  it("round-trips a multi-paragraph sidenote (paragraph breaks are newlines)", () => {
    const nodes: InlineNode[] = [
      {
        type: "text",
        text: "annotated",
        marks: [{ type: "sidenote", id: "n1", text: "first\nsecond" }],
      },
    ];
    expect(parse(inlineNodesToHtml(nodes))).toEqual(nodes);
  });
});

// ---------------------------------------------------------------------------
// stripEmptySidenoteWrappers
// ---------------------------------------------------------------------------

describe("stripEmptySidenoteWrappers", () => {
  function make(html: string): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }

  const annotated = (id: string, text: string) =>
    `<span class="article-sidenote" data-sidenote-id="${id}" data-sidenote-text="n">${text}` +
    `<sup class="article-sidenote-ref" contenteditable="false"></sup></span>`;

  it("removes a sidenote wrapper left empty by deleting its text (with its <sup>)", () => {
    const el = make(`a ${annotated("x", "")} b`);
    expect(el.querySelectorAll("[data-sidenote-id]").length).toBe(1);
    expect(el.querySelectorAll("sup").length).toBe(1);

    expect(stripEmptySidenoteWrappers(el)).toBe(true);

    expect(el.querySelectorAll("[data-sidenote-id]").length).toBe(0);
    expect(el.querySelectorAll("sup").length).toBe(0);
    expect(el.textContent).toBe("a  b");
  });

  it("keeps wrappers that still have annotated text, and reports no change", () => {
    const el = make(`a ${annotated("x", "kept")} b`);
    expect(stripEmptySidenoteWrappers(el)).toBe(false);
    expect(el.querySelectorAll("[data-sidenote-id]").length).toBe(1);
    expect(el.querySelector("[data-sidenote-id]")?.textContent).toBe("kept");
  });

  it("removes only the emptied note when others remain (so ordinals can decrement)", () => {
    const el = make(`${annotated("a", "")} then ${annotated("b", "second")}`);
    stripEmptySidenoteWrappers(el);
    const remaining = el.querySelectorAll("[data-sidenote-id]");
    expect(remaining.length).toBe(1);
    expect(remaining[0].getAttribute("data-sidenote-id")).toBe("b");
    // One wrapper left in the DOM.
    expect(el.querySelectorAll("sup").length).toBe(1);
  });
});

describe("renumberSidenoteSups", () => {
  function make(html: string): HTMLElement {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div;
  }
  const annotated = (id: string, text: string) =>
    `<span class="article-sidenote" data-sidenote-id="${id}">${text}` +
    `<sup class="article-sidenote-ref"></sup></span>`;

  const numbers = (el: HTMLElement) =>
    Array.from(el.querySelectorAll(".article-sidenote-ref")).map((s) =>
      s.getAttribute("data-sidenote-number"),
    );

  it("numbers a block's superscripts from base + 1 in DOM order", () => {
    const el = make(`${annotated("a", "x")} and ${annotated("b", "y")}`);
    renumberSidenoteSups(el, 3);
    expect(numbers(el)).toEqual(["4", "5"]);
  });

  it("re-numbers after a note is removed so later ones decrement", () => {
    const el = make(
      `${annotated("a", "x")} ${annotated("b", "y")} ${annotated("c", "z")}`,
    );
    el.querySelector('[data-sidenote-id="a"]')!.remove();
    renumberSidenoteSups(el, 0);
    expect(numbers(el)).toEqual(["1", "2"]);
  });
});

// ---------------------------------------------------------------------------
// ArticleEditor component
// ---------------------------------------------------------------------------

function openSlashMenuOnBlock(block: HTMLElement) {
  block.focus();
  block.textContent = "/";
  const textNode = block.firstChild!;
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.setStart(textNode, 1);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  fireEvent.keyUp(block, { key: "/" });
}

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
    const title = screen.getByLabelText("Title");
    expect(title.getAttribute("data-placeholder")).toBe("Title");
  });

  it("renders the body placeholder on the first block when body is empty", () => {
    render(<ArticleEditor />);
    const el = document.querySelector("[data-placeholder='Tell your story...']");
    expect(el).not.toBeNull();
  });

  it("renders the body placeholder on the first block when body is empty", () => {
    render(<ArticleEditor />);
    const el = document.querySelector("[data-placeholder='Tell your story...']");
    expect(el).not.toBeNull();
  });

  it("updates the code block language from the editor select", () => {
    const post = {
      id: "code1",
      slug: "code1",
      title: "Code Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "code_block" as const,
            children: [{ type: "text" as const, text: "const x = 1;" }],
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const select = screen.getByLabelText("Code language") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "typescript" } });

    expect(select.value).toBe("typescript");
  });

  it("appends a trailing paragraph after a terminal code block", () => {
    const post = {
      id: "code2",
      slug: "code2",
      title: "Code Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "code_block" as const,
            children: [{ type: "text" as const, text: "const x = 1;" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    // A code block is the last authored block; Enter inside it inserts a literal
    // newline, so the editor must synthesise an empty paragraph to escape into.
    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("code_block");
    expect(blocks[1].type).toBe("paragraph");
    expect((blocks[1] as { children: InlineNode[] }).children[0].text).toBe("");
  });

  // Regression: code blocks carry 32px (3xl) vertical padding — larger than the
  // ~24px code line height. Line detection used to measure the caret against the
  // element's border-box edge with a one-line tolerance, so the boundary line
  // fell outside the band and ArrowUp/ArrowDown could never leave the block.
  // Detection now measures against the content box (padding subtracted).
  describe("padded code block caret escape", () => {
    const rect = (top: number, bottom: number): DOMRect =>
      ({
        top,
        bottom,
        height: bottom - top,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;

    // Border box 0..100 with 32px vertical padding → content box 32..68.
    const mockGeometry = (pre: HTMLElement, caret: DOMRect) => {
      pre.getBoundingClientRect = () => rect(0, 100);
      const realGetComputedStyle = window.getComputedStyle.bind(window);
      vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) =>
        el === pre
          ? ({ paddingTop: "32px", paddingBottom: "32px" } as CSSStyleDeclaration)
          : realGetComputedStyle(el as Element, pseudo),
      );
      vi.spyOn(window, "getSelection").mockReturnValue({
        rangeCount: 1,
        getRangeAt: () => ({ getBoundingClientRect: () => caret }),
        removeAllRanges: () => {},
        addRange: () => {},
      } as unknown as Selection);
    };

    afterEach(() => vi.restoreAllMocks());

    it("ArrowDown on the last visual line escapes to the block below", () => {
      const post = {
        id: "cbnav1",
        slug: "cbnav1",
        title: "Code Nav",
        category: "ARTICLE" as const,
        content: {
          type: "doc" as const,
          content: [
            {
              type: "code_block" as const,
              children: [{ type: "text" as const, text: "const x = 1;" }],
            },
            { type: "paragraph" as const, children: [{ type: "text" as const, text: "after" }] },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(<ArticleEditor initialPost={post} />);

      const pre = document.querySelector("[data-block-index='0']") as HTMLElement;
      const next = document.querySelector("[data-block-index='1']") as HTMLElement;
      // Caret bottom (68) sits at the content-box bottom, 32px above the border
      // edge — the geometry the old border-box check misread as "not last line".
      mockGeometry(pre, rect(44, 68));

      pre.focus();
      fireEvent.keyDown(pre, { key: "ArrowDown" });

      expect(document.activeElement).toBe(next);
    });

    it("ArrowUp on the first visual line escapes to the block above", () => {
      const post = {
        id: "cbnav2",
        slug: "cbnav2",
        title: "Code Nav",
        category: "ARTICLE" as const,
        content: {
          type: "doc" as const,
          content: [
            { type: "paragraph" as const, children: [{ type: "text" as const, text: "before" }] },
            {
              type: "code_block" as const,
              children: [{ type: "text" as const, text: "const x = 1;" }],
            },
          ],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      render(<ArticleEditor initialPost={post} />);

      const prev = document.querySelector("[data-block-index='0']") as HTMLElement;
      const pre = document.querySelector("[data-block-index='1']") as HTMLElement;
      // Caret top (32) sits at the content-box top, 32px below the border edge.
      mockGeometry(pre, rect(32, 56));

      pre.focus();
      fireEvent.keyDown(pre, { key: "ArrowUp" });

      expect(document.activeElement).toBe(prev);
    });
  });

  it("renders a figcaption with placeholder on image blocks", () => {
    const post = {
      id: "img1",
      slug: "img1",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
            alt: "Example photo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
    expect(document.querySelector("figure img")?.getAttribute("src")).toBe(
      "https://example.com/photo.png",
    );
  });

  it("renders a figcaption with placeholder on component blocks", async () => {
    const post = {
      id: "comp1",
      slug: "comp1",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
    expect(await screen.findByTestId("demo-interact")).toBeDefined();
    expect(document.querySelector("[inert]")).not.toBeNull();
  });

  it("does not allow interacting with the demo preview in edit mode", async () => {
    const post = {
      id: "comp2",
      slug: "comp2",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const demoButton = await screen.findByTestId("demo-interact");
    const clickSpy = vi.spyOn(demoButton, "click");

    fireEvent.click(demoButton);

    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("shows delete action when the component block is focused", () => {
    const post = {
      id: "comp3",
      slug: "comp3",
      title: "Component Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "component" as const,
            componentId: "calchemy-demo",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const showcaseMedia = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(showcaseMedia);

    expect(screen.getByRole("button", { name: "Delete component" })).toBeDefined();
  });

  it("shows delete action when the horizontal rule is focused", () => {
    const post = {
      id: "hr1",
      slug: "hr1",
      title: "HR Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "horizontal_rule" as const },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const hr = document.querySelector("[role='separator']") as HTMLElement;
    fireEvent.focus(hr);

    expect(screen.getByRole("button", { name: "Delete horizontal rule" })).toBeDefined();
  });

  it("inserts a paragraph before the horizontal rule when Enter is pressed", () => {
    const post = {
      id: "hr-enter-before",
      slug: "hr-enter-before",
      title: "HR Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "horizontal_rule" as const },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const hr = document.querySelector("[role='separator']") as HTMLElement;
    hr.focus();
    fireEvent.keyDown(hr, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("horizontal_rule");
    expect(blocks[2].type).toBe("paragraph");
  });

  it("updates the image caption in the store when typing in figcaption", () => {
    const post = {
      id: "img2",
      slug: "img2",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    caption.textContent = "A sunny day";
    fireEvent.input(caption);

    const imageBlock = useEditorStore.getState().document.content[0];
    expect(imageBlock.type).toBe("media");
    if (imageBlock.type === "media") {
      expect(imageBlock.caption).toBe("A sunny day");
    }
  });

  it("does not delete the image block when pressing Delete in figcaption", () => {
    const post = {
      id: "img3",
      slug: "img3",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Keep me",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Delete" });

    expect(useEditorStore.getState().document.content[0]?.type).toBe("media");
    expect(document.querySelector("figure img")).not.toBeNull();
  });

  it("renders the focus overlay only over the image, not the caption", () => {
    const post = {
      id: "img4",
      slug: "img4",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const figure = document.querySelector("figure[data-showcase-block]") as HTMLElement;
    const img = figure.querySelector("img") as HTMLElement;
    fireEvent.focus(img);

    const overlay = figure.querySelector("[aria-hidden='true']");
    const caption = figure.querySelector("figcaption");
    expect(overlay).not.toBeNull();
    expect(caption?.contains(overlay)).toBe(false);
  });

  it("inserts a paragraph before the figure when Enter is pressed on showcase media", () => {
    const post = {
      id: "img-enter-before",
      slug: "img-enter-before",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("media");
    expect(blocks[2].type).toBe("paragraph");
  });

  it("moves focus from image to caption on ArrowDown", () => {
    const post = {
      id: "img5",
      slug: "img5",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "ArrowDown" });

    expect(document.activeElement).toBe(caption);
  });

  it("moves focus from image to caption on ArrowDown, but swallows Tab", () => {
    const post = {
      id: "img5b",
      slug: "img5b",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;

    // Tab is swallowed — it must not move the caret into the caption.
    img.focus();
    const notPrevented = fireEvent.keyDown(img, { key: "Tab" });
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(img);

    // ArrowDown still descends into the caption.
    fireEvent.keyDown(img, { key: "ArrowDown" });
    expect(document.activeElement).toBe(caption);
  });

  it("inserts a paragraph after the figure when Enter is pressed in the caption", () => {
    const post = {
      id: "img-enter-after",
      slug: "img-enter-after",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Caption",
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Next block" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("media");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[2].type).toBe("paragraph");
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
    if (blocks[2].type === "paragraph") {
      expect(blocks[2].children[0]?.type === "text" && blocks[2].children[0].text).toBe(
        "Next block",
      );
    }
  });

  it("focuses the trailing paragraph when Enter is pressed in the caption on the last figure", async () => {
    const post = {
      id: "img-enter-trailing",
      slug: "img-enter-trailing",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    const trailingParagraph = document.querySelector(
      "p[data-block-index='1']",
    ) as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("media");
    expect(blocks[1].type).toBe("paragraph");
    expect(document.activeElement).toBe(trailingParagraph);
  });

  it("adds a hard line break in the caption on Shift+Enter", () => {
    const execCommand = vi.fn();
    document.execCommand = execCommand;

    const post = {
      id: "img-shift-enter",
      slug: "img-shift-enter",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter", shiftKey: true });

    expect(execCommand).toHaveBeenCalledWith("insertLineBreak");
  });

  it("moves focus from caption to image on ArrowUp at start", () => {
    const post = {
      id: "img6",
      slug: "img6",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Caption",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(caption);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(caption, { key: "ArrowUp" });

    expect(document.activeElement).toBe(img);
  });

  it("moves focus from empty caption to image on ArrowLeft at start", () => {
    const post = {
      id: "img8",
      slug: "img8",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    const caption = document.querySelector("figcaption") as HTMLElement;
    caption.focus();

    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(caption, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(caption, { key: "ArrowLeft" });

    expect(document.activeElement).toBe(img);
  });

  it("deletes the image block when pressing Delete on the image", () => {
    const post = {
      id: "img7",
      slug: "img7",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
            caption: "Gone",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    img.focus();
    fireEvent.keyDown(img, { key: "Delete" });

    expect(useEditorStore.getState().document.content[0]?.type).toBe("paragraph");
    expect(document.querySelector("figure")).toBeNull();
  });

  it("shows change and delete actions when the image is focused", () => {
    const post = {
      id: "img9",
      slug: "img9",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(img);

    expect(screen.getByRole("button", { name: "Change Image..." })).toBeDefined();
    expect(screen.getByRole("button", { name: "Delete image" })).toBeDefined();
  });

  it("opens the image dialog in change mode from the overlay action", () => {
    const post = {
      id: "img10",
      slug: "img10",
      title: "Image Post",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "media" as const,
            kind: "image" as const,
            src: "https://example.com/photo.png",
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const img = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(img);
    fireEvent.click(screen.getByRole("button", { name: "Change Image..." }));

    const dialog = screen.getByTestId("image-dialog");
    expect(dialog.getAttribute("data-mode")).toBe("change");
  });

  // ---------------------------------------------------------------------------
  // Clips as article blocks
  //
  // The whole return on separating the block's IDENTITY from the file's FORMAT.
  // Every predicate in the editor asks `block.type === "media"`, and `type` is
  // the same word on a clip as on a photograph, so a clip arrives already
  // editable: the caption, the traversal, the overlay and the delete all work
  // without one of them having heard of `kind`. These lock that in — if any of
  // them ever narrows to a kind, one of these goes red.
  // ---------------------------------------------------------------------------

  const clipPost = () => ({
    id: "clip1",
    slug: "clip1",
    title: "Clip Post",
    category: "ARTICLE" as const,
    content: {
      type: "doc" as const,
      content: [
        {
          type: "media" as const,
          kind: "video" as const,
          // Extensionless on purpose: the block's own `kind` is the only thing
          // that can answer for this src.
          src: "https://cdn/8f2c-key",
        },
        {
          type: "paragraph" as const,
          children: [{ type: "text" as const, text: "" }],
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // The editor painted this block with a raw <img> of its own, and that was
  // survivable only for as long as a clip could not be authored deliberately:
  // an mp4 reached the document as `type: "image"` because nothing recorded
  // otherwise, so the broken picture was a thing you had to go out of your way
  // to produce. Now the block STATES its kind and the insert dialog offers
  // clips, so an author can make one in two clicks and would have been looking
  // straight at the broken picture on the very canvas that promises to show
  // what will be published. The fork is `Media`'s — the reader's block, the
  // tile, the lightbox and the library's own preview all ask it — and the
  // editor asking the same question is the only thing that keeps the canvas
  // and the article agreeing about what a source is.
  it("shows a clip block as the clip it is, not a broken picture", () => {
    render(<ArticleEditor initialPost={clipPost()} />);

    const clip = document.querySelector("figure video");
    expect(clip).not.toBeNull();
    expect(clip?.getAttribute("src")).toBe("https://cdn/8f2c-key");
    expect(document.querySelector("figure img")).toBeNull();
  });

  it("captions a clip block exactly as it captions a picture", () => {
    render(<ArticleEditor initialPost={clipPost()} />);

    const caption = document.querySelector(
      "figcaption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    expect(caption).not.toBeNull();
    caption.textContent = "The flow, end to end";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("media");
    if (block.type === "media") {
      expect(block.kind).toBe("video");
      expect(block.caption).toBe("The flow, end to end");
    }
  });

  // Routing the block through `Media` moves the element out of the editor's own
  // JSX, and the figure's entire keyboard model hangs off that element: it is
  // the tab stop, the overlay keys on its focus, the caret keys are read from
  // it, and `focusBlockAtStart` reaches the block by querying
  // `[data-showcase-media]` and focusing whatever answers. Put the contract on
  // a box around the media instead and every one of those still "works" while
  // the clip itself quietly stops being the thing that takes focus — so this
  // asserts WHICH element carries it, not merely that something does.
  it("hands a clip the same focus and keyboard contract a picture had", () => {
    render(<ArticleEditor initialPost={clipPost()} />);

    const media = document.querySelector("[data-showcase-media]") as HTMLElement;
    expect(media.tagName).toBe("VIDEO");
    expect(media.tabIndex).toBe(0);

    // Focus is what raises the overlay — the block has no caret of its own, so
    // this is the only thing that says "you are on this block".
    fireEvent.focus(media);
    expect(screen.getByRole("button", { name: "Change Image..." })).not.toBeNull();

    // And the caret keys reach the figure's handler from the clip itself.
    fireEvent.keyDown(media, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      document.querySelector("figcaption[data-placeholder='Add caption...']"),
    );

    fireEvent.blur(media);
    expect(screen.queryByRole("button", { name: "Change Image..." })).toBeNull();
  });

  it("deletes a clip block from the overlay, as it does a picture", () => {
    render(<ArticleEditor initialPost={clipPost()} />);

    const media = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(media);
    fireEvent.click(screen.getByRole("button", { name: "Delete image" }));

    expect(
      useEditorStore
        .getState()
        .document.content.some((block) => block.type === "media"),
    ).toBe(false);
  });

  // The insert path's own contribution: the kind comes off the upload's
  // content type and is written down, so an extensionless key survives into
  // the document as a clip rather than being guessed back into a picture.
  it("writes an inserted clip's kind, taking the dialog at its word", () => {
    render(<ArticleEditor initialPost={clipPost()} />);

    const media = document.querySelector("[data-showcase-media]") as HTMLElement;
    fireEvent.focus(media);
    fireEvent.click(screen.getByRole("button", { name: "Change Image..." }));
    fireEvent.click(screen.getByText("insert clip"));

    expect(useEditorStore.getState().document.content[0]).toEqual({
      type: "media",
      kind: "video",
      src: "https://cdn/8f2c-key",
    });
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
    // The title is a contentEditable <h1>, seeded via innerHTML by an effect.
    const title = screen.getByLabelText("Title");
    expect(title.textContent).toBe("My Post");
  });

  it("updates the store title when typing in the title input", () => {
    render(<ArticleEditor />);
    const title = screen.getByLabelText("Title");
    // onInput reads e.currentTarget.innerText (a jsdom expando).
    title.innerText = "New title";
    fireEvent.input(title);
    expect(useEditorStore.getState().title).toBe("New title");
  });

  it("pressing Enter in title moves focus to first body block", () => {
    render(<ArticleEditor />);
    const title = screen.getByLabelText("Title");
    const firstBlock = document.querySelector("[data-block-index='0']") as HTMLElement;
    const focusSpy = vi.spyOn(firstBlock, "focus");
    fireEvent.keyDown(title, { key: "Enter" });
    expect(focusSpy).toHaveBeenCalled();
  });

  it("does not show the slash menu initially", () => {
    render(<ArticleEditor />);
    expect(screen.queryByTestId("slash-menu")).toBeNull();
  });

  it("removes the slash trigger when a slash-menu item is selected", () => {
    render(<ArticleEditor />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    expect(screen.getByTestId("slash-menu")).toBeDefined();

    fireEvent.click(screen.getByText("media"));
    expect(screen.getByTestId("image-dialog")).toBeDefined();
    expect(block.textContent).toBe("");

    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("image-dialog")).toBeNull();
    expect(block.textContent).toBe("");
  });

  it("keeps the slash when the slash menu is dismissed", () => {
    render(<ArticleEditor />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    expect(screen.getByTestId("slash-menu")).toBeDefined();

    fireEvent.click(screen.getByText("dismiss"));
    expect(screen.queryByTestId("slash-menu")).toBeNull();
    expect(block.textContent).toBe("/");
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

  it("Enter on a heading splits into a heading and a paragraph", () => {
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
    // New block is a default paragraph, not another heading
    expect(blocks[1].type).toBe("paragraph");
  });

  it("⌘B toggles bold on and off over the selection", () => {
    const post = {
      id: "cb",
      slug: "cb",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Hello World" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    const firstText = (root: Node): Text => {
      if (root.nodeType === Node.TEXT_NODE) return root as Text;
      return firstText(root.firstChild!);
    };
    const selectHello = () => {
      block.focus();
      // The first text node holds "Hello" in both the plain and bolded states
      // (bolded: <strong>Hello</strong> World; plain: "Hello World").
      const textNode = firstText(block);
      const sel = window.getSelection()!;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 5); // "Hello"
      sel.removeAllRanges();
      sel.addRange(range);
    };

    // First ⌘B applies bold to "Hello".
    selectHello();
    fireEvent.keyDown(block, { key: "b", metaKey: true });
    let children = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    expect(children[0]).toEqual({
      type: "text",
      text: "Hello",
      marks: [{ type: "bold" }],
    });

    // Second ⌘B over the same selection removes it (toggle off).
    selectHello();
    fireEvent.keyDown(block, { key: "b", metaKey: true });
    children = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    expect(children[0].marks).toBeUndefined();
    expect(children[0].text).toBe("Hello World");
  });

  it("Backspace on an empty paragraph keeps the following paragraph intact", () => {
    const post = {
      id: "del",
      slug: "del",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Sub" }],
          },
          { type: "paragraph" as const, children: [{ type: "text" as const, text: "" }] },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Following" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    // Focus the empty paragraph (index 1) and delete it with Backspace.
    const empty = document.querySelector("[data-block-index='1']") as HTMLElement;
    empty.focus();
    fireEvent.keyDown(empty, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    // Only the empty paragraph is removed — heading + following paragraph remain.
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("heading");
    expect(blocks[1].type).toBe("paragraph");
    expect((blocks[1] as { children: InlineNode[] }).children[0].text).toBe(
      "Following",
    );
    // The reused DOM node must show the following paragraph's text, not the
    // deleted paragraph's stale empty content.
    const followingEl = document.querySelector(
      "[data-block-index='1']",
    ) as HTMLElement;
    expect(followingEl.textContent).toBe("Following");
  });

  it("Enter on a blockquote splits into a blockquote and a paragraph", () => {
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
    expect(blocks[1].type).toBe("paragraph");
  });

  it("renders a subheading eyebrow caption with an 'Add caption...' placeholder", () => {
    const post = {
      id: "h-cap1",
      slug: "h-cap1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Section" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    );
    expect(caption).not.toBeNull();
  });

  it("updates the heading caption in the store when typing in the eyebrow", () => {
    const post = {
      id: "h-cap2",
      slug: "h-cap2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "heading" as const, level: 2 as const, children: [{ type: "text" as const, text: "Section" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    caption.textContent = "Chapter One";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("heading");
    if (block.type === "heading") {
      expect(block.caption).toBe("Chapter One");
    }
  });

  it("clears the heading caption from the store when the eyebrow is emptied", () => {
    const post = {
      id: "h-cap3",
      slug: "h-cap3",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Section" }],
            caption: "Chapter One",
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      ".article-subheading-caption[data-placeholder='Add caption...']",
    ) as HTMLElement;
    // Clear both innerText and textContent — jsdom stores innerText separately.
    caption.innerText = "";
    caption.textContent = "";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("heading");
    if (block.type === "heading") {
      expect(block.caption).toBeUndefined();
    }
  });

  it("renders a blockquote citation caption with an 'Add citation...' placeholder", () => {
    const post = {
      id: "bq-cap1",
      slug: "bq-cap1",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    );
    expect(caption).not.toBeNull();
  });

  it("updates the blockquote caption in the store when typing in the citation", () => {
    const post = {
      id: "bq-cap2",
      slug: "bq-cap2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "blockquote" as const, children: [{ type: "text" as const, text: "A quote" }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    caption.textContent = "Ada Lovelace";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("blockquote");
    if (block.type === "blockquote") {
      expect(block.caption).toBe("Ada Lovelace");
    }
  });

  it("clears the blockquote caption from the store when the citation is emptied", () => {
    const post = {
      id: "bq-cap3",
      slug: "bq-cap3",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "blockquote" as const,
            children: [{ type: "text" as const, text: "A quote" }],
            caption: "Ada Lovelace",
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    // Clear both innerText and textContent — jsdom stores innerText separately.
    caption.innerText = "";
    caption.textContent = "";
    fireEvent.input(caption);

    const block = useEditorStore.getState().document.content[0];
    expect(block.type).toBe("blockquote");
    if (block.type === "blockquote") {
      expect(block.caption).toBeUndefined();
    }
  });

  it("inserts a paragraph after the blockquote when Enter is pressed in the citation caption", () => {
    const post = {
      id: "bq-cap-enter",
      slug: "bq-cap-enter",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "blockquote" as const,
            children: [{ type: "text" as const, text: "A quote" }],
            caption: "Ada Lovelace",
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Next block" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);

    const caption = document.querySelector(
      "cite[data-placeholder='Add citation...']",
    ) as HTMLElement;
    caption.focus();
    fireEvent.keyDown(caption, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("blockquote");
    expect(blocks[1].type).toBe("paragraph");
    expect(blocks[2].type).toBe("paragraph");
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
  });

  it("inserts a paragraph above when Enter is pressed at the start of a paragraph", () => {
    const post = {
      id: "p-enter-start",
      slug: "p-enter-start",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Hello World" }],
          },
        ],
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
    range.setStart(textNode, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("paragraph");
    if (blocks[0].type === "paragraph") {
      expect(blocks[0].children.every((c) => c.type === "text" && !c.text)).toBe(
        true,
      );
    }
    if (blocks[1].type === "paragraph") {
      expect(blocks[1].children[0]?.type === "text" && blocks[1].children[0].text).toBe(
        "Hello World",
      );
    }
  });

  // -------------------------------------------------------------------------
  // Numbered list
  // -------------------------------------------------------------------------

  function listPost(text: string) {
    return {
      id: "li",
      slug: "li",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          { type: "list_item" as const, children: [{ type: "text" as const, text }] },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function placeCaret(block: HTMLElement, offset: number) {
    block.focus();
    const textNode = block.firstChild ?? block;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  it("converts the block to a paragraph via the slash menu list_item selection", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    block.textContent = "/";
    placeCaret(block, 1);
    fireEvent.keyUp(block, { key: "/" });
    fireEvent.click(screen.getByText("list_item"));

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("list_item");
  });

  it("Enter at the end of a list item appends a new empty item after it", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // A trailing empty paragraph always follows the list.
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children[0]).toMatchObject({ text: "Hello" });
    if (blocks[1].type === "list_item")
      expect(blocks[1].children.every((c) => !c.text)).toBe(true);
  });

  it("Enter at the start of a list item prepends an empty item before it", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children.every((c) => !c.text)).toBe(true);
    if (blocks[1].type === "list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "Hello" });
  });

  it("does not leave stale text in the reused element when prepending a list item", () => {
    // Regression: the index-based key reuses the focused element as the new
    // empty item; without clearing its DOM the text is duplicated into it.
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const top = document.querySelector("[data-block-index='0']") as HTMLElement;
    const content = document.querySelector("[data-block-index='1']") as HTMLElement;
    expect(top.textContent).toBe("");
    expect(content.textContent).toBe("Hello");
  });

  it("Enter in the middle of a list item splits it into two items", () => {
    render(<ArticleEditor initialPost={listPost("HelloWorld")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 5);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "list_item",
      "list_item",
      "paragraph",
    ]);
    if (blocks[0].type === "list_item")
      expect(blocks[0].children[0]).toMatchObject({ text: "Hello" });
    if (blocks[1].type === "list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "World" });
  });

  it("keeps a trailing empty paragraph when the last block is a list item", () => {
    render(<ArticleEditor initialPost={listPost("Hello")} />);
    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual(["list_item", "paragraph"]);
    const last = blocks[blocks.length - 1];
    expect(last.type).toBe("paragraph");
    if (last.type === "paragraph")
      expect(last.children.every((c) => !c.text)).toBe(true);
    expect(document.querySelector("p[data-block-index='1']")).not.toBeNull();
  });

  it("Enter on an empty list item converts it into a paragraph", () => {
    render(<ArticleEditor initialPost={listPost("")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("paragraph");
  });

  // -------------------------------------------------------------------------
  // Bulleted list (shares list behaviour; only the marker differs)
  // -------------------------------------------------------------------------

  function bulletPost(text: string) {
    return {
      id: "bl",
      slug: "bl",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  function bulletPostItems(
    items: Array<{ text: string; marker?: "check" | "cross" }>,
  ) {
    return {
      id: "bl",
      slug: "bl",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: items.map((it) => ({
          type: "bullet_list_item" as const,
          children: [{ type: "text" as const, text: it.text }],
          ...(it.marker ? { marker: it.marker } : {}),
        })),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  it("creates a bullet_list_item via the slash menu", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    block.focus();
    block.textContent = "/";
    placeCaret(block, 1);
    fireEvent.keyUp(block, { key: "/" });
    fireEvent.click(screen.getByText("bullet_list_item"));

    const blocks = useEditorStore.getState().document.content;
    expect(blocks[0].type).toBe("bullet_list_item");
  });

  it("Enter at the end of a bullet item appends a new bullet item (same type)", () => {
    render(<ArticleEditor initialPost={bulletPost("Hello")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks.map((b) => b.type)).toEqual([
      "bullet_list_item",
      "bullet_list_item",
      "paragraph",
    ]);
  });

  it("Enter on an empty bullet item converts it into a paragraph", () => {
    render(<ArticleEditor initialPost={bulletPost("")} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    expect(useEditorStore.getState().document.content[0].type).toBe("paragraph");
  });

  it("carries the bullet glyph forward when Enter appends an item after", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "Hello", marker: "check" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, "Hello".length);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBe("check");
  });

  it("carries the bullet glyph forward when Enter prepends an item before", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "Hello", marker: "cross" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 0);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    // The new empty item is prepended; the "Hello" item shifts to index 1.
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBe("cross");
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].children[0]).toMatchObject({ text: "Hello" });
  });

  it("carries the bullet glyph forward when Enter splits an item", () => {
    render(<ArticleEditor initialPost={bulletPostItems([{ text: "HelloWorld", marker: "check" }])} />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    placeCaret(block, 5);
    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBe("check");
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBe("check");
  });

  it("resets a bullet run to the default dot via the popover", () => {
    render(
      <ArticleEditor
        initialPost={bulletPostItems([
          { text: "A", marker: "check" },
          { text: "B", marker: "check" },
        ])}
      />,
    );
    const marker = document.querySelectorAll("[data-bullet-marker]")[0] as HTMLElement;
    fireEvent.click(marker);
    fireEvent.click(screen.getByLabelText("Reset bullets to the default style"));

    const blocks = useEditorStore.getState().document.content;
    if (blocks[0].type === "bullet_list_item")
      expect(blocks[0].marker).toBeUndefined();
    if (blocks[1].type === "bullet_list_item")
      expect(blocks[1].marker).toBeUndefined();
  });

  it("continues the previous bullet run's style via the popover", () => {
    const post = {
      id: "bl2",
      slug: "bl2",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "A" }],
            marker: "cross" as const,
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "gap" }],
          },
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "B" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const markers = document.querySelectorAll("[data-bullet-marker]");
    // The second run's marker button is the last one.
    fireEvent.click(markers[markers.length - 1] as HTMLElement);
    fireEvent.click(screen.getByLabelText("Continue bullets from previous list"));

    const blocks = useEditorStore.getState().document.content;
    if (blocks[2].type === "bullet_list_item")
      expect(blocks[2].marker).toBe("cross");
  });

  it("Backspace at the start of a paragraph merges it into a preceding bullet item without duplicating text", () => {
    const post = {
      id: "bl-merge",
      slug: "bl-merge",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "bullet_list_item" as const,
            children: [{ type: "text" as const, text: "Item" }],
            marker: "check" as const,
          },
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text: "Tail" }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    const para = document.querySelector("[data-block-index='1']") as HTMLElement;
    placeCaret(para, 0);
    fireEvent.keyDown(para, { key: "Backspace" });

    const blocks = useEditorStore.getState().document.content;
    // Paragraph merges into the bullet; a synthetic trailing paragraph follows
    // the now-terminal list item.
    expect(blocks.map((b) => b.type)).toEqual(["bullet_list_item", "paragraph"]);
    if (blocks[0].type === "bullet_list_item") {
      expect(blocks[0].children[0]).toMatchObject({ text: "ItemTail" });
      expect(blocks[0].marker).toBe("check");
    }
    // Regression: the reused (previously-focused) DOM node must show the empty
    // trailing paragraph, not the deleted paragraph's stale, duplicated "Tail".
    const itemEl = document.querySelector("[data-block-index='0']") as HTMLElement;
    const trailingEl = document.querySelector("[data-block-index='1']") as HTMLElement;
    expect(itemEl.textContent).toBe("ItemTail");
    expect(trailingEl.textContent).toBe("");
  });

  it("inserts a paragraph above when Enter is pressed at the start of a heading", () => {
    const post = {
      id: "h-enter-start",
      slug: "h-enter-start",
      title: "Test",
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "heading" as const,
            level: 2 as const,
            children: [{ type: "text" as const, text: "Title" }],
          },
        ],
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
    range.setStart(textNode, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(block, { key: "Enter" });

    const blocks = useEditorStore.getState().document.content;
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("heading");
    if (blocks[1].type === "heading") {
      expect(blocks[1].children[0]?.type === "text" && blocks[1].children[0].text).toBe(
        "Title",
      );
    }
  });
});

// ---------------------------------------------------------------------------
// Selection toolbar — mark manipulation helpers (pure)
// ---------------------------------------------------------------------------

describe("mergeAdjacentInlineNodes", () => {
  it("merges consecutive nodes with identical marks", () => {
    const out = mergeAdjacentInlineNodes([
      { type: "text", text: "foo", marks: [{ type: "bold" }] },
      { type: "text", text: "bar", marks: [{ type: "bold" }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("foobar");
  });

  it("keeps nodes with different marks separate and drops empties", () => {
    const out = mergeAdjacentInlineNodes([
      { type: "text", text: "a", marks: [{ type: "bold" }] },
      { type: "text", text: "" },
      { type: "text", text: "b" },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.text)).toEqual(["a", "b"]);
  });
});

describe("rangeHasMark", () => {
  const nodes: InlineNode[] = [
    { type: "text", text: "Hello ", marks: [{ type: "bold" }] },
    { type: "text", text: "world", marks: [{ type: "bold" }, { type: "italic" }] },
  ];

  it("is true when every covered char carries the mark", () => {
    expect(rangeHasMark(nodes, 0, 11, "bold")).toBe(true);
  });

  it("is false when part of the range lacks the mark", () => {
    expect(rangeHasMark(nodes, 0, 11, "italic")).toBe(false);
  });

  it("is false for an empty (collapsed) range", () => {
    expect(rangeHasMark(nodes, 3, 3, "bold")).toBe(false);
  });
});

describe("transformMarksInRange", () => {
  it("adds a mark across the range, splitting at boundaries", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "abcdef" }];
    const out = transformMarksInRange(nodes, 2, 4, (marks) => [
      ...marks,
      { type: "bold" },
    ]);
    // "ab" | "cd"(bold) | "ef"
    expect(out).toHaveLength(3);
    expect(out[0].text).toBe("ab");
    expect(out[1].text).toBe("cd");
    expect(out[1].marks).toEqual([{ type: "bold" }]);
    expect(out[2].text).toBe("ef");
  });

  it("removes a mark and re-merges neighbouring plain text", () => {
    const nodes: InlineNode[] = [
      { type: "text", text: "ab" },
      { type: "text", text: "cd", marks: [{ type: "bold" }] },
      { type: "text", text: "ef" },
    ];
    const out = transformMarksInRange(nodes, 2, 4, (marks) =>
      marks.filter((m) => m.type !== "bold"),
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("abcdef");
    expect(out[0].marks).toBeUndefined();
  });

  it("returns nodes unchanged for a collapsed range", () => {
    const nodes: InlineNode[] = [{ type: "text", text: "abc" }];
    expect(transformMarksInRange(nodes, 1, 1, (m) => m)).toBe(nodes);
  });
});

describe("normalizeLinkHref", () => {
  it("prepends https:// to a bare host", () => {
    expect(normalizeLinkHref("google.com")).toBe("https://google.com");
    expect(normalizeLinkHref("sub.example.co.uk/path")).toBe(
      "https://sub.example.co.uk/path",
    );
  });

  it("prepends https:// to a bare host:port (dotted prefix is not a scheme)", () => {
    expect(normalizeLinkHref("google.com:8080")).toBe(
      "https://google.com:8080",
    );
  });

  it("leaves an explicit scheme untouched", () => {
    for (const url of [
      "http://google.com",
      "https://google.com",
      "mailto:a@b.com",
      "tel:+15551234",
      "ftp://host/file",
    ]) {
      expect(normalizeLinkHref(url)).toBe(url);
    }
  });

  it("leaves relative paths, fragments, queries and protocol-relative URLs untouched", () => {
    for (const url of ["/writing/x", "#section", "?q=1", "//cdn.example.com"]) {
      expect(normalizeLinkHref(url)).toBe(url);
    }
  });

  it("trims surrounding whitespace before normalising", () => {
    expect(normalizeLinkHref("  google.com  ")).toBe("https://google.com");
  });
});

describe("findLinkRangeAt", () => {
  const nodes: InlineNode[] = [
    { type: "text", text: "see " },
    {
      type: "text",
      text: "this link",
      marks: [{ type: "link", href: "https://example.com" }],
    },
    { type: "text", text: " now" },
  ];

  it("returns the link's bounds and href when the caret is inside it", () => {
    const link = findLinkRangeAt(nodes, 7);
    expect(link).toEqual({ start: 4, end: 13, href: "https://example.com" });
  });

  it("returns null when the caret is outside any link", () => {
    expect(findLinkRangeAt(nodes, 1)).toBeNull();
  });

  it("expands across adjacent nodes sharing the same href", () => {
    const split: InlineNode[] = [
      { type: "text", text: "ab", marks: [{ type: "link", href: "https://x.io" }] },
      {
        type: "text",
        text: "cd",
        marks: [{ type: "bold" }, { type: "link", href: "https://x.io" }],
      },
    ];
    expect(findLinkRangeAt(split, 3)).toEqual({
      start: 0,
      end: 4,
      href: "https://x.io",
    });
  });
});

describe("findSidenoteRangeAt", () => {
  const nodes: InlineNode[] = [
    { type: "text", text: "see " },
    {
      type: "text",
      text: "the term",
      marks: [{ type: "sidenote", id: "n1", text: "a note" }],
    },
    { type: "text", text: " end" },
  ];

  it("returns the note's bounds and id when the caret is inside it", () => {
    expect(findSidenoteRangeAt(nodes, 7)).toEqual({
      start: 4,
      end: 12,
      id: "n1",
    });
  });

  it("counts the boundaries as inside", () => {
    expect(findSidenoteRangeAt(nodes, 4)).not.toBeNull();
    expect(findSidenoteRangeAt(nodes, 12)).not.toBeNull();
  });

  it("returns null outside any sidenote", () => {
    expect(findSidenoteRangeAt(nodes, 1)).toBeNull();
    expect(findSidenoteRangeAt(nodes, 14)).toBeNull();
  });

  it("expands across adjacent nodes sharing the same id (e.g. a bolded run)", () => {
    const split: InlineNode[] = [
      { type: "text", text: "ab", marks: [{ type: "sidenote", id: "s", text: "" }] },
      {
        type: "text",
        text: "cd",
        marks: [{ type: "bold" }, { type: "sidenote", id: "s", text: "" }],
      },
    ];
    expect(findSidenoteRangeAt(split, 3)).toEqual({ start: 0, end: 4, id: "s" });
  });

  it("does not merge two adjacent notes with different ids", () => {
    const two: InlineNode[] = [
      { type: "text", text: "a", marks: [{ type: "sidenote", id: "x", text: "" }] },
      { type: "text", text: "b", marks: [{ type: "sidenote", id: "y", text: "" }] },
    ];
    expect(findSidenoteRangeAt(two, 0)).toEqual({ start: 0, end: 1, id: "x" });
    expect(findSidenoteRangeAt(two, 2)).toEqual({ start: 1, end: 2, id: "y" });
  });
});

// ---------------------------------------------------------------------------
// Selection toolbar — component integration
// ---------------------------------------------------------------------------

describe("ArticleEditor selection toolbar", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  function seedParagraph(text: string) {
    const post = {
      id: "p1",
      slug: "s",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: {
        type: "doc" as const,
        content: [
          {
            type: "paragraph" as const,
            children: [{ type: "text" as const, text }],
          },
        ],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    return document.querySelector(
      "[data-block-index='0']",
    ) as HTMLElement;
  }

  function selectRange(el: HTMLElement, start: number, end: number) {
    const textNode = el.firstChild!;
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    sel.removeAllRanges();
    sel.addRange(range);
    act(() => {
      document.dispatchEvent(new Event("selectionchange"));
    });
  }

  it("shows the format toolbar on a non-collapsed selection and toggles bold", () => {
    const block = seedParagraph("hello world");
    block.focus();
    selectRange(block, 0, 5);

    const toolbar = screen.getByRole("toolbar", { name: "Format selection" });
    expect(toolbar).toBeDefined();

    fireEvent.click(screen.getByLabelText("Bold"));

    const nodes = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    const bolded = nodes.find((n) =>
      (n.marks ?? []).some((m: Mark) => m.type === "bold"),
    );
    expect(bolded?.text).toBe("hello");
  });

  it("applies a link through the link editor", () => {
    const block = seedParagraph("click me");
    block.focus();
    selectRange(block, 0, 5);

    fireEvent.click(screen.getByLabelText("Add link"));

    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "https://example.com" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const nodes = (
      useEditorStore.getState().document.content[0] as {
        children: InlineNode[];
      }
    ).children;
    const linked = nodes.find((n) =>
      (n.marks ?? []).some((m: Mark) => m.type === "link"),
    );
    expect(linked?.text).toBe("click");
    const linkMark = linked?.marks?.find((m: Mark) => m.type === "link");
    expect(linkMark && linkMark.type === "link" && linkMark.href).toBe(
      "https://example.com",
    );
  });

  // --- anchoring across a soft wrap -----------------------------------------
  // jsdom has no layout, so the browser's client rects are faked: the fragments
  // a real engine reports for a selection that begins at a wrap boundary — the
  // space that ends the previous visual line (far right, one line up), then the
  // glyphs on the next line.
  const WRAP_TAIL = { left: 900, top: 100, width: 4, height: 20 };
  const NEXT_LINE = { left: 20, top: 130, width: 8, height: 20 };

  function fakeClientRects(rectsFor: (text: string) => typeof WRAP_TAIL[]) {
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function (this: Range) {
      const rects = rectsFor(this.toString());
      return Object.assign([...rects], {
        item: (i: number) => rects[i] ?? null,
      }) as unknown as DOMRectList;
    };
    return () => {
      Range.prototype.getClientRects = original;
    };
  }

  it("anchors to the first visible glyph when the selection starts at a soft wrap", () => {
    // The leading space belongs to the previous line, so its rect hangs at the
    // far right of the line above — the toolbar must ignore it.
    const restore = fakeClientRects((text) =>
      text.startsWith(" ") ? [WRAP_TAIL, NEXT_LINE] : [NEXT_LINE],
    );
    try {
      const block = seedParagraph("one two three");
      block.focus();
      selectRange(block, 3, 5); // " t" — wrap space + first glyph of the line

      const anchor = document.querySelector(
        "[data-popover-anchor]",
      ) as HTMLElement;
      expect(anchor.style.left).toBe(`${NEXT_LINE.left}px`);
      expect(anchor.style.top).toBe(`${NEXT_LINE.top}px`);
    } finally {
      restore();
    }
  });

  it("ignores an empty leading fragment left on the previous line", () => {
    // A wrap with no space to swallow reports a zero-width fragment instead.
    const restore = fakeClientRects(() => [
      { ...WRAP_TAIL, width: 0 },
      NEXT_LINE,
    ]);
    try {
      const block = seedParagraph("one two three");
      block.focus();
      selectRange(block, 4, 7);

      const anchor = document.querySelector(
        "[data-popover-anchor]",
      ) as HTMLElement;
      expect(anchor.style.left).toBe(`${NEXT_LINE.left}px`);
      expect(anchor.style.top).toBe(`${NEXT_LINE.top}px`);
    } finally {
      restore();
    }
  });
});

// ---------------------------------------------------------------------------
// ⌘S / Ctrl+S in-place save
// ---------------------------------------------------------------------------

describe("ArticleEditor ⌘S save", () => {
  const DIRTY_DOC: Document = {
    type: "doc",
    content: [
      { type: "paragraph", children: [{ type: "text", text: "edited" }] },
    ],
  };

  function pressSave() {
    return act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "s",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
      // Flush the async save (createDraft/saveDraft → setDirty → clearAutosave).
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  it("saves an existing draft in place without navigating", async () => {
    const post = {
      id: "post-1",
      slug: "post-1",
      title: "Existing",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.mocked(saveDraft).mockResolvedValue({ ...post, content: DIRTY_DOC });
    render(<ArticleEditor initialPost={post} />);

    // Make an unsaved edit.
    act(() => useEditorStore.getState().setDocument(DIRTY_DOC));
    expect(useEditorStore.getState().isDirty).toBe(true);

    await pressSave();

    expect(saveDraft).toHaveBeenCalledWith({
      id: "post-1",
      title: "Existing",
      document: DIRTY_DOC,
    });
    expect(createDraft).not.toHaveBeenCalled();
    // Stays in the editor — no route change for an already-persisted draft.
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(useEditorStore.getState().isDirty).toBe(false);
    expect(notifyContentUpdated).toHaveBeenCalled();
  });

  it("creates a first-time draft and swaps to its edit URL", async () => {
    vi.mocked(createDraft).mockResolvedValue({
      id: "new-id",
      slug: "new-slug",
      title: null,
      category: "ARTICLE",
      content: DIRTY_DOC,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    render(<ArticleEditor />);

    act(() => useEditorStore.getState().setDocument(DIRTY_DOC));

    await pressSave();

    expect(createDraft).toHaveBeenCalledWith({
      title: undefined,
      document: DIRTY_DOC,
      category: "ARTICLE",
    });
    expect(useEditorStore.getState().draftId).toBe("new-id");
    expect(mockRouter.replace).toHaveBeenCalledWith(
      "/edit/new-slug?category=ARTICLE",
    );
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it("is a no-op when there are no unsaved changes", async () => {
    const post = {
      id: "post-2",
      slug: "post-2",
      title: "Clean",
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    // initialPost load leaves isDirty false.
    expect(useEditorStore.getState().isDirty).toBe(false);

    await pressSave();

    expect(saveDraft).not.toHaveBeenCalled();
    expect(createDraft).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Numbered-list marker popover (continue / reset / swap style)
// ---------------------------------------------------------------------------

describe("ArticleEditor numbering popover", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  type ListItem = { type: "list_item"; children: { type: "text"; text: string }[] };

  function seed(content: Document["content"]) {
    const post = {
      id: "num1",
      slug: "num1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
  }

  const listItem = (text: string): ListItem => ({
    type: "list_item",
    children: [{ type: "text", text }],
  });

  const markers = () =>
    Array.from(document.querySelectorAll("[data-numbering-marker]")).map(
      (el) => el.textContent,
    );

  const openPopoverForMarker = (i: number) => {
    const marker = document.querySelectorAll("[data-numbering-marker]")[i];
    fireEvent.click(marker);
  };

  it("opens the numbering popover when a marker is clicked", () => {
    seed([listItem("one"), listItem("two")]);
    expect(
      screen.queryByRole("toolbar", { name: "List numbering options" }),
    ).toBeNull();

    openPopoverForMarker(0);

    expect(
      screen.getByRole("toolbar", { name: "List numbering options" }),
    ).toBeDefined();
  });

  it("reset numbering restarts the counter at the clicked item", () => {
    seed([listItem("one"), listItem("two"), listItem("three")]);
    expect(markers()).toEqual(["1", "2", "3"]);

    openPopoverForMarker(2);
    fireEvent.click(screen.getByLabelText("Reset numbering at this item"));

    const block = useEditorStore.getState().document.content[2];
    expect(block.type === "list_item" && block.start).toBe(1);
    expect(markers()).toEqual(["1", "2", "1"]);
  });

  it("swaps the run to lettered markers and back", () => {
    seed([listItem("one"), listItem("two"), listItem("three")]);

    openPopoverForMarker(0);
    fireEvent.click(screen.getByLabelText("Switch to lettered list"));

    expect(markers()).toEqual(["a", "b", "c"]);
    const head = useEditorStore.getState().document.content[0];
    expect(head.type === "list_item" && head.marker).toBe("alpha");

    // The third button now offers switching back to numbers.
    openPopoverForMarker(1);
    fireEvent.click(screen.getByLabelText("Switch to numbered list"));
    expect(markers()).toEqual(["1", "2", "3"]);
  });

  it("continue numbering picks up from the previous list", () => {
    seed([
      listItem("a"),
      listItem("b"),
      listItem("c"),
      { type: "paragraph", children: [{ type: "text", text: "gap" }] },
      listItem("d"),
      listItem("e"),
    ]);
    expect(markers()).toEqual(["1", "2", "3", "1", "2"]);

    openPopoverForMarker(3); // head of the second list
    fireEvent.click(
      screen.getByLabelText("Continue numbering from previous list"),
    );

    expect(markers()).toEqual(["1", "2", "3", "4", "5"]);
    const head = useEditorStore.getState().document.content[4];
    expect(head.type === "list_item" && head.continued).toBe(true);
  });

  it("continue numbering is a no-op when no list precedes it", () => {
    seed([listItem("only"), listItem("list")]);

    openPopoverForMarker(0);
    fireEvent.click(
      screen.getByLabelText("Continue numbering from previous list"),
    );

    const head = useEditorStore.getState().document.content[0];
    expect(head.type === "list_item" && head.continued).toBeUndefined();
    expect(markers()).toEqual(["1", "2"]);
  });
});

// ---------------------------------------------------------------------------
// Block indentation (Tab / Shift+Tab)
// ---------------------------------------------------------------------------

describe("ArticleEditor block indent", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  function seed(block: Document["content"][number]) {
    const post = {
      id: "ind1",
      slug: "ind1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: [block] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
    return document.querySelector("[data-block-index='0']") as HTMLElement;
  }

  function caretAtStart(el: HTMLElement) {
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.firstChild ?? el, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function caretAtEnd(el: HTMLElement) {
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  const para = (text: string) => ({
    type: "paragraph" as const,
    children: [{ type: "text" as const, text }],
  });

  const indentOf = (i = 0) => {
    const b = useEditorStore.getState().document.content[i];
    return (b as { indent?: boolean }).indent;
  };

  it("indents a paragraph on Tab at the start", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
    expect(document.querySelector("p[data-block-index='0'][data-indented]")).not.toBeNull();
  });

  it("outdents on Shift+Tab", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab", shiftKey: true });

    expect(indentOf()).toBeUndefined();
    expect(document.querySelector("[data-block-index='0'][data-indented]")).toBeNull();
  });

  it("Tab on an already-indented block is a no-op", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("Shift+Tab on a non-indented block is a no-op", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab", shiftKey: true });

    expect(indentOf()).toBeUndefined();
  });

  it("indents with the caret anywhere in the block (not just the start)", () => {
    const el = seed(para("hello"));
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("carries the indent to the new paragraph when splitting mid-block", () => {
    const el = seed({ ...para("hello world"), indent: true });
    el.focus();
    // Caret between "hello" and " world".
    const sel = window.getSelection()!;
    const range = document.createRange();
    range.setStart(el.firstChild!, 5);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
    expect(content[1].type).toBe("paragraph");
  });

  it("carries the indent to a new block on Enter at the end", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("carries the indent to the empty paragraph on Enter at the start", () => {
    const el = seed({ ...para("hello"), indent: true });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Enter" });

    // Both the new empty paragraph and the shifted content stay indented.
    const content = useEditorStore.getState().document.content;
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("splitting an indented heading yields an indented paragraph", () => {
    const el = seed({
      type: "heading",
      level: 2,
      indent: true,
      children: [{ type: "text", text: "Title" }],
    });
    el.focus();
    caretAtEnd(el);

    fireEvent.keyDown(el, { key: "Enter" });

    const content = useEditorStore.getState().document.content;
    expect(content[0].type).toBe("heading");
    expect((content[0] as { indent?: boolean }).indent).toBe(true);
    expect(content[1].type).toBe("paragraph");
    expect((content[1] as { indent?: boolean }).indent).toBe(true);
  });

  it("indents a blockquote on Tab", () => {
    const el = seed({
      type: "blockquote",
      children: [{ type: "text", text: "quote" }],
    });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  it("indents a metric on Tab", () => {
    const el = seed({
      type: "metric",
      children: [{ type: "text", text: "$1M" }],
    });
    el.focus();
    caretAtStart(el);

    fireEvent.keyDown(el, { key: "Tab" });

    expect(indentOf()).toBe(true);
  });

  // fireEvent.keyDown returns false when a handler called preventDefault — i.e.
  // Tab was swallowed and won't move the caret to the next node.
  it("swallows Tab on a list item without indenting", () => {
    const el = seed({
      type: "list_item",
      children: [{ type: "text", text: "item" }],
    });
    el.focus();
    caretAtStart(el);

    const notPrevented = fireEvent.keyDown(el, { key: "Tab" });

    expect(notPrevented).toBe(false);
    expect(indentOf()).toBeUndefined();
  });

  it("swallows Tab in a code block", () => {
    const el = seed({
      type: "code_block",
      children: [{ type: "text", text: "const x = 1" }],
    });
    el.focus();
    caretAtStart(el);

    expect(fireEvent.keyDown(el, { key: "Tab" })).toBe(false);
  });

  it("swallows Tab in the title", () => {
    seed(para("body"));
    const title = document.querySelector("#article-title") as HTMLElement;
    title.focus();

    expect(fireEvent.keyDown(title, { key: "Tab" })).toBe(false);
  });

  it("swallows Shift+Tab on a list item (no outdent jump)", () => {
    const el = seed({
      type: "list_item",
      children: [{ type: "text", text: "item" }],
    });
    el.focus();
    caretAtStart(el);

    expect(fireEvent.keyDown(el, { key: "Tab", shiftKey: true })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Bulleted-list marker popover (dot / check / cross)
// ---------------------------------------------------------------------------

describe("ArticleEditor bullet popover", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  type BulletItem = {
    type: "bullet_list_item";
    marker?: "check" | "cross";
    children: { type: "text"; text: string }[];
  };

  function seed(items: BulletItem[]) {
    const post = {
      id: "bul1",
      slug: "bul1",
      title: "T",
      status: "DRAFT" as const,
      category: "ARTICLE" as const,
      content: { type: "doc" as const, content: items },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    render(<ArticleEditor initialPost={post} />);
  }

  const bullet = (text: string, marker?: "check" | "cross"): BulletItem => ({
    type: "bullet_list_item",
    ...(marker ? { marker } : {}),
    children: [{ type: "text", text }],
  });

  const openPopover = (i: number) => {
    const marker = document.querySelectorAll("[data-bullet-marker]")[i];
    fireEvent.click(marker);
  };

  const markerOf = (i: number) => {
    const b = useEditorStore.getState().document.content[i];
    return b.type === "bullet_list_item" ? b.marker : undefined;
  };

  it("opens the bullet popover when a bullet is clicked", () => {
    seed([bullet("one"), bullet("two")]);
    expect(
      screen.queryByRole("toolbar", { name: "List bullet options" }),
    ).toBeNull();

    openPopover(0);

    expect(
      screen.getByRole("toolbar", { name: "List bullet options" }),
    ).toBeDefined();
    // Default (dot) option is selected.
    expect(
      screen.getByLabelText("Bulleted list").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("sets the check glyph when 'Checked list' is chosen", () => {
    seed([bullet("one")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Checked list"));

    expect(markerOf(0)).toBe("check");
    // The marker button now renders a glyph circle instead of the bare dot.
    // The glyph is masked onto the circle so the brand gradient can reach it,
    // so the shape shows up as a recipe variant rather than a child <svg>.
    expect(
      document.querySelector(
        "[data-bullet-marker] .list-bullet-circle--glyph_check",
      ),
    ).not.toBeNull();
  });

  it("sets the cross glyph when 'Crossed list' is chosen", () => {
    seed([bullet("one")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Crossed list"));

    expect(markerOf(0)).toBe("cross");
  });

  it("returns to the default dot when 'Bulleted list' is chosen", () => {
    seed([bullet("one", "check")]);
    openPopover(0);
    fireEvent.click(screen.getByLabelText("Bulleted list"));

    expect(markerOf(0)).toBeUndefined();
    expect(
      document.querySelector("[data-bullet-marker] .list-bullet-circle"),
    ).toBeNull();
  });

  it("styles bullets per-item (one check, one default)", () => {
    seed([bullet("one", "check"), bullet("two")]);
    expect(markerOf(0)).toBe("check");
    expect(markerOf(1)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Collection block
// ---------------------------------------------------------------------------

describe("ArticleEditor collection block", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  afterEach(() => {
    cleanup();
    useEditorStore.getState().reset();
  });

  /** A filled slot, spelled the way a document holds one. */
  const slot = (
    src: string,
    fields: Partial<Omit<MediaNode, "type" | "kind" | "src">> = {},
  ): MediaNode => ({ type: "media", kind: "image", src, ...fields });

  const collectionPost = (items: MediaNode[]) => ({
    id: "collection-post",
    slug: "collection-post",
    title: "Collection Post",
    category: "ARTICLE" as const,
    content: {
      type: "doc" as const,
      content: [
        { type: "collection" as const, items },
        {
          type: "paragraph" as const,
          children: [{ type: "text" as const, text: "" }],
        },
      ],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const blocks = () => useEditorStore.getState().document.content;
  const collection = () => {
    const block = blocks()[0];
    if (block.type !== "collection") throw new Error("expected a collection");
    return block;
  };
  const toolbarFor = (index: number) =>
    screen.getByRole("toolbar", { name: `Image ${index + 1} actions` });

  it("opens the picker in multi-select from the slash menu", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    fireEvent.click(screen.getByText("collection"));

    const dialog = screen.getByTestId("image-dialog");
    expect(dialog.getAttribute("data-selection-mode")).toBe("multiple");
    expect(dialog.getAttribute("data-max-selection")).toBe("6");
    // The trigger block waits as an empty paragraph until images arrive.
    expect(blocks()[0].type).toBe("paragraph");
    expect(block.textContent).toBe("");
  });

  it("writes the picked batch as one collection, in order", () => {
    render(<ArticleEditor />);
    const block = document.querySelector("[data-block-index='0']") as HTMLElement;
    openSlashMenuOnBlock(block);
    fireEvent.click(screen.getByText("collection"));
    fireEvent.click(screen.getByText("insert"));

    expect(collection().items.map((i) => i.src)).toEqual([
      "https://cdn/1.png",
      "https://cdn/2.png",
      "https://cdn/3.png",
      "https://cdn/4.png",
    ]);
    // A figure can't hold a caret, so a paragraph must follow it.
    expect(blocks()).toHaveLength(2);
    expect(blocks()[1].type).toBe("paragraph");
  });

  it("shows every slot, filled or not", () => {
    render(<ArticleEditor initialPost={collectionPost([slot("a")])} />);
    expect(screen.getAllByRole("toolbar")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Add Media" })).toHaveLength(5);
  });

  it("swaps a featured image with the one it replaces", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([slot("a"), slot("b"), slot("c")])}
      />,
    );
    fireEvent.click(
      within(toolbarFor(2)).getByRole("button", { name: "Feature image" }),
    );
    // "b" never moves — only the two slots that traded places change.
    expect(collection().items.map((i) => i.src)).toEqual(["c", "b", "a"]);
  });

  // Reordering runs on pointer events, not the drag-and-drop API, and resolves
  // the tile under the pointer from the cells' own rects — so jsdom, which lays
  // nothing out, needs those stated. A row of 100px cells at the origin.
  function dragCell(from: number, to: number) {
    const cells = Array.from(
      document.querySelectorAll<HTMLElement>("[data-collection-cell]"),
    );
    cells.forEach((cell, index) => {
      const left = index * 100;
      const at = () =>
        ({
          left,
          top: 0,
          width: 100,
          height: 100,
          right: left + 100,
          bottom: 100,
          x: left,
          y: 0,
          toJSON: () => "",
        }) as DOMRect;
      cell.getBoundingClientRect = at;
      cell.querySelector("img")!.getBoundingClientRect = at;
    });

    const at = (index: number) => ({ clientX: index * 100 + 50, clientY: 50 });
    const send = (type: string, target: Element, point: ReturnType<typeof at>) => {
      // jsdom implements no PointerEvent; React dispatches on the type, so a
      // MouseEvent carrying the pointer fields reaches the handlers.
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        ...point,
      });
      Object.defineProperty(event, "pointerId", { value: 1 });
      fireEvent(target, event);
    };

    send("pointerdown", cells[from].querySelector("img")!, at(from));
    send("pointermove", cells[from], at(to));
    send("pointerup", cells[from], at(to));
  }

  it("swaps two slots when a tile is dragged onto another", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([slot("a"), slot("b"), slot("c")])}
      />,
    );
    dragCell(1, 2);
    expect(collection().items.map((i) => i.src)).toEqual(["a", "c", "b"]);
  });

  // Dropping into the first cell is the same state change as pressing Feature.
  it("features an image dragged into the first cell", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([slot("a"), slot("b"), slot("c")])}
      />,
    );
    dragCell(2, 0);

    expect(collection().items.map((i) => i.src)).toEqual(["c", "b", "a"]);
    expect(
      within(toolbarFor(0))
        .getByRole("button", { name: "Feature image" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("removes one image and leaves the block behind", () => {
    render(
      <ArticleEditor initialPost={collectionPost([slot("a"), slot("b")])} />,
    );
    fireEvent.click(
      within(toolbarFor(0)).getByRole("button", { name: "Remove image" }),
    );
    expect(collection().items.map((i) => i.src)).toEqual(["b"]);

    fireEvent.click(
      within(toolbarFor(0)).getByRole("button", { name: "Remove image" }),
    );
    expect(collection().items).toEqual([]);
  });

  it("removes the image from the collection without deleting the stored object", () => {
    // The cell's trash empties a SLOT, not the bucket. The same picture may be
    // featured in another collection, embedded in a published article, or about
    // to be picked again from the library — so the only thing a removal is
    // allowed to change is this block's `items`. Deleting from R2 is a separate,
    // deliberate act, and it lives in the media library alone.
    mediaActions.deleteMedia.mockClear();
    render(
      <ArticleEditor initialPost={collectionPost([slot("a"), slot("b")])} />,
    );
    fireEvent.click(
      within(toolbarFor(0)).getByRole("button", { name: "Remove image" }),
    );

    expect(collection().items.map((i) => i.src)).toEqual(["b"]);
    expect(mediaActions.deleteMedia).not.toHaveBeenCalled();
  });

  it("caps the picker at the remaining capacity when adding", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([slot("a"), slot("b"), slot("c")])}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add Media" })[0]);
    expect(
      screen.getByTestId("image-dialog").getAttribute("data-max-selection"),
    ).toBe("3");
  });

  it("appends without passing the cap", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([
          slot("a"),
          slot("b"),
          slot("c"),
          slot("d"),
        ])}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add Media" })[0]);
    fireEvent.click(screen.getByText("insert"));

    expect(collection().items.map((i) => i.src)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "https://cdn/1.png",
      "https://cdn/2.png",
    ]);
  });

  it("replaces one slot, keeping the caption written for it", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([
          slot("a"),
          slot("b", { caption: "Kept" }),
        ])}
      />,
    );
    fireEvent.click(
      within(toolbarFor(1)).getByRole("button", { name: "Replace image" }),
    );
    const dialog = screen.getByTestId("image-dialog");
    expect(dialog.getAttribute("data-mode")).toBe("change");
    expect(dialog.getAttribute("data-max-selection")).toBe("1");

    fireEvent.click(screen.getByText("insert"));
    expect(collection().items[1]).toEqual({
      type: "media",
      kind: "image",
      src: "https://cdn/1.png",
      caption: "Kept",
    });
  });

  it("stores a per-image caption from the properties panel", () => {
    render(<ArticleEditor initialPost={collectionPost([slot("a")])} />);
    fireEvent.click(
      within(toolbarFor(0)).getByRole("button", { name: "Image properties" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add caption" }));
    // Live, not a form: the caption is stored as it is typed, with no Enter to
    // remember and nothing to lose by clicking away.
    fireEvent.change(screen.getByRole("textbox", { name: "Image caption" }), {
      target: { value: "A view" },
    });

    expect(collection().items[0].caption).toBe("A view");
  });

  it("stores the block's own caption separately from the images'", () => {
    render(
      <ArticleEditor
        initialPost={collectionPost([slot("a", { caption: "Per image" })])}
      />,
    );
    const figcaption = document.querySelector("figcaption") as HTMLElement;
    figcaption.textContent = "Whole set";
    fireEvent.input(figcaption);

    expect(collection().caption).toBe("Whole set");
    expect(collection().items[0].caption).toBe("Per image");
  });

  it("deletes the whole block on Backspace over the grid", () => {
    render(<ArticleEditor initialPost={collectionPost([slot("a")])} />);
    const grid = document.querySelector("[data-showcase-media]") as HTMLElement;
    grid.focus();
    fireEvent.keyDown(grid, { key: "Backspace" });

    expect(blocks().every((b) => b.type !== "collection")).toBe(true);
  });

  // The grid root owns the figure's caret keys, but it also CONTAINS the cell
  // toolbars — whose own Enter and Backspace must stay theirs.
  it("leaves the block alone when a key comes from inside a cell", () => {
    render(<ArticleEditor initialPost={collectionPost([slot("a")])} />);
    const button = within(toolbarFor(0)).getByRole("button", {
      name: "Image properties",
    });
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: "Backspace" });

    expect(blocks()[0].type).toBe("collection");
    expect(blocks()).toHaveLength(2);
  });

  it("navigates from the grid into the block caption with ArrowDown", () => {
    render(<ArticleEditor initialPost={collectionPost([slot("a")])} />);
    const grid = document.querySelector("[data-showcase-media]") as HTMLElement;
    grid.focus();
    fireEvent.keyDown(grid, { key: "ArrowDown" });

    expect(document.activeElement?.tagName.toLowerCase()).toBe("figcaption");
  });
});
